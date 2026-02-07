-- Migration: Add NZ Business Fields and Encryption Columns

-- Up Migration

-- 1. update business_profiles table
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "nzbn" text UNIQUE;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "gst_number" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "is_gst_registered" boolean DEFAULT false;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "industry_code" text;

-- 2. update invoices table for encryption
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_encrypted" boolean DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "encrypted_data" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "encryption_iv" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "magic_block_state_id" text;

-- 3. clean up arcium columns (optional, keeping for safety or remove if confirmed)
-- ALTER TABLE "invoices" DROP COLUMN IF EXISTS "is_arcium_encrypted";
-- ALTER TABLE "invoices" DROP COLUMN IF EXISTS "arcium_encrypted_data";
-- ALTER TABLE "invoices" DROP COLUMN IF EXISTS "arcium_encryption_key";
-- ALTER TABLE "invoices" DROP COLUMN IF EXISTS "arcium_computation_id";
-- ALTER TABLE "invoices" DROP COLUMN IF EXISTS "arcium_allowed_parties";

-- Down Migration (Implicitly handled by Drizzle usually, but good for ref)
-- ALTER TABLE "business_profiles" DROP COLUMN "nzbn";
-- ... (etc)
