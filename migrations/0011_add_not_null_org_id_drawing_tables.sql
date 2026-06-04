-- 0011_add_not_null_org_id_drawing_tables.sql
-- Adds NOT NULL constraint to org_id on the 6 new drawing tables.
-- Migration 0009 declared NOT NULL in the CREATE TABLE DDL but the constraint
-- did not land in production (confirmed via information_schema post-0009 deploy).
-- All 6 tables are empty (verified pre-apply), so SET NOT NULL is safe.
-- SET NOT NULL on an already-NOT-NULL column is a no-op in PostgreSQL — idempotent.

ALTER TABLE rooms              ALTER COLUMN org_id SET NOT NULL;
-- --> statement-breakpoint
ALTER TABLE drawings           ALTER COLUMN org_id SET NOT NULL;
-- --> statement-breakpoint
ALTER TABLE drawing_revisions  ALTER COLUMN org_id SET NOT NULL;
-- --> statement-breakpoint
ALTER TABLE drawing_approvals  ALTER COLUMN org_id SET NOT NULL;
-- --> statement-breakpoint
ALTER TABLE revision_events    ALTER COLUMN org_id SET NOT NULL;
-- --> statement-breakpoint
ALTER TABLE drawing_comments   ALTER COLUMN org_id SET NOT NULL;
