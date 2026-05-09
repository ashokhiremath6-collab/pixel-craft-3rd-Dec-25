# Plan Limits and Usage Dashboard

## What & Why
Without enforced limits, all organisations would get unlimited usage regardless of their plan. This phase defines what each plan tier allows, enforces those limits in the backend, surfaces usage clearly to the user, and prompts upgrades when limits are approaching or reached.

## Done looks like
- Each plan tier has defined limits (e.g. max projects, max users, max storage in GB)
- The backend rejects operations that would exceed the current plan's limits with a clear error message
- A Usage section in Settings shows how much of each limit is consumed (e.g. "3 of 5 projects used")
- When an org is at 80% of a limit, a non-blocking banner appears in the relevant section prompting an upgrade
- When a limit is reached, the relevant create action is blocked and a clear upgrade prompt is shown
- Trial orgs have tighter limits than paid tiers

## Out of scope
- Per-feature flags beyond the defined limits (future)
- Usage-based billing (flat plan pricing only)
- Retroactive enforcement on existing data already over a new plan's limit (grandfather existing data; only block new additions)

## Steps
1. **Define plan limits** — Create a plan configuration file mapping plan names (trial, starter, pro, enterprise) to their limits: `maxProjects`, `maxUsers`, `maxStorageGb`, `maxCatalogueItems`.
2. **Usage tracking helpers** — Add storage methods to count current usage per org for each resource type (project count, user count, catalogue items, object storage bytes).
3. **Limit enforcement middleware** — Add a reusable `checkLimit(orgId, resource)` helper that reads the org's plan, fetches current usage, and throws a 403 with a structured error if the limit is exceeded. Apply it in the relevant POST routes (create project, invite user, upload file, create catalogue item).
4. **Usage API endpoint** — Create GET /api/billing/usage that returns current usage counts and plan limits for the calling org.
5. **Usage UI in Settings** — Add a Usage tab (or section within Billing) showing progress bars for each resource. Display plan name and a link to upgrade.
6. **Approaching-limit banners** — On the Projects list, Users list, and Catalogue page, show a non-blocking warning banner when usage is ≥ 80% of the limit.
7. **Blocked-action upgrade prompts** — When a limit is hit, replace the normal "Create" button with an upgrade prompt modal explaining the limit and linking to the billing upgrade flow.

## Relevant files
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
