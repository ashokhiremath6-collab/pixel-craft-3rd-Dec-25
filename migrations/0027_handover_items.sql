CREATE TABLE IF NOT EXISTS "handover_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL,
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit" text NOT NULL DEFAULT 'nos',
  "status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "handover_items_project_idx" ON "handover_items"("project_id");
CREATE INDEX IF NOT EXISTS "handover_items_org_idx" ON "handover_items"("org_id");
