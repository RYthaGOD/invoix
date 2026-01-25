/**
 * Job Queue Service (OPTIONAL - requires Redis)
 *
 * This service is COMPLETELY OPTIONAL and will gracefully degrade if:
 * - REDIS_URL is not configured
 * - Redis connection fails
 *
 * If disabled, webhooks and emails will run synchronously (existing behavior).
 */

import { logger } from './logger';

// Check if Redis is configured
const REDIS_URL = process.env.REDIS_URL;
const isQueueEnabled = !!REDIS_URL;

// Queue instances (initialized lazily)
let webhookQueueInstance: any = null;
let emailQueueInstance: any = null;
let webhookWorkerInstance: any = null;
let emailWorkerInstance: any = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Parse Redis connection URL
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 6379,
            password: parsed.password || undefined
        };
    } catch {
        // Fallback for simple host:port format
        const [host, port] = url.split(':');
        return { host, port: parseInt(port) || 6379 };
    }
}

/**
 * Initialize queue service (lazy, on first use)
 */
async function initializeQueues(): Promise<void> {
    if (isInitialized || !isQueueEnabled) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            const { Queue, Worker } = await import('bullmq');
            const connection = parseRedisUrl(REDIS_URL!);

            // Create webhook queue
            webhookQueueInstance = new Queue('webhooks', {
                connection,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000 // 5s, 10s, 20s
                    },
                    removeOnComplete: 100, // Keep last 100 completed jobs
                    removeOnFail: 500 // Keep last 500 failed jobs for debugging
                }
            });

            // Create email queue
            emailQueueInstance = new Queue('emails', {
                connection,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 3000
                    },
                    removeOnComplete: 100,
                    removeOnFail: 500
                }
            });

            // Create webhook worker
            // Note: Webhook deliveries are processed via processWebhookDeliveries()
            // which fetches pending deliveries from the database
            webhookWorkerInstance = new Worker('webhooks', async (job) => {
                const { processWebhookDeliveries } = await import('./webhook-service');

                logger.info('Processing webhook batch', 'queue', {
                    jobId: job.id,
                    attempt: job.attemptsMade + 1
                });

                await processWebhookDeliveries();
            }, {
                connection,
                concurrency: 1 // Process one batch at a time to avoid duplicates
            });

            // Create email worker
            emailWorkerInstance = new Worker('emails', async (job) => {
                const { getEmailService } = await import('./email-service');
                const emailService = getEmailService();
                const { type, data } = job.data;

                logger.info('Processing email job', 'queue', {
                    jobId: job.id,
                    type,
                    to: data.to
                });

                if (type === 'invoice') {
                    await emailService.sendInvoiceEmail(data);
                } else if (type === 'receipt') {
                    await emailService.sendPaymentReceiptEmail(data);
                } else {
                    logger.warn('Unknown email type', 'queue', { type });
                }
            }, {
                connection,
                concurrency: 3 // Process 3 emails in parallel
            });

            // Set up error handlers
            webhookWorkerInstance.on('failed', (job: any, err: Error) => {
                logger.error('Webhook job failed', 'queue', {
                    jobId: job?.id,
                    error: err.message,
                    attempts: job?.attemptsMade
                });
            });

            emailWorkerInstance.on('failed', (job: any, err: Error) => {
                logger.error('Email job failed', 'queue', {
                    jobId: job?.id,
                    error: err.message,
                    attempts: job?.attemptsMade
                });
            });

            webhookWorkerInstance.on('completed', (job: any) => {
                logger.debug('Webhook job completed', 'queue', { jobId: job?.id });
            });

            emailWorkerInstance.on('completed', (job: any) => {
                logger.debug('Email job completed', 'queue', { jobId: job?.id });
            });

            isInitialized = true;
            logger.info('Queue service initialized successfully', 'queue', {
                webhookQueue: 'ready',
                emailQueue: 'ready'
            });

        } catch (error: any) {
            logger.error('Failed to initialize queue service', 'queue', {
                error: error.message
            });
            // Don't throw - allow graceful degradation
            isInitialized = false;
        }
    })();

    return initializationPromise;
}

// Export queue getters (may be null if not initialized)
export const webhookQueue = webhookQueueInstance;
export const emailQueue = emailQueueInstance;
export const webhookWorker = webhookWorkerInstance;
export const emailWorker = emailWorkerInstance;

/**
 * Add webhook processing job to queue
 * This triggers batch processing of pending webhook deliveries
 * Returns job if queued, null if queue disabled (caller should run synchronously)
 */
export async function addWebhookJob(data?: {
    trigger?: string;
}, priority?: number): Promise<any> {
    if (!isQueueEnabled) {
        logger.debug('Queue disabled - webhook will run synchronously', 'queue');
        return null;
    }

    await initializeQueues();

    if (!webhookQueueInstance) {
        logger.warn('Queue not available - webhook will run synchronously', 'queue');
        return null;
    }

    try {
        const job = await webhookQueueInstance.add('webhook-batch', data || { trigger: 'manual' }, {
            priority: priority || 2,
            // Deduplicate batch jobs - only one running at a time
            jobId: 'webhook-batch'
        });

        logger.debug('Webhook batch job added to queue', 'queue', {
            jobId: job.id
        });

        return job;
    } catch (error: any) {
        logger.error('Failed to add webhook job', 'queue', { error: error.message });
        return null; // Fallback to synchronous
    }
}

/**
 * Add email job to queue
 * Returns job if queued, null if queue disabled (caller should run synchronously)
 *
 * @param type - 'invoice' or 'receipt'
 * @param data - Email data matching InvoiceEmailData or PaymentReceiptEmailData
 */
export async function addEmailJob(type: 'invoice' | 'receipt', data: {
    to: string;
    [key: string]: any;
}, priority?: number): Promise<any> {
    if (!isQueueEnabled) {
        logger.debug('Queue disabled - email will run synchronously', 'queue');
        return null;
    }

    await initializeQueues();

    if (!emailQueueInstance) {
        logger.warn('Queue not available - email will run synchronously', 'queue');
        return null;
    }

    try {
        const job = await emailQueueInstance.add('email', { type, data }, {
            priority: priority || 2
        });

        logger.debug('Email job added to queue', 'queue', {
            jobId: job.id,
            type,
            to: data.to
        });

        return job;
    } catch (error: any) {
        logger.error('Failed to add email job', 'queue', { error: error.message });
        return null; // Fallback to synchronous
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
    webhooks: { waiting: number; active: number; completed: number; failed: number };
    emails: { waiting: number; active: number; completed: number; failed: number };
    timestamp: string;
    enabled: boolean;
}> {
    if (!isQueueEnabled || !isInitialized) {
        return {
            webhooks: { waiting: 0, active: 0, completed: 0, failed: 0 },
            emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
            timestamp: new Date().toISOString(),
            enabled: false
        };
    }

    await initializeQueues();

    try {
        const [webhookCounts, emailCounts] = await Promise.all([
            webhookQueueInstance?.getJobCounts() || {},
            emailQueueInstance?.getJobCounts() || {}
        ]);

        return {
            webhooks: {
                waiting: webhookCounts.waiting || 0,
                active: webhookCounts.active || 0,
                completed: webhookCounts.completed || 0,
                failed: webhookCounts.failed || 0
            },
            emails: {
                waiting: emailCounts.waiting || 0,
                active: emailCounts.active || 0,
                completed: emailCounts.completed || 0,
                failed: emailCounts.failed || 0
            },
            timestamp: new Date().toISOString(),
            enabled: true
        };
    } catch (error: any) {
        logger.error('Failed to get queue stats', 'queue', { error: error.message });
        return {
            webhooks: { waiting: 0, active: 0, completed: 0, failed: 0 },
            emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
            timestamp: new Date().toISOString(),
            enabled: false
        };
    }
}

/**
 * Pause queues
 */
export async function pauseQueues(): Promise<void> {
    if (!isQueueEnabled || !isInitialized) return;

    try {
        await Promise.all([
            webhookQueueInstance?.pause(),
            emailQueueInstance?.pause()
        ]);
        logger.info('Queues paused', 'queue');
    } catch (error: any) {
        logger.error('Failed to pause queues', 'queue', { error: error.message });
    }
}

/**
 * Resume queues
 */
export async function resumeQueues(): Promise<void> {
    if (!isQueueEnabled || !isInitialized) return;

    try {
        await Promise.all([
            webhookQueueInstance?.resume(),
            emailQueueInstance?.resume()
        ]);
        logger.info('Queues resumed', 'queue');
    } catch (error: any) {
        logger.error('Failed to resume queues', 'queue', { error: error.message });
    }
}

/**
 * Close queues gracefully
 */
export async function closeQueues(): Promise<void> {
    if (!isQueueEnabled || !isInitialized) {
        logger.info('Queue service was not enabled', 'queue');
        return;
    }

    try {
        // Close workers first (stop processing)
        await Promise.all([
            webhookWorkerInstance?.close(),
            emailWorkerInstance?.close()
        ]);

        // Then close queues
        await Promise.all([
            webhookQueueInstance?.close(),
            emailQueueInstance?.close()
        ]);

        logger.info('Queue service closed gracefully', 'queue');
    } catch (error: any) {
        logger.error('Failed to close queues', 'queue', { error: error.message });
    }
}

// Log initial status
if (!isQueueEnabled) {
    logger.info('Queue service disabled - REDIS_URL not configured', 'queue');
} else {
    logger.info('Queue service enabled - will initialize on first use', 'queue');
}
