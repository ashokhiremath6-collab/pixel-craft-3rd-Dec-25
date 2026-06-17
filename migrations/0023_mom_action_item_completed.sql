ALTER TABLE "meeting_action_items" ADD COLUMN IF NOT EXISTS "completed" boolean NOT NULL DEFAULT false;
