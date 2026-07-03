---
name: Migration backfill — never query users.role
description: users table has no role column; roles are in user_roles. Backfill UPDATEs that join users WHERE role=X will silently fail or error.
---

## Rule
When writing a migration that needs to find users by role, always join `user_roles` table, not `users`. The `users` table has no `role` column — roles live entirely in `user_roles`.

**Why:** Migration 0043 step 2 used `SELECT org_id FROM users WHERE role = 'admin'` which fails with "column does not exist". All vendors that were linked to projects got their org_id from step 1 (project_vendors join) so the bug was invisible in dev. A corrected migration 0044 was added that queries `user_roles.role = 'admin'` instead.

**How to apply:** Any future backfill that needs to resolve "which org does this row belong to via the admin user" should use:
```sql
SELECT ur.org_id FROM user_roles ur WHERE ur.role = 'admin' AND ur.org_id IS NOT NULL LIMIT 1
```
Never use `SELECT org_id FROM users WHERE role = 'admin'`.
