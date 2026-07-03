-- Fix: migration 0043 step 2 queried users.role which does not exist.
-- This migration corrects any vendors that still have org_id = NULL
-- by looking up the admin org through the user_roles table instead.

-- Step 1: Try to assign via project_vendors → projects (same as 0043 step 1, safe to re-run).
UPDATE vendors v
SET org_id = (
  SELECT p.org_id
  FROM project_vendors pv
  JOIN projects p ON p.id = pv.project_id
  WHERE pv.vendor_id = v.id
    AND p.org_id IS NOT NULL
  LIMIT 1
)
WHERE v.org_id IS NULL;

-- Step 2 (corrected): For any still-null vendors, use the admin's org from user_roles.
UPDATE vendors v
SET org_id = (
  SELECT ur.org_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
    AND ur.org_id IS NOT NULL
  LIMIT 1
)
WHERE v.org_id IS NULL;
