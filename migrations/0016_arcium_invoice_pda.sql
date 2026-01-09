-- Migration: Add Arcium on-chain invoice PDA to invoices table
-- This stores the on-chain InvoiceAccount address for marketplace operations

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS arcium_invoice_pda TEXT;

-- Index for quick lookups when listing on marketplace
CREATE INDEX IF NOT EXISTS idx_invoices_arcium_pda ON invoices(arcium_invoice_pda) WHERE arcium_invoice_pda IS NOT NULL;
