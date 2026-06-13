CREATE TABLE IF NOT EXISTS drawing_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawing_categories_org_id_idx ON drawing_categories (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS drawing_categories_org_name_unique ON drawing_categories (org_id, name);
