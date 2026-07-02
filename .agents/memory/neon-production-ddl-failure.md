---
name: Neon production DDL silently fails in Drizzle migrations
description: ALTER TABLE in Drizzle's runMigrations() silently fails in Neon production; server still starts, causing runtime column-not-found crashes.
---

## The rule
Never rely on Drizzle's `migrate()` to apply DDL (ALTER TABLE / CREATE INDEX) against the Neon production database. The runtime database user lacks DDL permissions, so the statement fails without throwing — Drizzle marks it applied in `__drizzle_migrations` (or skips tracking entirely), and the server starts normally. Subsequent ORM queries that reference the missing column then crash with `column "X" does not exist`.

**Why:** Neon production uses a restricted runtime role; DDL must go through a privileged path (Replit Publish schema diffing, or a migration run with a superuser connection). The Drizzle server-startup migrator uses the runtime role from `DATABASE_URL`.

**How to apply:**
- If a new column is needed in production, add it via a Drizzle schema change and rely on Replit Publish (which diffs the schema and applies changes with a privileged role).
- If Publish is not applying a column, convert the migration SQL to a no-op (`SELECT 1;`) and remove the column from the Drizzle schema until the issue is resolved — this prevents the ORM from generating queries that reference the absent column and crashing the server.
- Confirm column existence in production via: `SELECT column_name FROM information_schema.columns WHERE table_name = 'X'` with `environment: "production"` in executeSql.
- Confirm which migrations Drizzle thinks are applied via `SELECT hash FROM __drizzle_migrations ORDER BY created_at` — an empty result means no migrations are tracked (all will re-run on next deploy).
