CREATE TABLE IF NOT EXISTS vendor_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id VARCHAR NOT NULL,
  org_id VARCHAR NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size DECIMAL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);
