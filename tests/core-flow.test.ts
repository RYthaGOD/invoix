import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { createRequire } from "module";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schemaSqlite from "../shared/invoice-schema-sqlite";
import { eq } from "drizzle-orm";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");

// 1. Setup In-Memory SQLite DB
let sqlite: any;
try {
    sqlite = new Database(":memory:");
} catch (e) {
    console.error("Failed to init SQLite:", e);
    throw e;
}
// sqlite.pragma("foreign_keys = ON"); // Optional for test speed/simplicity
const testDb = drizzle(sqlite, { schema: schemaSqlite });

// 2. Mock Schema (Service Layer will use SQLite tables)
vi.mock("../shared/invoice-schema", async () => {
    return await import("../shared/invoice-schema-sqlite");
});

// 3. Mock DB Module (Service Layer will use our testDb)
vi.mock("../server/db", () => ({
    db: testDb,
    schema: schemaSqlite
}));

// Import Service AFTER mocks are established
import { CreditScoringService } from "../server/credit-scoring-service";
import { invoices, payments, businessCreditScores } from "../shared/invoice-schema-sqlite"; // Import correct types locally

// Test Data
const WALLET_A = "WalletA_Test_11111111111111111111111111111111"; // Seller
const WALLET_B = "WalletB_Test_22222222222222222222222222222222"; // Buyer

describe("Core System Flow Integration", () => {
    const creditService = new CreditScoringService();

    // Init DB Tables via SQLite "push" (Manual creation since we are in-memory)
    beforeAll(async () => {
        // Simple way to create tables: Use the Drizzle Kit 'generate' output or just SQL strings
        // Since we don't have the SQL strings handy, use the migrate helper?
        // SQLite in-memory needs 'migrate' to run.
        // We can manually run CREATE TABLE statements for the tables we need.
        // Or better: use 'drizzle-orm/better-sqlite3/migrator' if we had migrations.

        // Alternative: Use Drizzle's 'sqliteTable' features to create? No.

        // Let's execute the raw SQL to create the 3 tables we need.
        sqlite.exec(`
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                invoice_number TEXT NOT NULL UNIQUE,
                invoicer_wallet_address TEXT NOT NULL,
                invoicee_wallet_address TEXT NOT NULL,
                invoice_date INTEGER NOT NULL DEFAULT (unixepoch()),
                due_date INTEGER NOT NULL,
                description TEXT,
                currency TEXT NOT NULL DEFAULT 'USDC',
                total_amount TEXT NOT NULL,
                remaining_amount TEXT NOT NULL,
                subtotal TEXT NOT NULL DEFAULT '0', -- Added default
                status TEXT NOT NULL DEFAULT 'draft',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
                
                -- Extra fields to satisfy schema
                notes TEXT,
                token_mint TEXT,
                token_decimals INTEGER DEFAULT 6,
                tax_amount TEXT DEFAULT '0',
                discount_amount TEXT DEFAULT '0',
                paid_amount TEXT DEFAULT '0',
                payment_terms TEXT,
                payment_instructions TEXT,
                is_private INTEGER DEFAULT 1,
                hide_amounts INTEGER DEFAULT 1,
                hide_parties INTEGER DEFAULT 1,
                is_arcium_encrypted INTEGER DEFAULT 0,
                x402_service_fee_usd TEXT DEFAULT '0.01',
                x402_fee_paid INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL REFERENCES invoices(id),
                payment_number TEXT NOT NULL,
                amount TEXT NOT NULL,
                currency TEXT NOT NULL,
                from_address TEXT NOT NULL,
                to_address TEXT NOT NULL,
                tx_signature TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'pending',
                confirmed_at INTEGER,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                
                -- Extra fields
                payment_method TEXT DEFAULT 'solana',
                confirmations INTEGER DEFAULT 0,
                is_business_expense INTEGER DEFAULT 0,
                is_arcium_encrypted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS business_credit_scores (
                id TEXT PRIMARY KEY,
                wallet_address TEXT NOT NULL UNIQUE,
                overall_score INTEGER NOT NULL DEFAULT 500,
                credit_tier TEXT NOT NULL DEFAULT 'new',
                
                payment_history_score INTEGER DEFAULT 500,
                volume_score INTEGER DEFAULT 500,
                reliability_score INTEGER DEFAULT 500,
                tenure_score INTEGER DEFAULT 500,

                total_payments_made INTEGER DEFAULT 0,
                on_time_payments INTEGER DEFAULT 0,
                late_payments INTEGER DEFAULT 0,
                avg_days_to_pay INTEGER,
                last_payment_date INTEGER,

                total_volume_usd TEXT DEFAULT '0',
                total_invoices_issued INTEGER DEFAULT 0,
                total_invoices_received INTEGER DEFAULT 0,
                unique_counterparties INTEGER DEFAULT 0,

                paid_invoices INTEGER DEFAULT 0,
                cancelled_invoices INTEGER DEFAULT 0,
                avg_days_to_collect INTEGER,
                top_customer_share TEXT DEFAULT '0',

                first_activity_at INTEGER,
                months_with_activity INTEGER DEFAULT 0,

                disputes_as_payer INTEGER DEFAULT 0,
                disputes_as_seller INTEGER DEFAULT 0,

                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
                last_calculated_at INTEGER NOT NULL DEFAULT (unixepoch())
            );
        `);
    });

    // Clear data between tests
    beforeEach(async () => {
        await testDb.delete(invoices);
        await testDb.delete(payments);
        await testDb.delete(businessCreditScores);
    });

    it("should create credit profiles when invoice is created", async () => {
        // 1. Simulate Invoice Creation
        const amount = "1000"; // $1000 USD
        const [invoice] = await testDb.insert(invoices).values({
            invoicerWalletAddress: WALLET_A,
            invoiceeWalletAddress: WALLET_B,
            invoiceNumber: "TEST-001",
            totalAmount: amount,
            remainingAmount: amount,
            subtotal: amount,
            status: "sent",
            dueDate: new Date(),
            currency: "USD",
            description: "Test Invoice"
        }).returning();

        // 2. Trigger Event
        await creditService.updateScoreOnInvoiceCreated({
            invoicerWalletAddress: WALLET_A,
            invoiceeWalletAddress: WALLET_B,
            totalAmount: amount,
            currency: "USD"
        });

        // 3. Verify Seller (Wallet A) got volume credit
        const sellerScore = await creditService.getOrCreateCreditScore(WALLET_A);
        expect(Number(sellerScore.totalInvoicesIssued)).toBe(1);
        // Note: totalVolumeUsd might be string or number depending on driver, casting to Number for safety
        expect(Number(sellerScore.totalVolumeUsd)).toBe(1000);

        // 4. Verify Buyer (Wallet B) got activity credit
        const buyerScore = await creditService.getOrCreateCreditScore(WALLET_B);
        expect(Number(buyerScore.totalInvoicesReceived)).toBe(1);
    });

    it("should update scores when payment is made", async () => {
        // 1. Fetch the invoice from previous test (or create new)
        const [invoice] = await testDb.select().from(invoices).where(eq(invoices.invoiceNumber, "TEST-001"));
        expect(invoice).toBeDefined();

        // 2. Simulate Payment
        const paymentDate = new Date();
        const [payment] = await testDb.insert(payments).values({
            invoiceId: invoice.id,
            paymentNumber: "PAY-001",
            amount: invoice.totalAmount,
            currency: "USD",
            fromAddress: WALLET_B,
            toAddress: WALLET_A,
            txSignature: "test_sig_" + Date.now(),
            status: "confirmed",
            confirmedAt: paymentDate
        }).returning();

        // 3. Trigger Payment Event
        await creditService.updateScoreOnPayment({
            fromAddress: WALLET_B,
            toAddress: WALLET_A,
            amount: invoice.totalAmount,
            invoiceDueDate: new Date(invoice.dueDate),
            paidAt: paymentDate
        });

        // 4. Verify Payer (Wallet B) gets payment history points
        const payerScore = await creditService.getOrCreateCreditScore(WALLET_B);
        expect(Number(payerScore.totalPaymentsMade)).toBe(1);
        expect(Number(payerScore.onTimePayments)).toBe(1);

        // 5. Verify Seller (Wallet A) gets fulfillment reliability points
        const sellerScore = await creditService.getOrCreateCreditScore(WALLET_A);
        expect(Number(sellerScore.paidInvoices)).toBe(1);

        // 6. Full Recalculation Check
        // Trigger a full calc to ensure the algorithm itself works with this data
        const fullScore = await creditService.calculateCreditScore(WALLET_B);
        expect(fullScore.overallScore).toBeGreaterThan(300); // Should be better than min
        expect(fullScore.components.paymentHistory).toBeGreaterThan(0);
    });
});
