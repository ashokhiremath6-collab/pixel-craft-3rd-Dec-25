-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
CREATE SEQUENCE IF NOT EXISTS "public"."works_order_serial_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" jsonb NOT NULL,
        "expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "specifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "uploaded_by" varchar NOT NULL,
        "uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "userRoles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "role" varchar DEFAULT 'client' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "assigned_by" varchar,
        "assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "user_name" text NOT NULL,
        "user_email" text NOT NULL,
        "project_id" varchar,
        "activity_type" text NOT NULL,
        "file_name" text NOT NULL,
        "file_path" text,
        "description" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "task_id" varchar NOT NULL,
        "requested_by" varchar NOT NULL,
        "approver_id" varchar NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "comments" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_vendors" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "vendor_id" varchar,
        "quotation_file" text,
        "quotation_value" numeric(15, 2),
        "date_of_quotation" date,
        "status" text DEFAULT 'Quoted' NOT NULL,
        "notes" text,
        "template_id" varchar,
        "submitted_at" timestamp DEFAULT now(),
        "quotation_name" text DEFAULT 'Main Quote' NOT NULL,
        "quotation_type" text DEFAULT 'item' NOT NULL,
        "parent_quotation_id" varchar,
        "item_category" text,
        "is_negotiated" boolean DEFAULT false NOT NULL,
        "unit_rate_subtype" text,
        "category" text,
        "category_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boq" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_vendor_id" varchar NOT NULL,
        "item_description" text NOT NULL,
        "quantity" numeric(15, 2) NOT NULL,
        "unit" text NOT NULL,
        "unit_rate" numeric(15, 2) NOT NULL,
        "total_amount" numeric(15, 2) NOT NULL,
        "category" text,
        "item_code" text,
        "specifications" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "designer_allowlist" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "added_by" varchar NOT NULL,
        "added_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "designer_allowlist_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorite_render_styles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "name" text NOT NULL,
        "style_id" text NOT NULL,
        "prompt" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "floor_plans" (
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
CREATE TABLE IF NOT EXISTS "meeting_minutes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar,
        "meeting_date" date NOT NULL,
        "meeting_title" text NOT NULL,
        "meeting_type" text NOT NULL,
        "attendees" text,
        "location" text,
        "file_path" text NOT NULL,
        "file_name" text NOT NULL,
        "file_type" text NOT NULL,
        "file_size" numeric,
        "summary" text,
        "uploaded_by" varchar,
        "uploaded_at" timestamp DEFAULT now() NOT NULL,
        "source" text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_action_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "meeting_minutes_id" varchar NOT NULL,
        "serial_no" integer NOT NULL,
        "issue_discussed" text NOT NULL,
        "responsibility" text,
        "deadline" date,
        "remarks" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moodboards" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar,
        "name" text NOT NULL,
        "description" text,
        "file_name" text,
        "file_path" text,
        "file_type" text,
        "file_size" numeric,
        "tags" jsonb,
        "canva_link" text,
        "uploaded_at" timestamp DEFAULT now() NOT NULL,
        "asset_type" text DEFAULT 'moodboard' NOT NULL,
        "room_type" text,
        "reference_metadata" jsonb,
        "saved_by" varchar,
        "folder" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "object_assets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "object_type" text NOT NULL,
        "original_file_name" text NOT NULL,
        "original_file_path" text NOT NULL,
        "processed_file_path" text,
        "thumbnail_path" text,
        "transparent_path" text,
        "processing_status" text DEFAULT 'pending' NOT NULL,
        "processing_error" text,
        "detected_bounds" jsonb,
        "dimensions" jsonb,
        "ai_description" text,
        "ai_prompt_hints" text,
        "user_description" text,
        "catalogue_item_id" varchar,
        "uploaded_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "processed_at" timestamp,
        "reprocess_count" integer DEFAULT 0 NOT NULL,
        "processing_instructions" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogue_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "main_category" text NOT NULL,
        "subcategory" text NOT NULL,
        "attributes" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "file_name" text,
        "file_path" text,
        "vendor_brand" text,
        "description" text,
        "catalogue_url" text,
        "ai_image_path" text,
        "ai_prompt_hints" text,
        "org_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_name" text NOT NULL,
        "client_name" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "client_email" text DEFAULT '' NOT NULL,
        "canva_link" text,
        "gantt_chart_link" text,
        "foyr_neo_link" text,
        "org_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_clients" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "client_email" text NOT NULL,
        "client_name" text,
        "role" text,
        "added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_schedules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "file_name" text NOT NULL,
        "version" text DEFAULT '1.0' NOT NULL,
        "file_path" text NOT NULL,
        "file_size" numeric,
        "status" text DEFAULT 'active' NOT NULL,
        "uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "parent_id" varchar,
        "description" text,
        "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_templates" (
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
CREATE TABLE IF NOT EXISTS "vendors" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "category_id" varchar NOT NULL,
        "contact_person" text NOT NULL,
        "phone" text NOT NULL,
        "email" text NOT NULL,
        "notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_files" (
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
CREATE TABLE IF NOT EXISTS "saved_assets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "display_name" text NOT NULL,
        "description" text,
        "tags" text,
        "file_path" text NOT NULL,
        "thumbnail_path" text,
        "source_type" text DEFAULT 'object_asset' NOT NULL,
        "object_asset_id" varchar,
        "catalogue_item_id" varchar,
        "ai_prompt_hints" text,
        "saved_by" varchar NOT NULL,
        "saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_alerts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "task_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "alert_type" text NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "triggered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_dependencies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "from_task_id" varchar NOT NULL,
        "to_task_id" varchar NOT NULL,
        "dependency_type" text DEFAULT 'finish_to_start' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "lag" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_project_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "project_id" varchar NOT NULL,
        "assigned_by" varchar,
        "assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
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
CREATE TABLE IF NOT EXISTS "vendor_contacts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "vendor_id" varchar NOT NULL,
        "contact_person" text NOT NULL,
        "phone" text NOT NULL,
        "email" text,
        "role" text,
        "is_primary" boolean DEFAULT false NOT NULL,
        "added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_invoices" (
        "id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
        "vendor_id" varchar NOT NULL,
        "project_id" varchar,
        "invoice_number" varchar NOT NULL,
        "invoice_date" date NOT NULL,
        "description" text NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "attachment_path" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_payments" (
        "id" varchar PRIMARY KEY DEFAULT (gen_random_uuid()) NOT NULL,
        "vendor_id" varchar NOT NULL,
        "payment_date" date NOT NULL,
        "payment_reference" varchar NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "payment_method" varchar NOT NULL,
        "notes" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "attachment_path" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_order_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "works_order_id" varchar,
        "document_type" text NOT NULL,
        "file_path" text NOT NULL,
        "file_name" text NOT NULL,
        "file_size" numeric(15, 0),
        "is_global_template" boolean DEFAULT false NOT NULL,
        "version" text,
        "uploaded_by" varchar,
        "uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_vendor_id" varchar NOT NULL,
        "quote_file_id" varchar,
        "template_id" varchar,
        "template_version" text,
        "order_number" text NOT NULL,
        "title" text NOT NULL,
        "scope" text NOT NULL,
        "payment_terms" text,
        "start_date" date,
        "completion_date" date,
        "total_value" numeric(15, 2),
        "status" text DEFAULT 'draft' NOT NULL,
        "draft_file_path" text,
        "signed_file_path" text,
        "access_token" text,
        "sent_at" timestamp,
        "signed_at" timestamp,
        "voided_at" timestamp,
        "void_reason" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "notes" text,
        "serial_counter" integer NOT NULL,
        CONSTRAINT "works_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_order_files" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "works_order_id" varchar NOT NULL,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "file_type" text NOT NULL,
        "file_size" text NOT NULL,
        "uploaded_by" varchar NOT NULL,
        "uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_order_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "works_order_id" varchar NOT NULL,
        "description" text NOT NULL,
        "quantity" numeric(15, 2) NOT NULL,
        "unit" text NOT NULL,
        "unit_rate" numeric(15, 2) NOT NULL,
        "total_amount" numeric(15, 2) NOT NULL,
        "category" text,
        "item_code" text,
        "specifications" text,
        "source_project_vendor_id" varchar,
        "source_works_order_id" varchar,
        "sort_order" numeric(10, 0) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_order_signatures" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "works_order_id" varchar NOT NULL,
        "signer_id" varchar,
        "signer_email" text NOT NULL,
        "signer_name" text NOT NULL,
        "signer_role" text NOT NULL,
        "signature_method" text NOT NULL,
        "signature_data" text,
        "signature_path" text,
        "ip_address" text,
        "signed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "works_order_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "category_id" varchar,
        "description" text,
        "object_path" text NOT NULL,
        "original_file_name" text NOT NULL,
        "mime_type" text,
        "file_size" integer,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "project_id" varchar NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "duration" numeric(10, 2),
        "assigned_to" varchar,
        "status" text DEFAULT 'not_started' NOT NULL,
        "progress_percentage" numeric(5, 2) DEFAULT '0',
        "predecessor_ids" text[],
        "approval_required" boolean DEFAULT false NOT NULL,
        "approval_status" text,
        "approved_by" varchar,
        "approved_at" timestamp,
        "priority" text DEFAULT 'medium' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "schedule_id" varchar,
        "task_id" text,
        "is_critical_path" boolean DEFAULT false NOT NULL,
        "materials" text,
        "owner" text,
        "target_start_date" date,
        "target_end_date" date,
        "remarks" text,
        "outline_level" integer,
        "color" text,
        "row_index" integer,
        "subcategory" text,
        "deadline_history" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sops" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "category" text NOT NULL,
        "description" text,
        "content" text,
        "file_name" text,
        "file_path" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "org_id" varchar NOT NULL,
        "email" text NOT NULL,
        "role" text DEFAULT 'designer' NOT NULL,
        "token" varchar NOT NULL,
        "invited_by" varchar NOT NULL,
        "accepted_at" timestamp,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "invitations_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
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
        "password_hash" varchar,
        "email_verified_at" timestamp,
        "email_verification_token" varchar,
        "password_reset_token" varchar,
        "password_reset_token_expiry" timestamp,
        "org_id" varchar,
        "onboarding_completed_at" timestamp,
        "is_super_admin" boolean DEFAULT false NOT NULL,
        "notification_preferences" jsonb,
        "unsubscribe_token" varchar,
        "trial_banner_snoozed_until" timestamp,
        "trial_banner_snooze_duration" text,
        CONSTRAINT "users_username_unique" UNIQUE("email"),
        CONSTRAINT "users_email_verification_token_key" UNIQUE("email_verification_token"),
        CONSTRAINT "users_password_reset_token_key" UNIQUE("password_reset_token"),
        CONSTRAINT "users_unsubscribe_token_key" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "superadmin_audit_log" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "super_admin_id" varchar,
        "action" text NOT NULL,
        "target_org_id" varchar,
        "target_user_id" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organisations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" varchar NOT NULL,
        "plan" text DEFAULT 'trial' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "stripe_customer_id" text,
        "stripe_subscription_id" text,
        "plan_status" text DEFAULT 'trialing' NOT NULL,
        "current_period_end" timestamp,
        "trial_expiry_notified_at" timestamp,
        CONSTRAINT "organisations_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_parent_quotation_id_fkey" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quote_templates"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "boq" ADD CONSTRAINT "boq_project_vendor_id_project_vendors_id_fk" FOREIGN KEY ("project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "designer_allowlist" ADD CONSTRAINT "designer_allowlist_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "favorite_render_styles" ADD CONSTRAINT "favorite_render_styles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meeting_minutes_id_fkey" FOREIGN KEY ("meeting_minutes_id") REFERENCES "public"."meeting_minutes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "moodboards" ADD CONSTRAINT "moodboards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "moodboards" ADD CONSTRAINT "moodboards_saved_by_fkey" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "object_assets" ADD CONSTRAINT "object_assets_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "object_assets" ADD CONSTRAINT "object_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_clients" ADD CONSTRAINT "project_clients_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_category_id_vendor_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendors" ADD CONSTRAINT "vendors_category_id_vendor_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_files" ADD CONSTRAINT "quote_files_project_vendor_id_project_vendors_id_fk" FOREIGN KEY ("project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "saved_assets" ADD CONSTRAINT "saved_assets_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "saved_assets" ADD CONSTRAINT "saved_assets_object_asset_id_fkey" FOREIGN KEY ("object_asset_id") REFERENCES "public"."object_assets"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "saved_assets" ADD CONSTRAINT "saved_assets_saved_by_fkey" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_alerts" ADD CONSTRAINT "task_alerts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_alerts" ADD CONSTRAINT "task_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_from_task_id_fkey" FOREIGN KEY ("from_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_to_task_id_fkey" FOREIGN KEY ("to_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_project_assignments" ADD CONSTRAINT "user_project_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_project_assignments" ADD CONSTRAINT "user_project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_project_assignments" ADD CONSTRAINT "user_project_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_documents" ADD CONSTRAINT "works_order_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_documents" ADD CONSTRAINT "works_order_documents_works_order_id_fkey" FOREIGN KEY ("works_order_id") REFERENCES "public"."works_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_orders" ADD CONSTRAINT "works_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_orders" ADD CONSTRAINT "works_orders_project_vendor_id_fkey" FOREIGN KEY ("project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_orders" ADD CONSTRAINT "works_orders_quote_file_id_fkey" FOREIGN KEY ("quote_file_id") REFERENCES "public"."quote_files"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_files" ADD CONSTRAINT "works_order_files_works_order_id_fkey" FOREIGN KEY ("works_order_id") REFERENCES "public"."works_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_items" ADD CONSTRAINT "works_order_items_source_project_vendor_id_fkey" FOREIGN KEY ("source_project_vendor_id") REFERENCES "public"."project_vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_items" ADD CONSTRAINT "works_order_items_source_works_order_id_fkey" FOREIGN KEY ("source_works_order_id") REFERENCES "public"."works_orders"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_items" ADD CONSTRAINT "works_order_items_works_order_id_fkey" FOREIGN KEY ("works_order_id") REFERENCES "public"."works_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_signatures" ADD CONSTRAINT "works_order_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_signatures" ADD CONSTRAINT "works_order_signatures_works_order_id_fkey" FOREIGN KEY ("works_order_id") REFERENCES "public"."works_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_templates" ADD CONSTRAINT "works_order_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."vendor_categories"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "works_order_templates" ADD CONSTRAINT "works_order_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."project_schedules"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sops" ADD CONSTRAINT "sops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "superadmin_audit_log" ADD CONSTRAINT "superadmin_audit_log_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "superadmin_audit_log" ADD CONSTRAINT "superadmin_audit_log_target_org_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "superadmin_audit_log" ADD CONSTRAINT "superadmin_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meeting_date" ON "meeting_minutes" USING btree ("meeting_date" date_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_id" ON "meeting_minutes" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meeting_action_meeting_id" ON "meeting_action_items" USING btree ("meeting_minutes_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_assets_status_idx" ON "object_assets" USING btree ("processing_status" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_assets_type_idx" ON "object_assets" USING btree ("object_type" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_items_org_id_idx" ON "catalogue_items" USING btree ("org_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_main_category_idx" ON "catalogue_items" USING btree ("main_category" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_id_idx" ON "projects" USING btree ("org_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_project_client" ON "project_clients" USING btree ("project_id" text_ops,"client_email" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_assets_saved_by_idx" ON "saved_assets" USING btree ("saved_by" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_assets_source_type_idx" ON "saved_assets" USING btree ("source_type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_project" ON "user_project_assignments" USING btree ("user_id" text_ops,"project_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_invoices_project_id" ON "vendor_invoices" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_invoices_vendor_id" ON "vendor_invoices" USING btree ("vendor_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_payments_vendor_id" ON "vendor_payments" USING btree ("vendor_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_order_documents_global_template_idx" ON "works_order_documents" USING btree ("is_global_template" bool_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_order_documents_works_order_idx" ON "works_order_documents" USING btree ("works_order_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_orders_order_number_idx" ON "works_orders" USING btree ("order_number" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_orders_status_idx" ON "works_orders" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_order_items_order_sort_idx" ON "works_order_items" USING btree ("works_order_id" text_ops,"sort_order" numeric_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "works_order_templates_category_idx" ON "works_order_templates" USING btree ("category_id" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sops_category_idx" ON "sops" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "superadmin_audit_created_at_idx" ON "superadmin_audit_log" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "superadmin_audit_super_admin_idx" ON "superadmin_audit_log" USING btree ("super_admin_id" text_ops);
