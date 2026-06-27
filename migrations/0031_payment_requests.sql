CREATE TABLE IF NOT EXISTS payment_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR,
  vendor_id VARCHAR NOT NULL REFERENCES vendors(id),
  project_id VARCHAR REFERENCES projects(id),
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by VARCHAR NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT now(),
  client_paid_at TIMESTAMP,
  client_utr TEXT,
  confirmed_at TIMESTAMP,
  confirmed_by VARCHAR REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_org_id ON payment_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_vendor_id ON payment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
