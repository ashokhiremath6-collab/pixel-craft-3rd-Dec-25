ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "rfq_document_path" text;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "rfq_document_name" text;
