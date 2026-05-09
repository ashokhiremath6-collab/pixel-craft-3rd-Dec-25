# Multi-Tenancy Foundation

## What & Why
Every table in the database currently stores data for a single shared workspace. To sell this as a SaaS product, each paying customer must have their own isolated organisation whose data is completely invisible to other organisations. This phase adds an `organisations` table and threads an `orgId` through every relevant table and query — it is the structural foundation that every other SaaS phase depends on.

## Done looks like
- An `organisations` table exists with a name, slug, and plan field
- Every user belongs to exactly one organisation
- Every project, vendor, catalogue item, SOP, specification, schedule, asset, and all child records belong to an organisation
- All API queries filter by the calling user's `orgId` — one organisation can never read or write another's data
- The existing single workspace (the current owner's data) is migrated into a seed organisation automatically, so nothing is lost
- Roles (admin, designer, project_manager, client) remain relative to an organisation — an admin of Org A has no privileges in Org B

## Out of scope
- The sign-up flow that creates new organisations (Phase 2)
- Billing or plan limits (Phase 3 and 4)
- A super-admin view across all organisations (Phase 5)

## Steps
1. **Add organisations table** — Create the `organisations` schema with `id`, `name`, `slug` (URL-safe unique identifier), `plan` (defaults to "trial"), `createdAt`. Add a migration.
2. **Add orgId to users** — Add `orgId` (FK → organisations) to the `users` table. A user belongs to one organisation.
3. **Add orgId to all data tables** — Add `orgId` to: `projects`, `vendors`, `vendor_categories`, `vendor_contacts`, `project_vendors`, `quote_templates`, `quote_files`, `boq`, `catalogue_items`, `specifications`, `saved_assets`, `object_assets`, `moodboards`, `project_schedules`, `tasks`, `task_dependencies`, `task_alerts`, `approvals`, `meeting_minutes`, `works_orders`, `works_order_items`, `works_order_templates`, `vendor_invoices`, `vendor_payments`, `sops`, `activity_log`, `floor_plans`, `designer_allowlist`, `user_project_assignments`, `project_clients`, `user_roles`. Run a migration to backfill all existing rows with a single seed org ID.
4. **Seed organisation migration** — On first startup after migration, if no organisations exist, create one org ("Default") and assign all existing users and data to it.
5. **Auth middleware** — After login resolves the user, attach `req.user.orgId` to every authenticated request. All route handlers and storage methods receive `orgId` automatically.
6. **Update all storage queries** — Every `db.select / insert / update / delete` in `server/storage.ts` must add a `.where(eq(table.orgId, orgId))` clause. No query should touch rows from another org.
7. **Update all route handlers** — Ensure every route in `server/routes.ts` passes `req.user.orgId` down to the storage layer.
8. **Smoke-test isolation** — Verify that logging in as a user from Org A returns zero results from Org B's data. Confirm existing data is intact and accessible.

## Relevant files
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `server/localAuth.ts`
- `server/replitAuth.ts`
- `drizzle.config.ts`
