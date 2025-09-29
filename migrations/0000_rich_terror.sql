-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "quote_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_vendor_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"external_storage_provider" text,
	"external_file_id" text
);
--> statement-breakpoint
CREATE TABLE "vendor_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" numeric,
	"version" text DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_vendor_id" varchar NOT NULL,
	"item_description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"unit_rate" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"category" text,
	"item_code" text,
	"specifications" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" varchar NOT NULL,
	"contact_person" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quote_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" varchar NOT NULL,
	"description" text,
	"template_file" text,
	"fields" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"original_file_data" text,
	"original_file_name" text,
	"original_mime_type" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" text NOT NULL,
	"client_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"client_email" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"quotation_file" text,
	"quotation_value" numeric(10, 2),
	"date_of_quotation" date,
	"status" text DEFAULT 'Quoted' NOT NULL,
	"notes" text,
	"template_id" varchar,
	"submitted_at" timestamp DEFAULT now(),
	"quotation_name" text DEFAULT 'Main Quote' NOT NULL,
	"quotation_type" text DEFAULT 'item' NOT NULL,
	"parent_quotation_id" varchar,
	"item_category" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" varchar,
	"username" varchar,
	"image_url" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'client' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "designer_allowlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by" varchar NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "designer_allowlist_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "userRoles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'client' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_files" ADD CONSTRAINT "quote_files_project_vendor_id_project_vendors_id_fk" FOREIGN KEY ("project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq" ADD CONSTRAINT "boq_project_vendor_id_project_vendors_id_fk" FOREIGN KEY ("project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_category_id_vendor_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_category_id_vendor_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quote_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_parent_quotation_id_fkey" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designer_allowlist" ADD CONSTRAINT "designer_allowlist_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire" timestamp_ops);
*/