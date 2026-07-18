CREATE TABLE "project_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" varchar NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "org_id" varchar,
  "author_id" varchar NOT NULL REFERENCES "users"("id"),
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "project_messages_project_idx" ON "project_messages" ("project_id");
CREATE INDEX "project_messages_org_idx" ON "project_messages" ("org_id");
