-- Fix vendors whose org_id points to an organisation that does not exist in the DB,
-- or is still NULL. This happens when migration 0043 assigned vendors to an org_id
-- from a different environment (dev vs prod) that doesn't exist in the current DB.
-- Reassign them to the primary admin's org from user_roles.

UPDATE vendors
SET org_id = (
  SELECT ur.org_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
    AND ur.org_id IS NOT NULL
    AND ur.is_active = true
  LIMIT 1
)
WHERE org_id IS NULL
   OR org_id NOT IN (SELECT id FROM organisations);
