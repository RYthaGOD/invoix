/**
 * Webhook Routes
 * 
 * REST API for managing webhook endpoints
 * Allows businesses to register, configure, and monitor webhooks
 */

import { Router, type Request, type Response } from "express";
import { db, schema } from "./db";
import {
    insertWebhookSchema,
    updateWebhookSchema,
    ALL_WEBHOOK_EVENTS,
} from "@shared/webhooks-schema";
import { eq, and, desc } from "drizzle-orm";
import { requireWalletOwnership, strictRateLimit } from "./security";
import { generateWebhookSecret, emitWebhookEvent, WEBHOOK_EVENTS } from "./webhook-service";
import { logger } from "./logger";


const router = Router();

// ============================================
// LIST WEBHOOKS
// ============================================

/**
 * GET /api/webhooks
 * List all webhooks for the authenticated wallet
 */
router.get("/", requireWalletOwnership, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const userWebhooks = await db.select({
            id: schema.webhooks.id,
            name: schema.webhooks.name,
            url: schema.webhooks.url,
            events: schema.webhooks.events,
            status: schema.webhooks.status,
            consecutiveFailures: schema.webhooks.consecutiveFailures,
            lastDeliveryAt: schema.webhooks.lastDeliveryAt,
            lastDeliveryStatus: schema.webhooks.lastDeliveryStatus,
            createdAt: schema.webhooks.createdAt,
        })
            .from(schema.webhooks)
            .where(eq(schema.webhooks.ownerWallet, walletAddress))
            .orderBy(desc(schema.webhooks.createdAt));

        return res.json({ webhooks: userWebhooks });

    } catch (error: any) {
        logger.error("Error listing webhooks", "api", { error });
        return res.status(500).json({ error: "Failed to list webhooks" });
    }
});

// ============================================
// GET SINGLE WEBHOOK
// ============================================

/**
 * GET /api/webhooks/:id
 * Get webhook details including recent deliveries
 */
router.get("/:id", requireWalletOwnership, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        const { id } = req.params;

        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Get webhook
        const [webhook] = await db.select({
            id: schema.webhooks.id,
            name: schema.webhooks.name,
            url: schema.webhooks.url,
            events: schema.webhooks.events,
            status: schema.webhooks.status,
            consecutiveFailures: schema.webhooks.consecutiveFailures,
            lastDeliveryAt: schema.webhooks.lastDeliveryAt,
            lastDeliveryStatus: schema.webhooks.lastDeliveryStatus,
            lastErrorMessage: schema.webhooks.lastErrorMessage,
            description: schema.webhooks.description,
            maxRetries: schema.webhooks.maxRetries,
            autoDisableThreshold: schema.webhooks.autoDisableThreshold,
            createdAt: schema.webhooks.createdAt,
            updatedAt: schema.webhooks.updatedAt,
        })
            .from(schema.webhooks)
            .where(and(
                eq(schema.webhooks.id, id),
                eq(schema.webhooks.ownerWallet, walletAddress)
            ));

        if (!webhook) {
            return res.status(404).json({ error: "Webhook not found" });
        }

        // Get recent deliveries
        const recentDeliveries = await db.select({
            id: schema.webhookDeliveries.id,
            eventType: schema.webhookDeliveries.eventType,
            eventId: schema.webhookDeliveries.eventId,
            status: schema.webhookDeliveries.status,
            attempts: schema.webhookDeliveries.attempts,
            responseCode: schema.webhookDeliveries.responseCode,
            responseTimeMs: schema.webhookDeliveries.responseTimeMs,
            errorMessage: schema.webhookDeliveries.errorMessage,
            createdAt: schema.webhookDeliveries.createdAt,
            deliveredAt: schema.webhookDeliveries.deliveredAt,
        })
            .from(schema.webhookDeliveries)
            .where(eq(schema.webhookDeliveries.webhookId, id))
            .orderBy(desc(schema.webhookDeliveries.createdAt))
            .limit(20);

        return res.json({
            webhook,
            recentDeliveries,
        });

    } catch (error: any) {
        logger.error("Error getting webhook", "api", { error });
        return res.status(500).json({ error: "Failed to get webhook" });
    }
});

// ============================================
// CREATE WEBHOOK
// ============================================

/**
 * POST /api/webhooks
 * Create a new webhook endpoint
 * Returns the secret ONLY ONCE - user must save it
 */
router.post("/", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Validate input
        const validationResult = insertWebhookSchema.safeParse({
            ...req.body,
            ownerWallet: walletAddress,
        });

        if (!validationResult.success) {
            return res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.flatten().fieldErrors,
            });
        }

        const data = validationResult.data;

        // Check webhook limit (max 10 per wallet)
        const existingCount = await db.select({ id: schema.webhooks.id })
            .from(schema.webhooks)
            .where(eq(schema.webhooks.ownerWallet, walletAddress));

        if (existingCount.length >= 10) {
            return res.status(400).json({
                error: "Maximum webhooks limit reached (10)",
            });
        }

        // Generate secret
        const { secret, hash, encryptedSecret } = generateWebhookSecret();

        // Create webhook
        const [newWebhook] = await db.insert(schema.webhooks)
            .values({
                ownerWallet: walletAddress,
                name: data.name || null,
                url: data.url,
                events: data.events,
                secretHash: hash,
                encryptedSecret: encryptedSecret, // FIX: Store encrypted secret for signing
                description: data.description || null,
                status: "active",
            })
            .returning();

        logger.info(`Webhook created: ${newWebhook.id} for ${walletAddress.slice(0, 8)}...`, "api");

        // Return webhook with secret (shown only once!)
        return res.status(201).json({
            webhook: {
                id: newWebhook.id,
                name: newWebhook.name,
                url: newWebhook.url,
                events: newWebhook.events,
                status: newWebhook.status,
                createdAt: newWebhook.createdAt,
            },
            secret, // IMPORTANT: This is the only time the secret is shown!
            message: "Save this secret securely - it will not be shown again!",
        });

    } catch (error: any) {
        logger.error("Error creating webhook", "api", { error });
        return res.status(500).json({ error: "Failed to create webhook" });
    }
});

// ============================================
// UPDATE WEBHOOK
// ============================================

/**
 * PATCH /api/webhooks/:id
 * Update webhook configuration
 */
router.patch("/:id", requireWalletOwnership, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        const { id } = req.params;

        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Verify ownership
        const [existingWebhook] = await db.select()
            .from(schema.webhooks)
            .where(and(
                eq(schema.webhooks.id, id),
                eq(schema.webhooks.ownerWallet, walletAddress)
            ));

        if (!existingWebhook) {
            return res.status(404).json({ error: "Webhook not found" });
        }

        // Validate input
        const validationResult = updateWebhookSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: "Validation failed",
                details: validationResult.error.flatten().fieldErrors,
            });
        }

        const data = validationResult.data;

        // Update webhook
        const [updatedWebhook] = await db.update(schema.webhooks)
            .set({
                ...data,
                updatedAt: new Date(),
                // Reset failure count if re-enabling
                ...(data.status === "active" && existingWebhook.status === "disabled"
                    ? { consecutiveFailures: 0 }
                    : {}
                ),
            })
            .where(eq(schema.webhooks.id, id))
            .returning();

        logger.info(`Webhook updated: ${id}`, "api");

        return res.json({
            webhook: {
                id: updatedWebhook.id,
                name: updatedWebhook.name,
                url: updatedWebhook.url,
                events: updatedWebhook.events,
                status: updatedWebhook.status,
                updatedAt: updatedWebhook.updatedAt,
            },
        });

    } catch (error: any) {
        logger.error("Error updating webhook", "api", { error });
        return res.status(500).json({ error: "Failed to update webhook" });
    }
});

// ============================================
// DELETE WEBHOOK
// ============================================

/**
 * DELETE /api/webhooks/:id
 * Remove a webhook endpoint
 */
router.delete("/:id", requireWalletOwnership, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        const { id } = req.params;

        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Verify ownership and delete
        const result = await db.delete(schema.webhooks)
            .where(and(
                eq(schema.webhooks.id, id),
                eq(schema.webhooks.ownerWallet, walletAddress)
            ))
            .returning({ id: schema.webhooks.id });

        if (result.length === 0) {
            return res.status(404).json({ error: "Webhook not found" });
        }

        logger.info(`Webhook deleted: ${id}`, "api");

        return res.json({ success: true, deleted: id });

    } catch (error: any) {
        logger.error("Error deleting webhook", "api", { error });
        return res.status(500).json({ error: "Failed to delete webhook" });
    }
});

// ============================================
// ROTATE SECRET
// ============================================

/**
 * POST /api/webhooks/:id/rotate-secret
 * Generate a new secret for the webhook
 */
router.post("/:id/rotate-secret", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        const { id } = req.params;

        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Verify ownership
        const [existingWebhook] = await db.select()
            .from(schema.webhooks)
            .where(and(
                eq(schema.webhooks.id, id),
                eq(schema.webhooks.ownerWallet, walletAddress)
            ));

        if (!existingWebhook) {
            return res.status(404).json({ error: "Webhook not found" });
        }

        // Generate new secret
        const { secret, hash, encryptedSecret } = generateWebhookSecret();

        await db.update(schema.webhooks)
            .set({
                secretHash: hash,
                encryptedSecret: encryptedSecret, // FIX: Store encrypted secret for signing
                updatedAt: new Date(),
            })
            .where(eq(schema.webhooks.id, id));

        logger.info(`Webhook secret rotated: ${id}`, "api");

        return res.json({
            secret, // IMPORTANT: This is the only time the new secret is shown!
            message: "Save this secret securely - it will not be shown again!",
        });

    } catch (error: any) {
        logger.error("Error rotating webhook secret", "api", { error });
        return res.status(500).json({ error: "Failed to rotate secret" });
    }
});

// ============================================
// TEST WEBHOOK
// ============================================

/**
 * POST /api/webhooks/:id/test
 * Send a test event to the webhook
 */
router.post("/:id/test", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
    try {
        const walletAddress = (req as any).session?.walletAddress || (req as any).authenticatedWallet;
        const { id } = req.params;

        if (!walletAddress) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Verify ownership
        const [existingWebhook] = await db.select()
            .from(schema.webhooks)
            .where(and(
                eq(schema.webhooks.id, id),
                eq(schema.webhooks.ownerWallet, walletAddress)
            ));

        if (!existingWebhook) {
            return res.status(404).json({ error: "Webhook not found" });
        }

        // Emit test event
        await emitWebhookEvent(walletAddress, WEBHOOK_EVENTS.INVOICE_CREATED, {
            invoiceId: "test_inv_" + Date.now(),
            invoiceNumber: "TEST-001",
            invoicerWallet: walletAddress,
            invoiceeWallet: "TestRecipientWallet123456789",
            amount: "100.00",
            currency: "USDC",
            status: "sent",
            isTest: true,
        });

        return res.json({
            success: true,
            message: "Test event queued for delivery",
        });

    } catch (error: any) {
        logger.error("Error sending test webhook", "api", { error });
        return res.status(500).json({ error: "Failed to send test webhook" });
    }
});

// ============================================
// LIST AVAILABLE EVENTS
// ============================================

/**
 * GET /api/webhooks/events
 * List all available webhook event types
 */
router.get("/events/list", async (req: Request, res: Response) => {
    return res.json({
        events: ALL_WEBHOOK_EVENTS,
        categories: {
            invoice: [
                WEBHOOK_EVENTS.INVOICE_CREATED,
                WEBHOOK_EVENTS.INVOICE_SENT,
                WEBHOOK_EVENTS.INVOICE_VIEWED,
                WEBHOOK_EVENTS.INVOICE_PAID,
                WEBHOOK_EVENTS.INVOICE_PARTIAL_PAID,
                WEBHOOK_EVENTS.INVOICE_OVERDUE,
                WEBHOOK_EVENTS.INVOICE_CANCELLED,
            ],
            payment: [
                WEBHOOK_EVENTS.PAYMENT_RECEIVED,
                WEBHOOK_EVENTS.PAYMENT_CONFIRMED,
                WEBHOOK_EVENTS.PAYMENT_FAILED,
            ],
            nft: [
                WEBHOOK_EVENTS.NFT_RECEIPT_MINTED,
            ],
            subscription: [
                WEBHOOK_EVENTS.SUBSCRIPTION_CREATED,
                WEBHOOK_EVENTS.SUBSCRIPTION_CHARGED,
                WEBHOOK_EVENTS.SUBSCRIPTION_FAILED,
                WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED,
            ],
            milestone: [
                WEBHOOK_EVENTS.MILESTONE_SUBMITTED,
                WEBHOOK_EVENTS.MILESTONE_APPROVED,
                WEBHOOK_EVENTS.MILESTONE_REJECTED,
                WEBHOOK_EVENTS.MILESTONE_RELEASED,
            ],
        },
    });
});

export default router;
