ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "works_orders" DROP CONSTRAINT "works_orders_template_id_works_order_templates_id_fk";
--> statement-breakpoint
DROP INDEX "specifications_category_idx";--> statement-breakpoint
ALTER TABLE "designer_allowlist" ALTER COLUMN "added_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "client_email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "specifications" ALTER COLUMN "uploaded_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "specifications" ALTER COLUMN "uploaded_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ALTER COLUMN "assigned_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ALTER COLUMN "invoice_number" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vendor_invoices" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_payments" ALTER COLUMN "payment_reference" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "vendor_payments" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vendor_payments" ALTER COLUMN "payment_method" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "vendor_payments" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "works_order_files" ALTER COLUMN "file_size" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "works_order_files" ALTER COLUMN "file_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN "attachment_path" text;--> statement-breakpoint
ALTER TABLE "works_orders" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE INDEX "catalogue_items_org_id_idx" ON "catalogue_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "projects_org_id_idx" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_invoices_vendor_id" ON "vendor_invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_invoices_project_id" ON "vendor_invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_payments_vendor_id" ON "vendor_payments" USING btree ("vendor_id");