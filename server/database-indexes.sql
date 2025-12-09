-- Database Performance Indexes
-- Run these after initial schema migration for optimal query performance

-- Invoice indexes (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_invoices_invoicer_status 
  ON invoices(invoicerWalletAddress, status);

CREATE INDEX IF NOT EXISTS idx_invoices_invoicee_status 
  ON invoices(invoiceeWalletAddress, status);

CREATE INDEX IF NOT EXISTS idx_invoices_status 
  ON invoices(status) WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_invoices_due_date 
  ON invoices(dueDate) WHERE status IN ('sent', 'viewed', 'partial');

CREATE INDEX IF NOT EXISTS idx_invoices_created_at 
  ON invoices(createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number 
  ON invoices(invoiceNumber);

CREATE INDEX IF NOT EXISTS idx_invoices_currency 
  ON invoices(currency);

-- Invoice line items (for JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id 
  ON invoice_line_items(invoiceId);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
  ON payments(invoiceId);

CREATE INDEX IF NOT EXISTS idx_payments_from_address 
  ON payments(fromAddress);

CREATE INDEX IF NOT EXISTS idx_payments_to_address 
  ON payments(toAddress);

CREATE INDEX IF NOT EXISTS idx_payments_tx_signature 
  ON payments(txSignature);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at 
  ON payments(paidAt DESC);

-- Business profiles (wallet lookup)
CREATE INDEX IF NOT EXISTS idx_business_profiles_wallet 
  ON business_profiles(walletAddress);

-- Customer profiles (wallet lookup)
CREATE INDEX IF NOT EXISTS idx_customer_profiles_business_wallet 
  ON customer_profiles(businessWalletAddress, walletAddress);

-- Payment receipt NFTs (tax year queries)
CREATE INDEX IF NOT EXISTS idx_payment_receipt_nfts_owner_tax_year 
  ON payment_receipt_nfts(nftOwner, taxYear);

CREATE INDEX IF NOT EXISTS idx_payment_receipt_nfts_payment_id 
  ON payment_receipt_nfts(paymentId);

-- Business identity NFTs (duplicate check)
CREATE INDEX IF NOT EXISTS idx_business_identity_nfts_profile_id 
  ON business_identity_nfts(businessProfileId);

-- Transactions (legacy, but still used)
CREATE INDEX IF NOT EXISTS idx_transactions_project_id 
  ON transactions(projectId);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
  ON transactions(createdAt DESC);

-- x402 Micropayments (monitoring)
CREATE INDEX IF NOT EXISTS idx_x402_micropayments_owner 
  ON x402_micropayments(ownerWalletAddress, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_x402_micropayments_status 
  ON x402_micropayments(status, createdAt DESC);

-- Composite index for common invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_wallet_status_date 
  ON invoices(invoicerWalletAddress, status, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_invoicee_wallet_status_date 
  ON invoices(invoiceeWalletAddress, status, createdAt DESC);

-- Analyze tables to update query planner statistics
ANALYZE invoices;
ANALYZE invoice_line_items;
ANALYZE payments;
ANALYZE business_profiles;
ANALYZE customer_profiles;
ANALYZE payment_receipt_nfts;
ANALYZE business_identity_nfts;
