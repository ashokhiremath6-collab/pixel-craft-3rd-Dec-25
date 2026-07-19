---
name: Drizzle migration runner stuck at idx 38 in production
description: Journal entries 0039+ are silently skipped in production; workaround is startup-time DDL/DML in server/index.ts
---

## The Rule

Any new table or column added via migration idx 39+ will NOT be created in the production database by the Drizzle migration runner. It runs silently as a no-op.

**Why:** The `when` timestamps in `migrations/meta/_journal.json` for entries 0039+ are earlier than or equal to entry 0038's timestamp. The Neon-serverless Drizzle migrator uses this timestamp for ordering and skips migrations that appear out-of-order.

**How to apply:** For every new table or non-nullable column added by any migration file:
1. Also add it to `server/index.ts` as a startup-time idempotent block, using `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, wrapped in try/catch.
2. Place it before the `registerRoutes(app)` call.
3. Use `IF NOT EXISTS` so it is a no-op after the first successful run.

```typescript
try {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS my_new_table (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      ...
    )
  `);
} catch (err) {
  console.error("Failed to create my_new_table:", err);
}
```

The `project_messages` table was the first new table added this way (server/index.ts startup block after migration 0055 was skipped in production).

**Note:** The `migrations/` SQL files and `_journal.json` must still be maintained correctly — they apply correctly in the dev environment via the `runMigrations()` call. Only production is affected.
