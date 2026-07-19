---
name: req.orgId is the canonical org source in routes
description: Why routes must use req.orgId (session) and never storage.getUser().orgId (DB) for org scoping.
---

## Rule
In any Express route, always use `(req as any).orgId` (or `req.orgId`) for org-scoping. Never call `storage.getUser(userId)` just to retrieve `orgId` for filtering.

**Why:** This workspace supports multi-org users via a workspace-switcher. When a user switches workspace, only `req.user.orgId` in the session is updated. The `users.org_id` column in the DB always holds the user's *home* org. Using `storage.getUser().orgId` bypasses the active workspace and returns the wrong org, leaking data from one org into another.

**How to apply:**
- `requireAuth` middleware (server/localAuth.ts) now stamps `(req as any).orgId` from the session automatically. Every route that uses `requireAuth` has `req.orgId` available for free.
- Write new routes as: `const orgId = (req as any).orgId; if (!orgId) return res.json([]);`
- The pattern `const user = await storage.getUser(userId); const orgId = user.orgId;` is banned for org-scoping purposes. Only use `storage.getUser` when you need other user fields (name, email, etc.).
