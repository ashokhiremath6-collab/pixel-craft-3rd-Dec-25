ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS acknowledged_at timestamp;
