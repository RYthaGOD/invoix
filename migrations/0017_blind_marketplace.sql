-- Migration: Add Blind Marketplace Features
-- Adds is_blind column to invoice_marketplace and creates marketplace_access_requests table

-- 1. Add is_blind column to invoice_marketplace
ALTER TABLE "invoice_marketplace" ADD COLUMN "is_blind" boolean DEFAULT false NOT NULL;

-- 2. Create marketplace_access_requests table
CREATE TABLE IF NOT EXISTS "marketplace_access_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL REFERENCES "invoice_marketplace"("id") ON DELETE CASCADE,
	"buyer_wallet" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- 3. Create indexes for new table
CREATE INDEX IF NOT EXISTS "idx_marketplace_blind" ON "invoice_marketplace" ("is_blind");
CREATE INDEX IF NOT EXISTS "idx_access_req_listing" ON "marketplace_access_requests" ("listing_id");
CREATE INDEX IF NOT EXISTS "idx_access_req_buyer" ON "marketplace_access_requests" ("buyer_wallet");
