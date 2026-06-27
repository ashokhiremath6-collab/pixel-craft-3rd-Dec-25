ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS client_token varchar UNIQUE;

UPDATE payment_requests
  SET client_token = gen_random_uuid()::varchar
  WHERE client_token IS NULL;
