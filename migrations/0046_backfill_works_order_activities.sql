-- Backfill activity_log entries for existing works orders that were
-- created before the import-route bug was fixed (the route was using
-- req.user.claims.name which threw on passport-local auth, silently
-- skipping the activity insert every time).
--
-- For each works_order that has no matching activity_log row we insert
-- one using the creator's name/email from the users table and the
-- project resolved through project_vendors → projects.

INSERT INTO activity_log (
  id,
  user_id,
  user_name,
  user_email,
  project_id,
  activity_type,
  file_name,
  file_path,
  description,
  metadata,
  created_at,
  org_id
)
SELECT
  gen_random_uuid()                                            AS id,
  wo.created_by                                               AS user_id,
  COALESCE(
    NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
    u.email
  )                                                           AS user_name,
  COALESCE(u.email, '')                                       AS user_email,
  p.id                                                        AS project_id,
  'works_order_create'                                        AS activity_type,
  wo.order_number || '.pdf'                                   AS file_name,
  ''                                                          AS file_path,
  'uploaded works order ' || wo.order_number                  AS description,
  jsonb_build_object(
    'worksOrderId',    wo.id,
    'orderNumber',     wo.order_number,
    'projectVendorId', wo.project_vendor_id,
    'projectName',     p.project_name,
    'backfilled',      true
  )                                                           AS metadata,
  wo.created_at                                               AS created_at,
  wo.org_id                                                   AS org_id
FROM works_orders wo
JOIN users u ON u.id = wo.created_by
LEFT JOIN project_vendors pv ON pv.id = wo.project_vendor_id
LEFT JOIN projects p ON p.id = pv.project_id
-- Only insert where no activity row already exists for this works order
WHERE NOT EXISTS (
  SELECT 1
  FROM activity_log al
  WHERE al.activity_type = 'works_order_create'
    AND (al.metadata->>'worksOrderId') = wo.id
);
