ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_payments_project_id" ON "vendor_payments" ("project_id");
