CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"user_id" text,
	"resource_id" text,
	"access_granted" boolean NOT NULL,
	"ip_address" text,
	"details" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_access_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"buyer_wallet" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_marketplace" ADD COLUMN "is_blind" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "arcium_tx_signature" text;--> statement-breakpoint
ALTER TABLE "marketplace_access_requests" ADD CONSTRAINT "marketplace_access_requests_listing_id_invoice_marketplace_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."invoice_marketplace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_access_req_listing" ON "marketplace_access_requests" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_access_req_buyer" ON "marketplace_access_requests" USING btree ("buyer_wallet");--> statement-breakpoint
CREATE INDEX "idx_marketplace_blind" ON "invoice_marketplace" USING btree ("is_blind");