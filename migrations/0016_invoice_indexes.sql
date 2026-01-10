-- Migration: Invoice Performance Indexes
-- Date: 2026-01-10
-- Description: Add missing indexes for invoice dashboard and payment history performance

-- Invoice Dashboard Performance
-- Sort by Due Date (e.g. "Due Soon" view)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date 
ON invoices(due_date ASC);

-- Sort by Created At (Default list view)
CREATE INDEX IF NOT EXISTS idx_invoices_created_at 
ON invoices(created_at DESC);

-- Compound Index for "My Invoices" status views
-- e.g. "Show me all my PAID invoices"
CREATE INDEX IF NOT EXISTS idx_invoices_invoicer_status_created 
ON invoices(invoicer_wallet_address, status, created_at DESC);

-- Payment History Performance
-- Fast lookup of all payments for a specific invoice
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
ON payments(invoice_id, confirmed_at DESC);

-- Analytics / Reporting
-- Group by currency for quick totals
CREATE INDEX IF NOT EXISTS idx_invoices_currency_amount 
ON invoices(currency, total_amount);
