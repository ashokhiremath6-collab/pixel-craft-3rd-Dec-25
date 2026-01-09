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
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days for longer persistence
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Create table if it doesn't exist
    ttl: sessionTtl / 1000, // ttl is in seconds for connect-pg-simple
    tableName: "sessions",
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset session expiry on each request
    cookie: {
      httpOnly: true,
      secure: true, // Always secure since Replit uses HTTPS
      sameSite: "lax", // Allows cookies for same-site navigation
      maxAge: sessionTtl,
      path: "/",
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
    // Use the request's hostname to select the matching strategy
    // This ensures the session cookie is set on the same domain the user is accessing
    const hostname = req.hostname;
    const matchingDomain = domains.find(d => d === hostname || hostname.endsWith(`.${d}`));
    const strategyDomain = matchingDomain || primaryDomain;
    const strategyName = `replitauth:${strategyDomain}`;
    console.log('[AUTH] Using strategy:', strategyName, 'for hostname:', hostname);
    passport.authenticate(strategyName, {
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log('[AUTH] Callback endpoint hit, hostname:', req.hostname, 'query:', req.query);
    // Use the request's hostname to select the matching strategy
    const hostname = req.hostname;
    const matchingDomain = domains.find(d => d === hostname || hostname.endsWith(`.${d}`));
    const strategyDomain = matchingDomain || primaryDomain;
    const strategyName = `replitauth:${strategyDomain}`;
    console.log('[AUTH] Using strategy:', strategyName, 'for hostname:', hostname);
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

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // If no expires_at, treat as valid (session exists but token info missing)
  if (!user.expires_at) {
    console.log('[AUTH] No expires_at in session, allowing request (session valid)');
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Add 60 second buffer for token expiration to prevent edge cases
  if (now <= user.expires_at - 60) {
    return next();
  }

  // Token is expired or about to expire, try to refresh
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log('[AUTH] No refresh token available, session still valid');
    // Session is still valid even without refresh token
    return next();
  }

  try {
    console.log('[AUTH] Token expired, attempting refresh...');
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Save the session to persist the refreshed tokens
    if (req.session) {
      req.session.save((err) => {
        if (err) {
          console.error('[AUTH] Failed to save session after token refresh:', err);
        }
      });
    }
    
    console.log('[AUTH] Token refreshed successfully');
    return next();
  } catch (error) {
    console.error('[AUTH] Token refresh failed:', error);
    // Even if refresh fails, if the session is valid, continue
    // The session cookie persists for 7 days
    console.log('[AUTH] Continuing with existing session despite refresh failure');
    return next();
  }
};