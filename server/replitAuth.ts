import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  try {
    console.log('[AUTH] Upserting user with claims:', {
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
    });

    const user = await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });

    console.log('[AUTH] User upserted successfully:', user.id, user.email);

    // Auto-assign roles to new users
    if (claims["email"]) {
      // Check if user already has a role
      const existingRole = await storage.getUserRole(user.id);
      console.log('[AUTH] Existing role:', existingRole);
      
      if (!existingRole) {
        // Check if user should have designer role based on email allowlist
        const isDesigner = await storage.isDesignerEmail(claims["email"]);
        console.log('[AUTH] Is designer email?', claims["email"], isDesigner);
        
        // Assign appropriate role: designer if allowlisted, otherwise client
        const roleToAssign = isDesigner ? 'designer' : 'client';
        await storage.createUserRole({
          userId: user.id,
          role: roleToAssign,
          isActive: true,
          assignedBy: user.id, // self-assigned during signup
        });
        console.log('[AUTH] Auto-assigned role:', roleToAssign, 'to:', user.email);
      }
    }
  } catch (error) {
    console.error('[AUTH] Error in upsertUser:', error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      console.log('[AUTH] Verifying user with claims:', tokens.claims());
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      console.log('[AUTH] Verification successful, session created');
      verified(null, user);
    } catch (error) {
      console.error('[AUTH] Verification failed:', error);
      verified(error as Error);
    }
  };

  // Get the primary Replit domain (first one in the list)
  const domains = process.env.REPLIT_DOMAINS!.split(",");
  const primaryDomain = domains[0];

  for (const domain of domains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log('[AUTH] Login endpoint hit, hostname:', req.hostname);
    // Use primary domain for authentication instead of req.hostname
    // This fixes the issue when accessed via localhost or other domains
    const strategyName = `replitauth:${primaryDomain}`;
    console.log('[AUTH] Using strategy:', strategyName);
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log('[AUTH] Callback endpoint hit, query:', req.query);
    // Use primary domain for authentication instead of req.hostname
    const strategyName = `replitauth:${primaryDomain}`;
    console.log('[AUTH] Using strategy:', strategyName);
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};