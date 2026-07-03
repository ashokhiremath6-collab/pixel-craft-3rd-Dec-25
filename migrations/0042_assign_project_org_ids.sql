-- Assign correct org_id to legacy projects that have org_id = NULL.
-- These were created before multi-tenancy was added.
-- Step 1: Assign based on user_project_assignments (most reliable signal).
UPDATE projects p
SET org_id = (
  SELECT u.org_id
  FROM user_project_assignments upa
  JOIN users u ON u.id = upa.user_id
  WHERE upa.project_id = p.id
    AND u.org_id IS NOT NULL
  LIMIT 1
)
WHERE p.org_id IS NULL;

-- Step 2: For any remaining null-org_id projects (no explicit assignments),
-- assign to the primary admin's org so they are not visible to all orgs.
UPDATE projects p
SET org_id = (
  SELECT org_id FROM users WHERE role = 'admin' AND org_id IS NOT NULL LIMIT 1
)
WHERE p.org_id IS NULL;
