---
name: Neon production DDL silently fails in Drizzle migrations
description: ALTER TABLE in Drizzle's runMigrations() silently fails in Neon production; server still starts, causing runtime column-not-found crashes.
---

## The rule
Never rely on Drizzle's `migrate()` to apply DDL (ALTER TABLE / CREATE INDEX) against the Neon production database. The runtime database user lacks DDL permissions, so the statement fails without throwing — Drizzle marks it applied in `__drizzle_migrations`, and the server starts normally. Subsequent ORM queries that reference the missing column crash with `column "X" does not exist`.

**Confirmed patterns that ALL fail silently:**
- `ALTER TABLE foo ADD COLUMN bar ...;`
- `DO $$ BEGIN IF NOT EXISTS (...) THEN ALTER TABLE ...; END IF; END $$;` — the DO block itself does not raise an error, Drizzle sees success, but the column is never added.

**Why:** Neon production uses a restricted runtime role; DDL must go through a privileged path. The Drizzle server-startup migrator uses the runtime role from `DATABASE_URL`.

**Safe alternative for computed boolean flags:**
Instead of adding a column, use a live SQL subquery in the SELECT:
```js
myFlag: sql<boolean>`EXISTS (SELECT 1 FROM other_table WHERE ...)`,
```
This requires zero schema changes and is always accurate.

**How to apply:**
- For new columns: prefer live subqueries or post-fetch JS computation rather than ALTER TABLE.
- If a new column is absolutely required, make the migration SQL a no-op (`SELECT 1;`) and remove the column from the Drizzle schema — this prevents the ORM from generating queries that reference the absent column and crashing the server.
- For data-only migrations (DELETE, UPDATE, INSERT): these DO work because they don't need DDL permissions. Separate DDL from DML into different migrations.
- Confirm column existence in production via: `SELECT column_name FROM information_schema.columns WHERE table_name = 'X'` with `environment: "production"` in executeSql.
