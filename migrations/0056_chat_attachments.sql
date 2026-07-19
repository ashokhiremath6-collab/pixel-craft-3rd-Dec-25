ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE project_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
