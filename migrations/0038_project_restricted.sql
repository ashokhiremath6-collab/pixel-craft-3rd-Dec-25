ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false;
