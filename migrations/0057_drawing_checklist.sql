-- Drawing checklist items: per-project overrides (only "not_required" is stored)
CREATE TABLE IF NOT EXISTS drawing_checklist_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id VARCHAR NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_required',
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(project_id, category)
);

CREATE INDEX IF NOT EXISTS drawing_checklist_project_idx ON drawing_checklist_items(project_id);
CREATE INDEX IF NOT EXISTS drawing_checklist_org_idx ON drawing_checklist_items(org_id);
