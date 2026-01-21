/**
 * Job Queue Service (OPTIONAL - requires Redis)
 * 
 * This service is COMPLETELY OPTIONAL and will gracefully degrade if:
 * - REDIS_URL is not configured
 * - BullMQ/ioredis packages are not installed
 * - Redis connection fails
 * 
 * If disabled, webhooks and emails will run synchronously (existing behavior).
 */

import { logger } from './logger';

// Check if Redis is configured
const REDIS_URL = process.env.REDIS_URL;
const isQueueEnabled = !!REDIS_URL;

if (!isQueueEnabled) {
    logger.info('Queue service disabled - REDIS_URL not configured', 'queue');
}

// Stub exports for when queue is disabled
export const webhookQueue = null;
export const emailQueue = null;
export const webhookWorker = null;
export const emailWorker = null;

/**
 * Add webhook job (no-op if queue disabled)
 */
export async function addWebhookJob(data: any, priority?: number): Promise<any> {
    if (!isQueueEnabled) {
        logger.debug('Queue disabled - webhook will run synchronously', 'queue');
        return null;
    }

    logger.warn('Queue service not fully implemented yet', 'queue');
    return null;
}

/**
 * Add email job (no-op if queue disabled)
 */
export async function addEmailJob(data: any, priority?: number): Promise<any> {
    if (!isQueueEnabled) {
        logger.debug('Queue disabled - email will run synchronously', 'queue');
        return null;
    }

    logger.warn('Queue service not fully implemented yet', 'queue');
    return null;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
    if (!isQueueEnabled) {
        return {
            webhooks: { waiting: 0, active: 0, completed: 0, failed: 0 },
            emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
            timestamp: new Date().toISOString(),
            enabled: false
        };
    }

    return {
        webhooks: { waiting: 0, active: 0, completed: 0, failed: 0 },
        emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
        timestamp: new Date().toISOString(),
        enabled: false
    };
}

/**
 * Pause queues (no-op if disabled)
 */
export async function pauseQueues() {
    if (!isQueueEnabled) return;
    logger.warn('Queue pause not implemented', 'queue');
}

/**
 * Resume queues (no-op if disabled)
 */
export async function resumeQueues() {
    if (!isQueueEnabled) return;
    logger.warn('Queue resume not implemented', 'queue');
}

/**
 * Close queues (no-op if disabled)
 */
export async function closeQueues() {
    if (!isQueueEnabled) return;
    logger.info('Queue service was not enabled', 'queue');
}
