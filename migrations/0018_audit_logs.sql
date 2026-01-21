-- Migration: Add Audit Logs Table
-- Creates audit_logs table for security tracking and compliance

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"user_id" text,
	"resource_id" text,
	"access_granted" boolean NOT NULL,
	"ip_address" text,
	"details" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_timestamp_idx" ON "audit_logs" ("timestamp");
