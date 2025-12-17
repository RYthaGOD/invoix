CREATE TABLE "special_nft_mints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"nft_id" text NOT NULL,
	"nft_name" text NOT NULL,
	"nft_rarity" text NOT NULL,
	"nft_mint" text NOT NULL,
	"tx_signature" text NOT NULL,
	"invoice_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "special_nft_mints_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "payment_receipt_nfts" ADD COLUMN "nft_merkle_tree" text;--> statement-breakpoint
ALTER TABLE "payment_receipt_nfts" ADD COLUMN "nft_leaf_index" integer;--> statement-breakpoint
CREATE INDEX "special_nft_wallet_idx" ON "special_nft_mints" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "special_nft_rarity_idx" ON "special_nft_mints" USING btree ("nft_rarity");