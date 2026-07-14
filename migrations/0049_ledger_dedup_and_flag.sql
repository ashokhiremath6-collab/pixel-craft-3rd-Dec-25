-- 1. Delete duplicate vendor_payment rows: keep the earliest, drop the rest
DELETE FROM vendor_payments
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY vendor_id, payment_reference
             ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
    FROM vendor_payments
    WHERE payment_reference IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- 2. Add ledger_added flag to payment_requests (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_requests' AND column_name = 'ledger_added'
  ) THEN
    ALTER TABLE payment_requests ADD COLUMN ledger_added boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Backfill: mark confirmed requests as ledger_added when a vendor_payment
--    already exists with the same UTR/reference
UPDATE payment_requests pr
SET ledger_added = true
WHERE pr.status = 'confirmed'
  AND pr.ledger_added = false
  AND EXISTS (
    SELECT 1 FROM vendor_payments vp
    WHERE vp.vendor_id = pr.vendor_id
      AND vp.payment_reference = COALESCE(pr.client_utr, 'PR-' || UPPER(SUBSTRING(pr.id, 1, 8)))
  );
