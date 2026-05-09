# Super-Admin Back-Office

## What & Why
As the product owner you need visibility across all customer organisations — to monitor usage, manage subscriptions, handle support requests, and spot problems before customers do. This phase builds a separate back-office panel that only system-level super-admins can access, completely separate from the customer-facing app.

## Done looks like
- A /superadmin route exists, gated by a `isSuperAdmin` flag on the user record (set manually in the DB or via an env-configured email list)
- The super-admin dashboard lists all organisations with their plan, status, user count, project count, storage usage, and last-active date
- Clicking an organisation shows its full detail: users, subscription history, recent activity
- Super-admins can change an org's plan directly (e.g. grant a free upgrade for a support case) without going through Stripe
- Super-admins can impersonate any user within an org (read-only session) to debug support issues, with an audit log entry recording the impersonation
- A metrics overview shows total orgs, monthly recurring revenue (from Stripe), orgs on trial, and orgs with past-due payments
- All super-admin actions are recorded in a separate `superadmin_audit_log` table

## Out of scope
- Customer-facing support ticket system (future)
- Automated churn-risk scoring (future)
- Financial reporting beyond basic MRR from Stripe

## Steps
1. **Super-admin flag** — Add `isSuperAdmin` (boolean, default false) to the `users` table. Create a migration. Gate access via an env variable listing super-admin emails as a fallback for initial setup.
2. **Super-admin auth middleware** — Add a `requireSuperAdmin` middleware that checks `req.user.isSuperAdmin` and returns 403 otherwise. Apply to all /api/superadmin/* routes.
3. **Org listing API** — Create GET /api/superadmin/organisations returning all orgs with aggregated stats (user count, project count, plan, status, last activity).
4. **Org detail API** — Create GET /api/superadmin/organisations/:orgId returning full detail for one org including its users, subscription data, and recent activity log entries.
5. **Plan override API** — Create PATCH /api/superadmin/organisations/:orgId/plan to let super-admins change the plan directly, logging the action to `superadmin_audit_log`.
6. **Impersonation API** — Create POST /api/superadmin/impersonate/:userId that creates a short-lived impersonation session token. The super-admin opens the app in a new tab with that token; the session resolves to the target user's context with a visible "Impersonating [name]" banner.
7. **Super-admin UI** — Build the /superadmin pages: an org list with search and filters (plan, status), an org detail page, and a metrics overview panel.
8. **Audit log table and writes** — Add `superadmin_audit_log` (superAdminId, action, targetOrgId, targetUserId, metadata, createdAt) and write an entry for every plan override and impersonation.

## Relevant files
- `server/routes.ts`
- `server/storage.ts`
- `server/localAuth.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
