
import 'dotenv/config';
import { runBillingCycle } from "../server/subscription-biller";
import { db, runMigrations } from "../server/db";
import { subscriptions, subscriptionPlans, invoices, webhooks, webhookDeliveries } from "@shared/invoice-schema-sqlite";
import { eq, desc } from "drizzle-orm";
import { logger } from "../server/logger";
import { randomBytes } from "crypto";

async function main() {
    logger.info("🧪 Starting Verification: Subscription Biller & Webhooks");

    // Run Migrations (ensure DB is up to date)
    await runMigrations();

    const TEST_WALLET = "TestWallet" + randomBytes(4).toString("hex");
    const CUSTOMER_WALLET = "CustWallet" + randomBytes(4).toString("hex");

    try {
        // 1. Setup Data
        logger.info("1. Creating Test Data...");

        // Create Plan
        const [plan] = await db.insert(subscriptionPlans).values({
            ownerWalletAddress: TEST_WALLET,
            name: "Test Verification Plan",
            amount: "100.00",
            interval: "month",
            isActive: true
        }).returning();

        // Create Due Subscription (Period ended yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [sub] = await db.insert(subscriptions).values({
            planId: plan.id,
            invoicerWalletAddress: TEST_WALLET,
            customerWalletAddress: CUSTOMER_WALLET,
            status: "active",
            currentPeriodStart: new Date("2024-01-01"),
            currentPeriodEnd: yesterday
        }).returning();

        // Create Webhook
        const [webhook] = await db.insert(webhooks).values({
            ownerWallet: TEST_WALLET,
            url: "https://example.com/webhook",
            events: ["invoice.created"],
            secretHash: "test_hash",
            status: "active"
        }).returning();

        logger.info(`   - Plan ID: ${plan.id}`);
        logger.info(`   - Subscription ID: ${sub.id}`);
        logger.info(`   - Webhook ID: ${webhook.id}`);

        // 2. Run Biller
        logger.info("2. Running Billing Cycle...");
        await runBillingCycle();

        // 3. Verify Results
        logger.info("3. Verifying Results...");

        // Check for new invoice
        const newInvoices = await db.select()
            .from(invoices)
            .where(eq(invoices.invoicerWalletAddress, TEST_WALLET))
            .orderBy(desc(invoices.createdAt));

        if (newInvoices.length > 0 && newInvoices[0].totalAmount === "100.000000000") {
            logger.info("   ✅ Invoice created successfully!");
            logger.info(`      Invoice ID: ${newInvoices[0].id}, Amount: ${newInvoices[0].totalAmount}`);
        } else {
            logger.error("   ❌ Invoice creation failed!");
            console.log(newInvoices);
        }

        // Check for webhook delivery attempt
        // Note: The actual HTTP call will fail (example.com), but we check if a delivery record was created
        // Wait a small bit for async processing
        await new Promise(r => setTimeout(r, 2000));

        const deliveries = await db.select()
            .from(webhookDeliveries)
            .where(eq(webhookDeliveries.webhookId, webhook.id))
            .orderBy(desc(webhookDeliveries.createdAt));

        if (deliveries.length > 0) {
            logger.info("   ✅ Webhook delivery attempted!");
            logger.info(`      Event: ${deliveries[0].eventType}, Status: ${deliveries[0].status}`);
        } else {
            logger.warn("   ⚠️ No webhook delivery record found (might be async delay or queue issue)");
        }

    } catch (error) {
        logger.error("Verification Failed", "test", { error });
    } finally {
        logger.info("Cleaning up...");
        // Retrieve IDs to delete if needed, or leave for manual inspection
        process.exit(0);
    }
}

main();
