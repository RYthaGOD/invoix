-- Migration: Add unique constraint on x402_payment_signature
-- Purpose: Prevent signature replay attacks (FIX #10 from security audit)
-- Supabase Compatible: Standard PostgreSQL ALTER TABLE

-- Note: This constraint must handle NULL values (multiple NULLs allowed)
-- PostgreSQL unique constraints naturally allow multiple NULL values

DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'invoices_x402_payment_signature_unique'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_x402_payment_signature_unique 
        UNIQUE (x402_payment_signature);
        RAISE NOTICE 'Created unique constraint on x402_payment_signature';
    ELSE
        RAISE NOTICE 'Constraint already exists, skipping';
    END IF;
END $$;
