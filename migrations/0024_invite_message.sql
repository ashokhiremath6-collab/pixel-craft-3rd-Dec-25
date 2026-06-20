-- Store an optional quote-request message with vendor invitations so the
-- context for the quote is preserved and can be shown to the vendor on login.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS invite_message text;
