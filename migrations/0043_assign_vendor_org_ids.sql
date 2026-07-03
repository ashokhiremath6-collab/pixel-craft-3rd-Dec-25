-- Assign correct org_id to legacy vendors that have org_id = NULL.
-- These were created before multi-tenancy was added.
-- Step 1: Assign based on project_vendors → projects → org_id (most reliable signal).
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

-- Step 2: For remaining null-org_id vendors (never linked to a project),
-- assign to the primary admin's org.
UPDATE vendors v
SET org_id = (
  SELECT org_id FROM users WHERE role = 'admin' AND org_id IS NOT NULL LIMIT 1
)
WHERE v.org_id IS NULL;
