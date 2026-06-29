ALTER TABLE "handover_items" DROP CONSTRAINT IF EXISTS "handover_items_project_id_projects_id_fk";
ALTER TABLE "handover_items" ALTER COLUMN "project_id" DROP NOT NULL;
