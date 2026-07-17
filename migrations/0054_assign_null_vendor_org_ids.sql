-- Assign all vendors that still have org_id = NULL to the Supriya Hiremath Vora Designs
-- organisation. These are legacy rows that pre-date multi-tenancy and were missed by
-- the earlier backfill migrations (0043 / 0044 / 0045 / 0053).
--
-- The WHERE EXISTS guard makes this a no-op in development where the Vora org does not
-- exist, so it is safe to run in every environment.

UPDATE vendors
SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
WHERE org_id IS NULL
  AND EXISTS (
    SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
  );
