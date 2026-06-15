-- Client Briefs table
CREATE TABLE IF NOT EXISTS "client_briefs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL,
  "project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL,
  "client_name" text NOT NULL,
  "client_email" text,
  "phone" text,
  "project_type" text,
  "property_address" text,
  "scope_of_work" text,
  "budget_min" numeric,
  "budget_max" numeric,
  "currency" text NOT NULL DEFAULT 'INR',
  "timeline" text,
  "style_preferences" text,
  "must_haves" text,
  "must_avoids" text,
  "inspiration_notes" text,
  "status" text NOT NULL DEFAULT 'new',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Proposals table
CREATE TABLE IF NOT EXISTS "proposals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL,
  "brief_id" varchar REFERENCES "client_briefs"("id") ON DELETE SET NULL,
  "project_id" varchar REFERENCES "projects"("id") ON DELETE SET NULL,
  "proposal_title" text NOT NULL,
  "client_name" text NOT NULL,
  "client_email" text,
  "fee_structure" text NOT NULL DEFAULT 'flat_fee',
  "percentage_rate" numeric,
  "hourly_rate" numeric,
  "phases" jsonb NOT NULL DEFAULT '[]',
  "total_fee" numeric NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'INR',
  "payment_schedule" text,
  "terms_and_conditions" text,
  "validity_days" integer NOT NULL DEFAULT 30,
  "status" text NOT NULL DEFAULT 'draft',
  "sent_at" timestamp,
  "accepted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
