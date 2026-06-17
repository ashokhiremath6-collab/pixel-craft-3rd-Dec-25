-- Add vendor_id to users table (links a vendor-role user to their vendor record)
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_id varchar;

-- Add vendor_id to invitations table (required when inviting a vendor)
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS vendor_id varchar;
