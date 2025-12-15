ALTER TABLE "invoices" ADD COLUMN "privacy_salt" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "usd_value_at_payment" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "is_business_expense" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "invoicer_wallet_idx" ON "invoices" USING btree ("invoicer_wallet_address");--> statement-breakpoint
CREATE INDEX "invoicee_wallet_idx" ON "invoices" USING btree ("invoicee_wallet_address");--> statement-breakpoint
CREATE INDEX "status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "invoices" USING btree ("created_at");