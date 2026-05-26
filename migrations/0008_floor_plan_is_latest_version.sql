ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS is_latest_version boolean DEFAULT false;
