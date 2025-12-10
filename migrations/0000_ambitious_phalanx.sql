CREATE TABLE "auth_nonces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"signature" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_nonces_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "business_identity_nfts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_profile_id" varchar NOT NULL,
	"nft_mint" text NOT NULL,
	"nft_metadata_uri" text NOT NULL,
	"nft_owner" text NOT NULL,
	"verification_level" text DEFAULT 'basic' NOT NULL,
	"verified_by" text,
	"verification_date" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"total_invoices_issued" integer DEFAULT 0 NOT NULL,
	"total_revenue_processed" numeric(18, 9),
	"business_rating" numeric(3, 2),
	"nft_mint_signature" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_identity_nfts_nft_mint_unique" UNIQUE("nft_mint")
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_wallet_address" text NOT NULL,
	"business_name" text NOT NULL,
	"business_email" text,
	"business_phone" text,
	"business_address" text,
	"business_website" text,
	"tax_id" text,
	"tax_registration_number" text,
	"logo_url" text,
	"brand_color" text DEFAULT '#3b82f6',
	"default_invoice_prefix" text DEFAULT 'INV',
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"default_payment_terms" text DEFAULT 'Net 30',
	"default_privacy_settings" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_owner_wallet_address_unique" UNIQUE("owner_wallet_address")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_wallet_address" text NOT NULL,
	"customer_wallet_address" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"customer_address" text,
	"customer_notes" text,
	"payment_terms" text DEFAULT 'Net 30',
	"total_invoices_sent" integer DEFAULT 0 NOT NULL,
	"total_amount_invoiced" numeric(18, 9) DEFAULT '0' NOT NULL,
	"total_amount_paid" numeric(18, 9) DEFAULT '0' NOT NULL,
	"average_payment_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 9) NOT NULL,
	"line_total" numeric(18, 9) NOT NULL,
	"tax_rate" numeric(5, 2),
	"discount_rate" numeric(5, 2),
	"sku" text,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_marketplace" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"nft_mint" text NOT NULL,
	"nft_merkle_tree" text NOT NULL,
	"nft_leaf_index" integer NOT NULL,
	"seller" text NOT NULL,
	"face_value" numeric(18, 9) NOT NULL,
	"asking_price" numeric(18, 9) NOT NULL,
	"discount_rate" numeric(5, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"listed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"sold_at" timestamp,
	"sold_to" text,
	"sale_price" numeric(18, 9),
	"sale_tx_signature" text,
	"listing_description" text,
	"min_buyer_rating" numeric(3, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_wallet_address" text NOT NULL,
	"default_currency" text DEFAULT 'USDC' NOT NULL,
	"default_token_mint_address" text NOT NULL,
	"default_payment_terms" text DEFAULT 'Net 30',
	"default_due_days" integer DEFAULT 30 NOT NULL,
	"default_line_items" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"invoicer_wallet_address" text NOT NULL,
	"invoicee_wallet_address" text NOT NULL,
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	"description" text,
	"notes" text,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"token_mint" text,
	"token_decimals" integer DEFAULT 6 NOT NULL,
	"subtotal" numeric(18, 9) NOT NULL,
	"tax_amount" numeric(18, 9) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 9) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 9) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paid_amount" numeric(18, 9) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(18, 9) NOT NULL,
	"payment_terms" text,
	"payment_instructions" text,
	"is_private" boolean DEFAULT true NOT NULL,
	"hide_amounts" boolean DEFAULT true NOT NULL,
	"hide_parties" boolean DEFAULT true NOT NULL,
	"is_arcium_encrypted" boolean DEFAULT false NOT NULL,
	"arcium_encrypted_data" text,
	"arcium_encryption_key" text,
	"arcium_computation_id" text,
	"arcium_allowed_parties" text[],
	"x402_service_fee_usd" numeric(18, 6) DEFAULT '0.01' NOT NULL,
	"x402_fee_paid" boolean DEFAULT false NOT NULL,
	"x402_payment_signature" text,
	"nft_mint" text,
	"nft_merkle_tree" text,
	"nft_leaf_index" integer,
	"nft_metadata_uri" text,
	"nft_minted_at" timestamp,
	"nft_transferred_to" text,
	"nft_burned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"paid_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payment_receipt_nfts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"nft_mint" text NOT NULL,
	"nft_metadata_uri" text NOT NULL,
	"nft_owner" text NOT NULL,
	"receipt_number" text NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"currency" text NOT NULL,
	"payment_date" timestamp NOT NULL,
	"tax_year" integer NOT NULL,
	"tx_signature" text NOT NULL,
	"nft_mint_signature" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipt_nfts_nft_mint_unique" UNIQUE("nft_mint"),
	CONSTRAINT "payment_receipt_nfts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"payment_number" text NOT NULL,
	"payment_method" text DEFAULT 'solana' NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"currency" text NOT NULL,
	"tx_signature" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"block_time" timestamp,
	"slot" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"is_arcium_encrypted" boolean DEFAULT false NOT NULL,
	"arcium_encrypted_data" text,
	"arcium_encryption_key" text,
	"payment_notes" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "payments_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x402_micropayments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_wallet_address" text NOT NULL,
	"payment_type" text NOT NULL,
	"resource_url" text NOT NULL,
	"amount_usdc" numeric(18, 6) NOT NULL,
	"amount_micro_usdc" text NOT NULL,
	"tx_signature" text NOT NULL,
	"network" text DEFAULT 'solana-mainnet' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"x402_version" integer DEFAULT 1 NOT NULL,
	"payment_scheme" text DEFAULT 'exact' NOT NULL,
	"facilitator_url" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "business_identity_nfts" ADD CONSTRAINT "business_identity_nfts_business_profile_id_business_profiles_id_fk" FOREIGN KEY ("business_profile_id") REFERENCES "public"."business_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_marketplace" ADD CONSTRAINT "invoice_marketplace_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipt_nfts" ADD CONSTRAINT "payment_receipt_nfts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipt_nfts" ADD CONSTRAINT "payment_receipt_nfts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;