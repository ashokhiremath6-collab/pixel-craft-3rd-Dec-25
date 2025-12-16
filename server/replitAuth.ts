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
  
  // Get the primary domain for cookie scope
  const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
  const primaryDomain = domains[0];
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // Always secure since Replit uses HTTPS
      sameSite: "lax", // Allows cookies for same-site navigation
      maxAge: sessionTtl,
      // Domain is intentionally omitted to let the browser use the exact host
      // This prevents issues with multiple subdomains
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

    // Auto-assign and sync roles based on manager status in Client Access
    if (claims["email"]) {
      // First, check if user is a manager in any project (via Client Access)
      const managerProjects = await storage.getManagerProjectsByEmail(claims["email"]);
      console.log('[AUTH] Manager projects found:', managerProjects.length);
      
      // Check if user already has a role
      const existingRole = await storage.getUserRole(user.id);
      console.log('[AUTH] Existing role:', existingRole);
      
      if (managerProjects.length > 0) {
        // User is a project manager - ensure they have project_manager role
        if (!existingRole || existingRole.role !== 'project_manager') {
          if (existingRole) {
            // Upgrade existing role to project_manager
            await storage.updateUserRole(user.id, 'project_manager');
            console.log('[AUTH] Upgraded role to project_manager for:', user.email);
          } else {
            // Create new project_manager role
            await storage.createUserRole({
              userId: user.id,
              role: 'project_manager',
              isActive: true,
              assignedBy: user.id,
            });
            console.log('[AUTH] Auto-assigned project_manager role to:', user.email);
          }
        }
        
        // Sync project assignments - get existing and add any missing ones
        const existingAssignments = await storage.getUserProjectAssignments(user.id);
        const existingProjectIds = new Set(existingAssignments.map(a => a.projectId));
        
        for (const mp of managerProjects) {
          if (!existingProjectIds.has(mp.projectId)) {
            try {
              await storage.assignUserToProject({
                userId: user.id,
                projectId: mp.projectId,
                assignedBy: user.id,
              });
              console.log('[AUTH] Auto-assigned project:', mp.projectId, 'to:', user.email);
            } catch (assignError) {
              console.log('[AUTH] Project already assigned or error:', assignError);
            }
          }
        }
      } else if (!existingRole) {
        // No manager projects and no existing role - assign based on allowlist
        const isDesigner = await storage.isDesignerEmail(claims["email"]);
        console.log('[AUTH] Is designer email?', claims["email"], isDesigner);
        
        const roleToAssign = isDesigner ? 'designer' : 'client';
        await storage.createUserRole({
          userId: user.id,
          role: roleToAssign,
          isActive: true,
          assignedBy: user.id,
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