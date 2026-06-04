-- 0010_backfill_hiremath_org.sql
-- Backfills org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07' (Hiremath Interiors)
-- onto the 8 studio users and the Maker Tower project that predate multi-tenancy.
--
-- org_id on the 6 new drawing tables (rooms, drawings, drawing_revisions,
-- drawing_approvals, revision_events, drawing_comments) stays NOT NULL as
-- mandated by spec v1.2 Section 1A.
--
-- Guard: the UPDATE only fires if Hiremath Interiors actually exists in the
-- organisations table, making both statements safe no-ops on dev where that
-- org is absent.
--
-- Idempotent: re-running sets already-correct rows to the same value — harmless.
-- No reference to Varun Interiors (2fe17037-21ec-4ec7-9d27-ff215141d01c) anywhere.

-- --> statement-breakpoint

UPDATE users
SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
WHERE id IN (
  '23621870',
  '46833846',
  '47510089',
  '48590680',
  '48598553',
  '48688631',
  '49660215',
  '49796924'
)
AND EXISTS (
  SELECT 1 FROM organisations
  WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
);

-- --> statement-breakpoint

UPDATE projects
SET org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
WHERE id = '2de39e0d-ec50-4426-9b9e-69b6868409b0'
AND EXISTS (
  SELECT 1 FROM organisations
  WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
);
