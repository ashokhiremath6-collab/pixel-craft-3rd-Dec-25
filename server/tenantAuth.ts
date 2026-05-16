// server/tenantAuth.ts
// Tenant isolation middleware.
//
// Why this file exists:
//   Authenticated requests already carry req.user (the full user row, hydrated
//   by passport.deserializeUser in localAuth.ts). That row includes org_id.
//   This file provides:
//     1. A typed shape for req.user so handlers stop using `(req.user as any)`.
//     2. A requireOrg middleware that enforces the user has an org_id and
//        exposes it as req.orgId for downstream handlers and storage calls.
//
// What this file deliberately does NOT do:
//   - It does not authenticate. Compose it AFTER isAuthenticated/requireAuth.
//   - It does not check roles. Compose it WITH requireAdmin/etc as needed.
//   - It does not modify req.user. It only reads orgId from it.

import type { Request, Response, NextFunction } from "express";

// ---- Type augmentation -----------------------------------------------------
// Express's default Request.user is `Express.User | undefined`. We narrow
// Express.User to the subset of fields the app actually relies on at runtime.
// This is a minimal contract: add fields here only when middleware/handlers
// genuinely need them at the type level. The runtime object still contains
// the full DB row — we are not stripping anything.

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User {
      id: string;
      orgId: string | null;
      isSuperAdmin?: boolean;
      email?: string;
    }

    interface Request {
      // Set by requireOrg. Non-null because requireOrg refuses to call next()
      // unless orgId is present.
      orgId?: string;
    }
  }
}

// ---- Middleware ------------------------------------------------------------

/**
 * Requires that req.user exists and has a non-null orgId.
 * Attaches req.orgId for convenience and type-narrowing in downstream code.
 *
 * Failure modes:
 *   - No req.user                       -> 401 { error: "not_authenticated" }
 *                                          (defensive; isAuthenticated should
 *                                          have caught this already.)
 *   - req.user.orgId is null/undefined  -> 403 { error: "no_organisation" }
 *
 * Compose AFTER an authentication middleware:
 *   app.get("/api/things", isAuthenticated, requireOrg, handler)
 */
export function requireOrg(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "not_authenticated" });
  }
  if (!user.orgId) {
    return res.status(403).json({ error: "no_organisation" });
  }
  req.orgId = user.orgId;
  return next();
}

/**
 * Type guard / helper for inside handlers. Useful when a handler is composed
 * with requireOrg but TypeScript still treats req.orgId as optional.
 *
 *   const orgId = getOrgIdOrThrow(req);
 *   const rows = await storage.listThings(orgId);
 *
 * Throws (rather than returning a Response) so it surfaces as a 500 if
 * misused — i.e. if a route forgot to compose requireOrg. That noisy failure
 * is preferable to silently returning unfiltered data.
 */
export function getOrgIdOrThrow(req: Request): string {
  if (!req.orgId) {
    throw new Error(
      "getOrgIdOrThrow called without requireOrg in the middleware chain"
    );
  }
  return req.orgId;
}
