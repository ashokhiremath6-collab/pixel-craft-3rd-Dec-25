-- Add linked_vendor_id to user_roles so a vendor user account can be
-- associated with a specific vendor record in the vendors table.
-- This column is nullable — only set for users with role = 'vendor'.
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS linked_vendor_id varchar
    REFERENCES vendors(id) ON DELETE SET NULL;
