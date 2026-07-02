ALTER TABLE vendor_payments ADD COLUMN IF NOT EXISTS project_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_payments_project_id ON vendor_payments(project_id);
