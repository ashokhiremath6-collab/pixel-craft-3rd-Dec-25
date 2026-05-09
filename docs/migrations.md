# Database Migrations

## Overview

Schema changes are managed exclusively through Drizzle Kit. Every change is a discrete, reviewed migration file committed to version control. There is no longer any bootstrap DDL running at startup — `server/migrate.ts` only calls the Drizzle migrator.

## Workflow

1. **Modify** `shared/schema.ts` to reflect the desired schema change.
2. **Generate** the migration file:
   ```bash
   npx drizzle-kit generate
   ```
3. **Review** the generated file in `migrations/` before committing. Check column types, constraints, and operator classes.
4. **Commit** both `shared/schema.ts` and the new migration file together in one commit.
5. **Deploy** — on startup the server calls `runMigrations()` in `server/migrate.ts`, which runs `npx drizzle-kit migrate` equivalent via the Drizzle programmatic migrator. All pending migrations are applied automatically.

## What Not to Do

- No manual `ALTER TABLE` statements outside of migration files.
- No hand-editing of already-applied migration files.
- No skipping code review on generated migration files — review column types and operator classes carefully.
- Do not delete applied migration files. Drizzle tracks applied migrations by hash in the `drizzle.__drizzle_migrations` table.

## The Baseline

`migrations/0000_baseline.sql` is the complete schema state as of **2026-05-09**, verified to match production exactly (sub-task 2 verified zero differences between the baseline-applied test database and production). This file is wrapped in a block comment so the Drizzle migrator treats it as already applied (recorded in `drizzle.__drizzle_migrations`).

## Questions?

Migrations are self-documenting code — read the files in `migrations/` in order to understand how the schema has evolved. The journal at `migrations/meta/_journal.json` lists every migration in sequence.
