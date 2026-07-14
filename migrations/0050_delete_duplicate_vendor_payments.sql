-- Delete duplicate vendor_payment rows: same vendor_id + same payment_reference.
-- Keeps the earliest-created row and removes all subsequent duplicates.
-- Safe to run multiple times (no-op when no duplicates exist).
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
