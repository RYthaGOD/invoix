-- Migration: Add Arcium transaction signature tracking
-- Stores the transaction signature when invoice PDA is created on-chain

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS arcium_tx_signature VARCHAR(88);

-- Index for transaction lookups
CREATE INDEX IF NOT EXISTS idx_invoices_arcium_tx ON invoices(arcium_tx_signature) WHERE arcium_tx_signature IS NOT NULL;
