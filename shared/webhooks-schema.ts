/**
 * Webhook System Schema
 * 
 * Enterprise Oracle Integration for B2B invoicing
 * Provides event-driven notifications to external systems (ERP, accounting)
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// WEBHOOK CONFIGURATION TABLE
// ============================================

/**
 * Webhooks - Registered webhook endpoints
 * Each business can configure multiple webhooks for different event types
 */
export const webhooks = pgTable("webhooks", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerWallet: text("owner_wallet").notNull(), // Business wallet that owns this webhook

    // Endpoint Configuration
    name: text("name"), // Friendly name (e.g., "QuickBooks Sync", "Slack Notifications")
    url: text("url").notNull(), // HTTPS endpoint URL

    // Security
    // Secret is stored as SCRYPT hash, used for HMAC signature generation
    // The actual secret is only shown once at creation time
    secretHash: text("secret_hash").notNull(),
    // Encrypted raw secret for signing (AES-256-GCM)
    // FIX: Added to enable proper HMAC signing with the raw secret
    encryptedSecret: text("encrypted_secret"),

    // Event Subscriptions
    // Array of event types to subscribe to
    events: text("events").array().notNull(),

    // Status
    status: text("status").notNull().default("active"), // active, paused, disabled

    // Health Tracking
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastDeliveryAt: timestamp("last_delivery_at"),
    lastDeliveryStatus: text("last_delivery_status"), // success, failed
    lastErrorMessage: text("last_error_message"),

    // Auto-disable after too many failures
    maxRetries: integer("max_retries").notNull().default(5),
    autoDisableThreshold: integer("auto_disable_threshold").notNull().default(10), // Disable after 10 consecutive failures

    // Metadata
    description: text("description"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    ownerWalletIdx: index("idx_webhooks_owner_wallet").on(table.ownerWallet),
    statusIdx: index("idx_webhooks_status").on(table.status),
}));

// ============================================
// WEBHOOK DELIVERY TABLE
// ============================================

/**
 * Webhook Deliveries - Individual delivery attempts
 * Tracks each event delivery for debugging and retry logic
 */
export const webhookDeliveries = pgTable("webhook_deliveries", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    webhookId: varchar("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),

    // Event Details
    eventType: text("event_type").notNull(), // e.g., "invoice.paid", "payment.received"
    eventId: text("event_id").notNull(), // Unique identifier for this event (for idempotency)
    payload: text("payload").notNull(), // JSON payload sent to webhook

    // Delivery Status
    status: text("status").notNull().default("pending"),
    // pending: awaiting delivery
    // processing: currently being delivered
    // delivered: successfully delivered (2xx response)
    // failed: delivery failed, may retry
    // exhausted: all retries exhausted, gave up

    // Retry Tracking
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),

    // Response Details
    responseCode: integer("response_code"),
    responseBody: text("response_body"), // First 1KB of response for debugging
    responseTimeMs: integer("response_time_ms"),

    // Error Details
    errorMessage: text("error_message"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at"),
}, (table) => ({
    webhookIdIdx: index("idx_webhook_deliveries_webhook_id").on(table.webhookId),
    statusIdx: index("idx_webhook_deliveries_status").on(table.status),
    nextRetryIdx: index("idx_webhook_deliveries_next_retry").on(table.nextRetryAt),
    eventIdIdx: index("idx_webhook_deliveries_event_id").on(table.eventId),
}));

// ============================================
// SUPPORTED WEBHOOK EVENTS
// ============================================

export const WEBHOOK_EVENTS = {
    // Invoice Events
    INVOICE_CREATED: "invoice.created",
    INVOICE_SENT: "invoice.sent",
    INVOICE_VIEWED: "invoice.viewed",
    INVOICE_PAID: "invoice.paid",
    INVOICE_PARTIAL_PAID: "invoice.partial_paid",
    INVOICE_OVERDUE: "invoice.overdue",
    INVOICE_CANCELLED: "invoice.cancelled",

    // Payment Events
    PAYMENT_RECEIVED: "payment.received",
    PAYMENT_CONFIRMED: "payment.confirmed",
    PAYMENT_FAILED: "payment.failed",

    // NFT Receipt Events
    NFT_RECEIPT_MINTED: "nft.receipt_minted",

    // Subscription Events (Future)
    SUBSCRIPTION_CREATED: "subscription.created",
    SUBSCRIPTION_CHARGED: "subscription.charged",
    SUBSCRIPTION_FAILED: "subscription.failed",
    SUBSCRIPTION_CANCELLED: "subscription.cancelled",

    // Milestone Events (Future)
    MILESTONE_SUBMITTED: "milestone.submitted",
    MILESTONE_APPROVED: "milestone.approved",
    MILESTONE_REJECTED: "milestone.rejected",
    MILESTONE_RELEASED: "milestone.released",
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

// Array of all event types for validation
export const ALL_WEBHOOK_EVENTS = Object.values(WEBHOOK_EVENTS);

// ============================================
// WEBHOOK PAYLOAD TYPES
// ============================================

export interface WebhookPayload {
    event: WebhookEventType;
    eventId: string;
    timestamp: string; // ISO 8601
    data: Record<string, any>;
}

export interface InvoiceEventPayload extends WebhookPayload {
    data: {
        invoiceId: string;
        invoiceNumber: string;
        invoicerWallet: string;
        invoiceeWallet: string;
        amount: string;
        currency: string;
        status: string;
        dueDate?: string;
        paidAt?: string;
    };
}

export interface PaymentEventPayload extends WebhookPayload {
    data: {
        paymentId: string;
        invoiceId: string;
        invoiceNumber: string;
        amount: string;
        currency: string;
        txSignature: string;
        fromAddress: string;
        toAddress: string;
        confirmedAt?: string;
        nftMint?: string;
    };
}

// ============================================
// RELATIONS
// ============================================

export const webhooksRelations = relations(webhooks, ({ many }) => ({
    deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
    webhook: one(webhooks, {
        fields: [webhookDeliveries.webhookId],
        references: [webhooks.id],
    }),
}));

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    consecutiveFailures: true,
    lastDeliveryAt: true,
    lastDeliveryStatus: true,
    lastErrorMessage: true,
    secretHash: true, // Generated server-side
}).extend({
    ownerWallet: z.string().min(32, "Invalid wallet address"),
    url: z.string().url("Invalid webhook URL").refine(
        (url) => url.startsWith("https://"),
        "Webhook URL must use HTTPS"
    ),
    events: z.array(z.enum(ALL_WEBHOOK_EVENTS as [string, ...string[]])).min(1, "At least one event required"),
    name: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
});

export const updateWebhookSchema = insertWebhookSchema.partial().omit({
    ownerWallet: true, // Cannot change owner
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({
    id: true,
    createdAt: true,
    deliveredAt: true,
    attempts: true,
    lastAttemptAt: true,
    responseCode: true,
    responseBody: true,
    responseTimeMs: true,
    errorMessage: true,
}).extend({
    webhookId: z.string().uuid(),
    eventType: z.enum(ALL_WEBHOOK_EVENTS as [string, ...string[]]),
    eventId: z.string().min(1),
    payload: z.string(), // JSON string
});

// ============================================
// TYPE EXPORTS
// ============================================

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
