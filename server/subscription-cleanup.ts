/**
 * Subscription Cleanup Jobs
 * 
 * Automated maintenance tasks for subscription system:
 * 1. Clean stale pending subscriptions (daily)
 * 2. Clean old confirmed signatures (weekly)
 */

import cron from 'node-cron';
import { db } from './db';
import { subscriptions, confirmedSignatures } from '@shared/invoice-schema';
import { and, eq, lt } from 'drizzle-orm';
import { logger } from './logger';

export function startCleanupJobs() {
    /**
     * Clean stale pending subscriptions - Daily at 3 AM
     * Removes subscriptions that were created but never confirmed on-chain (user abandoned flow)
     */
    cron.schedule('0 3 * * *', async () => {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const deleted = await db.delete(subscriptions)
                .where(and(
                    eq(subscriptions.status, 'pending_confirmation'),
                    lt(subscriptions.createdAt, oneDayAgo)
                ))
                .returning();

            logger.info(`Cleaned ${deleted.length} stale pending subscriptions`);
        } catch (error) {
            logger.error('Subscription cleanup failed', 'cleanup', { error: String(error) });
        }
    });

    /**
     * Clean old confirmed signatures - Weekly on Sunday at 2 AM
     * Removes idempotency records older than 7 days to prevent unbounded growth
     */
    cron.schedule('0 2 * * 0', async () => {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const deleted = await db.delete(confirmedSignatures)
                .where(lt(confirmedSignatures.confirmedAt, sevenDaysAgo))
                .returning();

            logger.info(`Cleaned ${deleted.length} old confirmed signatures`);
        } catch (error) {
            logger.error('Signature cleanup failed', 'cleanup', { error: String(error) });
        }
    });

    logger.info('✅ Cleanup jobs scheduled (stale subscriptions: daily 3am, old signatures: weekly Sun 2am)');
}
