-- Ensure every vendor row has a non-null org_id.
-- Any remaining nulls (vendors created after migrations 0043/0045 ran without
-- the route stamping orgId) are assigned to the primary admin's org.
UPDATE vendors
SET org_id = (
  SELECT ur.org_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
    AND ur.org_id IS NOT NULL
    AND ur.is_active = true
  ORDER BY ur.created_at
  LIMIT 1
)
WHERE org_id IS NULL;
