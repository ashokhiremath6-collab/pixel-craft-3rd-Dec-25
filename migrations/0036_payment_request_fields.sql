ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "invoice_value" numeric(12, 2);
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "remarks" text;
