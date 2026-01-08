/**
 * Webhook Service
 * 
 * Core service for emitting events and delivering webhooks
 * Handles HMAC signing, retry logic, and delivery tracking
 */

import crypto from "crypto";
import { db, schema } from "./db";
import {
    WEBHOOK_EVENTS,
    type WebhookEventType,
    type WebhookPayload,
    type Webhook
} from "@shared/webhooks-schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { logger } from "./logger";

// ============================================
// CONSTANTS
// ============================================

const RETRY_DELAYS_MS = [
    0,          // Attempt 1: immediate
    60_000,     // Attempt 2: 1 minute
    300_000,    // Attempt 3: 5 minutes
    1_800_000,  // Attempt 4: 30 minutes
    7_200_000,  // Attempt 5: 2 hours
];

const DELIVERY_TIMEOUT_MS = 10_000; // 10 second timeout per delivery
const MAX_RESPONSE_BODY_LENGTH = 1024; // Store first 1KB of response
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minute tolerance for replay protection

// ============================================
// HMAC SIGNATURE GENERATION
// ============================================

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * Format sent in X-Invoix-Signature header: v1=<signature>
 */
export function generateWebhookSignature(
    payload: string,
    timestamp: number,
    secret: string
): string {
    const signatureData = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(signatureData)
        .digest("hex");
    return `v1=${signature}`;
}

/**
 * Verify webhook signature (for webhook receivers to use)
 * This function is exported for documentation/SDK purposes
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: number,
    secret: string
): boolean {
    // Check timestamp is within tolerance (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
        return false;
    }

    const expectedSignature = generateWebhookSignature(payload, timestamp, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

// ============================================
// SECRET MANAGEMENT
// ============================================

// Encryption key for webhook secrets (derived from env or fallback for dev)
const WEBHOOK_SECRET_KEY = crypto
    .createHash("sha256")
    .update(process.env.WEBHOOK_ENCRYPTION_KEY || process.env.SESSION_SECRET || "invoix-webhook-secret-key-dev")
    .digest();

/**
 * Generate a new webhook secret
 * Returns the raw secret (to show to user once), its hash (for verification),
 * and an encrypted version (for signing)
 */
export function generateWebhookSecret(): { secret: string; hash: string; encryptedSecret: string } {
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const hash = hashWebhookSecret(secret);
    const encryptedSecret = encryptWebhookSecret(secret);
    return { secret, hash, encryptedSecret };
}

/**
 * Hash a webhook secret for verification purposes
 */
export function hashWebhookSecret(secret: string): string {
    return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * Encrypt webhook secret for storage (allows decryption for signing)
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptWebhookSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", WEBHOOK_SECRET_KEY, iv);
    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt webhook secret for signing
 */
export function decryptWebhookSecret(encryptedSecret: string): string {
    try {
        const [ivHex, authTagHex, encrypted] = encryptedSecret.split(":");
        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error("Invalid encrypted secret format");
        }
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-gcm", WEBHOOK_SECRET_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (error) {
        logger.error("Failed to decrypt webhook secret", "webhook", { error });
        throw new Error("Failed to decrypt webhook secret");
    }
}

// ============================================
// EVENT EMISSION
// ============================================

/**
 * Emit a webhook event to all subscribed endpoints
 * This is the main function called throughout the codebase
 */
export async function emitWebhookEvent(
    ownerWallet: string,
    eventType: WebhookEventType,
    data: Record<string, any>
): Promise<void> {
    try {
        // Find all active webhooks for this wallet that subscribe to this event
        const subscribedWebhooks = await db.select()
            .from(schema.webhooks)
            .where(and(
                eq(schema.webhooks.ownerWallet, ownerWallet),
                eq(schema.webhooks.status, "active")
            ));

        // Filter to those subscribed to this event type
        const matchingWebhooks = subscribedWebhooks.filter(
            webhook => webhook.events.includes(eventType)
        );

        if (matchingWebhooks.length === 0) {
            logger.debug(`No webhooks subscribed to ${eventType} for ${ownerWallet.slice(0, 8)}...`, "webhook");
            return;
        }

        // Generate unique event ID
        const eventId = `evt_${crypto.randomUUID()}`;

        // Build payload
        const payload: WebhookPayload = {
            event: eventType,
            eventId,
            timestamp: new Date().toISOString(),
            data,
        };

        const payloadJson = JSON.stringify(payload);

        // Create delivery records for each webhook
        for (const webhook of matchingWebhooks) {
            await createDeliveryRecord(webhook.id, eventType, eventId, payloadJson);
        }

        logger.info(`Queued ${matchingWebhooks.length} webhook(s) for ${eventType}`, "webhook");

        // Trigger immediate delivery attempt (async, don't await)
        processWebhookDeliveries().catch(err =>
            logger.error("Error processing webhook deliveries", "webhook", { error: err })
        );

    } catch (error) {
        logger.error(`Failed to emit webhook event: ${eventType}`, "webhook", { error });
    }
}

/**
 * Create a delivery record for a webhook
 */
async function createDeliveryRecord(
    webhookId: string,
    eventType: WebhookEventType,
    eventId: string,
    payload: string
): Promise<void> {
    await db.insert(schema.webhookDeliveries).values({
        webhookId,
        eventType,
        eventId,
        payload,
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(),
    });
}

// ============================================
// DELIVERY PROCESSING
// ============================================

/**
 * Process pending webhook deliveries
 * Called by cron job and after event emission
 */
export async function processWebhookDeliveries(): Promise<void> {
    const now = new Date();

    // Find deliveries ready for (re)try
    const pendingDeliveries = await db.select({
        delivery: schema.webhookDeliveries,
        webhook: schema.webhooks,
    })
        .from(schema.webhookDeliveries)
        .innerJoin(schema.webhooks, eq(schema.webhookDeliveries.webhookId, schema.webhooks.id))
        .where(and(
            inArray(schema.webhookDeliveries.status, ["pending", "failed"]),
            lte(schema.webhookDeliveries.nextRetryAt, now)
        ))
        .limit(50); // Process in batches

    if (pendingDeliveries.length === 0) {
        return;
    }

    logger.debug(`Processing ${pendingDeliveries.length} webhook deliveries`, "webhook");

    for (const { delivery, webhook } of pendingDeliveries) {
        await attemptDelivery(delivery, webhook);
    }
}

/**
 * Attempt to deliver a webhook
 */
async function attemptDelivery(
    delivery: typeof schema.webhookDeliveries.$inferSelect,
    webhook: Webhook
): Promise<void> {
    const attemptNumber = delivery.attempts + 1;

    // Mark as processing
    await db.update(schema.webhookDeliveries)
        .set({
            status: "processing",
            attempts: attemptNumber,
            lastAttemptAt: new Date(),
        })
        .where(eq(schema.webhookDeliveries.id, delivery.id));

    const timestamp = Date.now();

    // FIX: Decrypt the secret for signing (secretHash was incorrectly used before)
    // If encryptedSecret exists, use it; otherwise fall back to secretHash for backwards compatibility
    let signingSecret: string;
    if ((webhook as any).encryptedSecret) {
        try {
            signingSecret = decryptWebhookSecret((webhook as any).encryptedSecret);
        } catch {
            logger.error("Failed to decrypt webhook secret, skipping delivery", "webhook", { webhookId: webhook.id });
            return;
        }
    } else {
        // Legacy: secretHash was incorrectly stored, this won't verify on recipient side
        // Log a warning so admins know to regenerate the webhook
        logger.warn("Webhook using legacy secretHash for signing - regenerate webhook for proper signatures", "webhook", { webhookId: webhook.id });
        signingSecret = webhook.secretHash;
    }

    const signature = generateWebhookSignature(delivery.payload, timestamp, signingSecret);

    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

        const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Invoix-Signature": signature,
                "X-Invoix-Timestamp": timestamp.toString(),
                "X-Invoix-Event": delivery.eventType,
                "X-Invoix-Delivery-Id": delivery.id,
                "User-Agent": "Invoix-Webhook/1.0",
            },
            body: delivery.payload,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseTimeMs = Date.now() - startTime;
        const responseBody = await response.text().catch(() => "");

        if (response.ok) {
            // Success!
            await markDeliverySuccess(delivery.id, response.status, responseBody, responseTimeMs);
            await updateWebhookHealth(webhook.id, true);

            logger.info(`Webhook delivered: ${delivery.eventType} to ${webhook.url}`, "webhook");
        } else {
            // HTTP error
            await handleDeliveryFailure(
                delivery,
                webhook,
                `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
                response.status,
                responseBody,
                responseTimeMs
            );
        }

    } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await handleDeliveryFailure(
            delivery,
            webhook,
            errorMessage,
            null,
            null,
            responseTimeMs
        );
    }
}

/**
 * Mark a delivery as successful
 */
async function markDeliverySuccess(
    deliveryId: string,
    responseCode: number,
    responseBody: string,
    responseTimeMs: number
): Promise<void> {
    await db.update(schema.webhookDeliveries)
        .set({
            status: "delivered",
            responseCode,
            responseBody: responseBody.slice(0, MAX_RESPONSE_BODY_LENGTH),
            responseTimeMs,
            deliveredAt: new Date(),
        })
        .where(eq(schema.webhookDeliveries.id, deliveryId));
}

/**
 * Handle a failed delivery attempt
 */
async function handleDeliveryFailure(
    delivery: typeof schema.webhookDeliveries.$inferSelect,
    webhook: Webhook,
    errorMessage: string,
    responseCode: number | null,
    responseBody: string | null,
    responseTimeMs: number
): Promise<void> {
    const attemptNumber = delivery.attempts + 1;

    if (attemptNumber >= delivery.maxAttempts) {
        // Exhausted all retries
        await db.update(schema.webhookDeliveries)
            .set({
                status: "exhausted",
                errorMessage,
                responseCode,
                responseBody: responseBody?.slice(0, MAX_RESPONSE_BODY_LENGTH),
                responseTimeMs,
            })
            .where(eq(schema.webhookDeliveries.id, delivery.id));

        logger.warn(`Webhook delivery exhausted: ${delivery.eventType} to ${webhook.url}`, "webhook");
    } else {
        // Schedule retry
        const delayMs = RETRY_DELAYS_MS[attemptNumber] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        const nextRetryAt = new Date(Date.now() + delayMs);

        await db.update(schema.webhookDeliveries)
            .set({
                status: "failed",
                errorMessage,
                responseCode,
                responseBody: responseBody?.slice(0, MAX_RESPONSE_BODY_LENGTH),
                responseTimeMs,
                nextRetryAt,
            })
            .where(eq(schema.webhookDeliveries.id, delivery.id));

        logger.debug(`Webhook delivery failed, retry ${attemptNumber + 1} at ${nextRetryAt.toISOString()}`, "webhook");
    }

    await updateWebhookHealth(webhook.id, false, errorMessage);
}

/**
 * Update webhook health metrics
 */
async function updateWebhookHealth(
    webhookId: string,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    const [webhook] = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, webhookId));
    if (!webhook) return;

    if (success) {
        // Reset failure count on success
        await db.update(schema.webhooks)
            .set({
                consecutiveFailures: 0,
                lastDeliveryAt: new Date(),
                lastDeliveryStatus: "success",
                lastErrorMessage: null,
                updatedAt: new Date(),
            })
            .where(eq(schema.webhooks.id, webhookId));
    } else {
        const newFailureCount = webhook.consecutiveFailures + 1;
        const shouldDisable = newFailureCount >= webhook.autoDisableThreshold;

        await db.update(schema.webhooks)
            .set({
                consecutiveFailures: newFailureCount,
                lastDeliveryAt: new Date(),
                lastDeliveryStatus: "failed",
                lastErrorMessage: errorMessage?.slice(0, 500),
                status: shouldDisable ? "disabled" : webhook.status,
                updatedAt: new Date(),
            })
            .where(eq(schema.webhooks.id, webhookId));

        if (shouldDisable) {
            logger.warn(`Webhook auto-disabled after ${newFailureCount} failures: ${webhookId}`, "webhook");
        }
    }
}

// ============================================
// CRON JOB
// ============================================

let webhookCronInterval: NodeJS.Timeout | null = null;
const WEBHOOK_CRON_INTERVAL_MS = 60_000; // Check every minute

export function startWebhookCron(): void {
    if (webhookCronInterval) return;

    logger.info("Starting Webhook Delivery Cron Job...", "webhook");

    // Initial run after 10 seconds
    setTimeout(() => processWebhookDeliveries().catch(err =>
        logger.error("Webhook cron error", "webhook", { error: err })
    ), 10_000);

    webhookCronInterval = setInterval(() => {
        processWebhookDeliveries().catch(err =>
            logger.error("Webhook cron error", "webhook", { error: err })
        );
    }, WEBHOOK_CRON_INTERVAL_MS);
}

export function stopWebhookCron(): void {
    if (webhookCronInterval) {
        clearInterval(webhookCronInterval);
        webhookCronInterval = null;
        logger.info("Stopped Webhook Delivery Cron Job", "webhook");
    }
}

// ============================================
// EXPORTS
// ============================================

export { WEBHOOK_EVENTS };
