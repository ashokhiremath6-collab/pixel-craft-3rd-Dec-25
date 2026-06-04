-- Working Drawings rebuild: six new tables
-- rooms, drawings, drawing_revisions, drawing_approvals, revision_events, drawing_comments

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "room_type" text NOT NULL,
  "display_order" integer,
  "notes" text,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_org_id_idx" ON "rooms" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_project_id_idx" ON "rooms" ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_project_name_unique" ON "rooms" ("project_id", "name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "room_id" varchar REFERENCES "rooms"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "category" text NOT NULL,
  "discipline" text NOT NULL DEFAULT 'Interior',
  "drawing_number" text,
  "description" text,
  "status" text NOT NULL DEFAULT 'planned',
  "is_template_placeholder" boolean NOT NULL DEFAULT false,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawings_org_id_idx" ON "drawings" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawings_project_id_idx" ON "drawings" ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drawings_project_room_title_unique" ON "drawings" ("project_id", "room_id", "title") WHERE "room_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drawings_project_title_noroom_unique" ON "drawings" ("project_id", "title") WHERE "room_id" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawing_revisions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "drawing_id" varchar NOT NULL REFERENCES "drawings"("id") ON DELETE CASCADE,
  "revision_letter" text NOT NULL,
  "file_path" text NOT NULL,
  "file_name" text NOT NULL,
  "file_size" bigint NOT NULL,
  "file_mime_type" text NOT NULL,
  "state" text NOT NULL,
  "revision_note" text,
  "uploaded_by" varchar REFERENCES "users"("id"),
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  "issued_at" timestamp,
  "approved_at" timestamp,
  "superseded_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_revisions_org_id_idx" ON "drawing_revisions" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_revisions_drawing_id_idx" ON "drawing_revisions" ("drawing_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drawing_revisions_drawing_letter_unique" ON "drawing_revisions" ("drawing_id", "revision_letter");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawing_approvals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "revision_id" varchar NOT NULL REFERENCES "drawing_revisions"("id") ON DELETE RESTRICT,
  "approved_by" varchar NOT NULL REFERENCES "users"("id"),
  "approved_at" timestamp DEFAULT now() NOT NULL,
  "approver_ip" text,
  "approver_user_agent" text,
  "approval_comment" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_approvals_org_id_idx" ON "drawing_approvals" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_approvals_revision_id_idx" ON "drawing_approvals" ("revision_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revision_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "revision_id" varchar NOT NULL REFERENCES "drawing_revisions"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "actor_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "payload" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revision_events_org_id_idx" ON "revision_events" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revision_events_revision_id_idx" ON "revision_events" ("revision_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drawing_comments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" varchar NOT NULL,
  "revision_id" varchar NOT NULL REFERENCES "drawing_revisions"("id") ON DELETE CASCADE,
  "parent_comment_id" varchar,
  "author_id" varchar NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "edited_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_parent_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "drawing_comments"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_comments_org_id_idx" ON "drawing_comments" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drawing_comments_revision_id_idx" ON "drawing_comments" ("revision_id");
