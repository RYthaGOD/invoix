-- Migration: Add Business Credit Scores for Invoice Marketplace
-- Created: 2026-01-05

-- Business Credit Scores Table
-- Stores credit scoring data for marketplace eligibility and risk assessment
CREATE TABLE IF NOT EXISTS business_credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  
  -- Overall Score (300-850)
  overall_score INTEGER NOT NULL DEFAULT 500,
  credit_tier TEXT NOT NULL DEFAULT 'new', -- prime, standard, fair, developing, new
  
  -- Component Scores (300-850 each)
  payment_history_score INTEGER NOT NULL DEFAULT 500,
  volume_score INTEGER NOT NULL DEFAULT 500,
  reliability_score INTEGER NOT NULL DEFAULT 500,
  tenure_score INTEGER NOT NULL DEFAULT 500,
  
  -- Payment History Metrics (as payer)
  total_payments_made INTEGER NOT NULL DEFAULT 0,
  on_time_payments INTEGER NOT NULL DEFAULT 0,
  late_payments INTEGER NOT NULL DEFAULT 0,
  avg_days_to_pay INTEGER,
  last_payment_date TIMESTAMP,
  
  -- Volume Metrics
  total_volume_usd DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_invoices_issued INTEGER NOT NULL DEFAULT 0,
  total_invoices_received INTEGER NOT NULL DEFAULT 0,
  unique_counterparties INTEGER NOT NULL DEFAULT 0,
  
  -- Reliability Metrics (as seller)
  paid_invoices INTEGER NOT NULL DEFAULT 0,
  cancelled_invoices INTEGER NOT NULL DEFAULT 0,
  avg_days_to_collect INTEGER,
  top_customer_share DECIMAL(5,4) DEFAULT 0, -- 0-1 concentration
  
  -- Tenure Metrics
  first_activity_at TIMESTAMP,
  months_with_activity INTEGER NOT NULL DEFAULT 0,
  
  -- Dispute Tracking
  disputes_as_payer INTEGER NOT NULL DEFAULT 0,
  disputes_as_seller INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_calculated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_credit_scores_wallet ON business_credit_scores(wallet_address);
CREATE INDEX IF NOT EXISTS idx_credit_scores_tier ON business_credit_scores(credit_tier);
CREATE INDEX IF NOT EXISTS idx_credit_scores_score ON business_credit_scores(overall_score DESC);

-- Enhance invoice_marketplace table with risk and credit metrics
ALTER TABLE invoice_marketplace 
  ADD COLUMN IF NOT EXISTS risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS risk_flags TEXT[],
  ADD COLUMN IF NOT EXISTS seller_credit_score INTEGER,
  ADD COLUMN IF NOT EXISTS seller_credit_tier TEXT,
  ADD COLUMN IF NOT EXISTS customer_credit_score INTEGER,
  ADD COLUMN IF NOT EXISTS suggested_floor_price DECIMAL(18,9),
  ADD COLUMN IF NOT EXISTS yield_percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watchlist_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(18,9),
  ADD COLUMN IF NOT EXISTS days_to_settlement INTEGER;

-- Add 'listed' status support to invoices
-- Note: PostgreSQL doesn't have native ENUM, status is already TEXT
-- We just need to ensure validity in application layer

-- Index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON invoice_marketplace(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_risk ON invoice_marketplace(risk_level);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON invoice_marketplace(seller);
