---
name: Per-file quote amounts
description: Why and how quote amounts are stored per-file for vendor portal submissions
---

## The rule
When a vendor uploads multiple PDFs for the same project-vendor slot, each file must have its own `quoted_amount` stored in `quote_files.quoted_amount`. Do NOT rely solely on `project_vendors.quotation_value` for display — it is a single shared value.

## Why
`project_vendors.quotation_value` is one value per vendor-project pair. Two uploaded files (e.g. "Quote for All Rooms" and "Quote for Railing") would show the same amount on both display rows, confusing admins.

## How to apply
- On portal submit: parse each PDF individually → store result in `quote_files.quoted_amount` via `UPDATE quote_files SET quoted_amount = ... WHERE id = ...`
- GET /api/quotations: for portal file rows, use `file.quotedAmount` when non-null; fall back to `pv.quotationValue`
- Each row in the display includes `quoteFileId`
- Edit flow in ComparativeQuotes.tsx: if `quoteFileId` is set → PATCH `/api/quote-files/:id`; otherwise → PUT `/api/project-vendors/:id`
- Migration: `0028_quote_file_amount.sql` — `ALTER TABLE quote_files ADD COLUMN quoted_amount decimal`
