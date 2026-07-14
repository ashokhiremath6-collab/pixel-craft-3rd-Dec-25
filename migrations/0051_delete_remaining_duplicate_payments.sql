-- Remove the duplicate vendor_payment created on 2026-07-14 when the
-- Focus Lighting / Maker Tower payment request was re-confirmed while the
-- ledger_added column was missing.  Keeps the earliest row per
-- (vendor_id, payment_reference) pair.
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
