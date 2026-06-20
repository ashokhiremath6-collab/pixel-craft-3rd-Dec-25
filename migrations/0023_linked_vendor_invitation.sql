-- Allow an invitation to carry a linked_vendor_id so that when a vendor
-- user accepts the invite their account is automatically connected to the
-- correct vendor record without needing a second manual step.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS linked_vendor_id varchar
    REFERENCES vendors(id) ON DELETE SET NULL;
