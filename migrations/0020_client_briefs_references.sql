ALTER TABLE "client_briefs"
ADD COLUMN IF NOT EXISTS "reference_files" jsonb NOT NULL DEFAULT '[]'::jsonb;
