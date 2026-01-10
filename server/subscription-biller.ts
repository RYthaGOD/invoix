
/**
 * Subscription Biller
 * 
 * Auto-generates invoices for active subscriptions when their period ends.
 * - Runs daily
 * - Creates 'sent' invoice
 * - Updates subscription 'currentPeriodEnd'
 * - Emits 'invoice.created' webhook
 */

import cron from 'node-cron';
import { db, schema } from './db';
import { eq, and, lt, sql } from 'drizzle-orm';
import { logger } from './logger';
import { emitWebhookEvent, WEBHOOK_EVENTS } from './webhook-service';
import { randomBytes } from 'crypto';

export async function runBillingCycle() {
    logger.info('Starting subscription billing cycle...', 'biller');
    let processedCount = 0;
    let diffCount = 0;

    try {
        const now = new Date();

        // 1. Find due subscriptions
        const dueSubscriptions = await db.select()
            .from(schema.subscriptions)
            .where(and(
                eq(schema.subscriptions.status, 'active'),
                lt(schema.subscriptions.currentPeriodEnd, now)
            ));

        logger.info(`Found ${dueSubscriptions.length} subscriptions due for renewal`, 'biller');

        for (const sub of dueSubscriptions) {
            try {
                // Fetch Plan Details to get amount
                const [plan] = await db.select()
                    .from(schema.subscriptionPlans)
                    .where(eq(schema.subscriptionPlans.id, sub.planId));

                if (!plan) {
                    logger.error(`Plan not found for subscription ${sub.id}`, 'biller');
                    continue;
                }

                // Create Invoice
                // Calculate new period
                const currentEnd = new Date(sub.currentPeriodEnd);
                const newPeriodEnd = new Date(currentEnd);

                if (plan.interval === 'month') {
                    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
                } else if (plan.interval === 'year') {
                    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
                } else {
                    // Default 30 days
                    newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
                }

                // Generate Deterministic Invoice Number for Idempotency
                // Format: SUB-{SubscriptionID}-{PeriodEndDate}
                // This ensures that if the biller runs twice, the second insert fails on unique constraint
                const periodDateStr = currentEnd.toISOString().split('T')[0];
                const invNum = `SUB-${sub.id.slice(0, 8)}-${periodDateStr.replace(/-/g, '')}`;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // 7 days to pay

                // Insert Invoice
                const [newInvoice] = await db.insert(schema.invoices).values({
                    invoicerWalletAddress: sub.invoicerWalletAddress,
                    invoiceeWalletAddress: sub.customerWalletAddress,
                    invoiceNumber: invNum,
                    description: `Renewal for ${plan.name} (${currentEnd.toISOString().split('T')[0]} to ${newPeriodEnd.toISOString().split('T')[0]})`,
                    currency: 'USDC', // Default to USDC for now, should ideally be plan currency
                    subtotal: plan.amount,
                    totalAmount: plan.amount, // Plan amount
                    remainingAmount: plan.amount,
                    dueDate: dueDate,
                    status: 'sent', // Auto-sent
                }).returning();

                // Insert Line Items
                await db.insert(schema.invoiceLineItems).values({
                    invoiceId: newInvoice.id,
                    lineNumber: 1,
                    description: plan.name,
                    quantity: "1",
                    unitPrice: plan.amount,
                    lineTotal: plan.amount
                });

                // Update Subscription
                await db.update(schema.subscriptions)
                    .set({
                        currentPeriodStart: currentEnd,
                        currentPeriodEnd: newPeriodEnd,
                        version: sql`${schema.subscriptions.version} + 1`
                    })
                    .where(eq(schema.subscriptions.id, sub.id));

                // Emit Webhook
                await emitWebhookEvent(
                    sub.invoicerWalletAddress,
                    WEBHOOK_EVENTS.INVOICE_CREATED,
                    {
                        invoiceId: newInvoice.id,
                        invoiceNumber: newInvoice.invoiceNumber,
                        amount: newInvoice.totalAmount,
                        currency: newInvoice.currency,
                        subscriptionId: sub.id,
                        isRenewal: true
                    }
                );

                processedCount++;
                logger.info(`Generated renewal invoice ${newInvoice.id} for subscription ${sub.id}`, 'biller');

            } catch (subError: any) {
                logger.error(`Failed to process subscription ${sub.id}`, 'biller', { error: subError.message });
                diffCount++;
            }
        }

        logger.info(`Billing cycle complete. Processed: ${processedCount}, Failed: ${diffCount}`, 'biller');

    } catch (error: any) {
        logger.error('Billing Cron Failed', 'biller', { error: error.message });
    }
}

export function startBillingCron() {
    // Run immediately on startup to catch up on any missed billing cycles
    // (e.g., if server was down during the scheduled midnight run)
    logger.info('🔄 Checking for missed subscription billing cycles...', 'biller');
    runBillingCycle().catch(err => {
        logger.error('Startup billing cycle check failed', 'biller', { error: err.message });
    });

    // Run every day at midnight (UTC)
    cron.schedule('0 0 * * *', async () => {
        await runBillingCycle();
    });

    logger.info('✅ Subscription Biller scheduled (Daily at 00:00 UTC with Startup Catch-up)');
}
