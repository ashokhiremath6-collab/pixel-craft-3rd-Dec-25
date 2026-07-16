-- Migration 0052 silently skipped in production because the admin lookup
-- (ORDER BY created_at LIMIT 1) matched no eligible row.
-- Result: 77 vendors still have NULL org_id, making them invisible to
-- org-scoped queries (strict eq filter).
--
-- Fix: assign all remaining null-org_id vendors to Supriya Hiremath Vora Designs,
-- which is the primary org that owns all pre-existing vendor records.
UPDATE vendors
SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
WHERE org_id IS NULL;
