CREATE TABLE "analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"path" text,
	"wallet_address" text,
	"visitor_hash" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"email" text NOT NULL,
	"project_name" text NOT NULL,
	"use_case_description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"api_key_hash" text,
	"rate_limit_tier" text DEFAULT 'standard' NOT NULL,
	"requests_count" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "nft_receipt_minted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_x402_payment_signature_unique" UNIQUE("x402_payment_signature");