/**
 * Prometheus Metrics Service
 * 
 * Provides comprehensive application monitoring with business and technical metrics.
 * Integrates with Prometheus + Grafana for visualization and alerting.
 * 
 * Metrics Categories:
 * - Business: Invoices, payments, subscriptions, marketplace
 * - Technical: HTTP requests, response times, errors
 * - System: CPU, memory, event loop lag
 */

import promClient from 'prom-client';
import promBundle from 'express-prom-bundle';

// Initialize Prometheus registry
const register = new promClient.Registry();

// Add default Node.js metrics (CPU, memory, event loop lag)
promClient.collectDefaultMetrics({
    register,
    prefix: 'invoix_nodejs_'
});

// ============================================
// BUSINESS METRICS
// ============================================

/**
 * Invoice Creation Counter
 * Tracks total invoices created by currency and status
 */
export const invoicesCreated = new promClient.Counter({
    name: 'invoix_invoices_created_total',
    help: 'Total number of invoices created',
    labelNames: ['currency', 'status', 'privacy'],
    registers: [register]
});

/**
 * Payment Processing Counter
 * Tracks all payment attempts by currency and method
 */
export const paymentsProcessed = new promClient.Counter({
    name: 'invoix_payments_processed_total',
    help: 'Total number of payments processed',
    labelNames: ['currency', 'method', 'status'],
    registers: [register]
});

/**
 * Payment Amount Histogram
 * Tracks distribution of payment amounts in USD
 */
export const paymentAmount = new promClient.Histogram({
    name: 'invoix_payment_amount_usd',
    help: 'Payment amounts in USD',
    buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
    labelNames: ['currency'],
    registers: [register]
});

/**
 * Webhook Delivery Counter
 * Tracks webhook delivery attempts and outcomes
 */
export const webhookDeliveries = new promClient.Counter({
    name: 'invoix_webhook_deliveries_total',
    help: 'Total webhook delivery attempts',
    labelNames: ['event_type', 'status'],
    registers: [register]
});

/**
 * NFT Minting Counter
 * Tracks NFT mints by type (invoice, receipt, special)
 */
export const nftMints = new promClient.Counter({
    name: 'invoix_nft_mints_total',
    help: 'Total NFT mints',
    labelNames: ['type', 'status'],
    registers: [register]
});

/**
 * Subscription Events Counter
 * Tracks subscription lifecycle events
 */
export const subscriptionEvents = new promClient.Counter({
    name: 'invoix_subscription_events_total',
    help: 'Total subscription events',
    labelNames: ['event_type'],
    registers: [register]
});

/**
 * Marketplace Transactions Counter
 * Tracks marketplace listing and purchase events
 */
export const marketplaceTransactions = new promClient.Counter({
    name: 'invoix_marketplace_transactions_total',
    help: 'Total marketplace transactions',
    labelNames: ['action', 'status'],
    registers: [register]
});

/**
 * Credit Score Updates Counter
 * Tracks credit score calculation events
 */
export const creditScoreUpdates = new promClient.Counter({
    name: 'invoix_credit_score_updates_total',
    help: 'Total credit score updates',
    labelNames: ['update_type'],
    registers: [register]
});

// ============================================
// TECHNICAL METRICS
// ============================================

/**
 * Solana RPC Calls Counter
 * Tracks RPC calls by method and outcome
 */
export const solanaRpcCalls = new promClient.Counter({
    name: 'invoix_solana_rpc_calls_total',
    help: 'Total Solana RPC calls',
    labelNames: ['method', 'status'],
    registers: [register]
});

/**
 * Solana RPC Latency Histogram
 * Tracks RPC call latency distribution
 */
export const solanaRpcLatency = new promClient.Histogram({
    name: 'invoix_solana_rpc_latency_seconds',
    help: 'Solana RPC call latency in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    labelNames: ['method'],
    registers: [register]
});

/**
 * Database Query Duration Histogram
 * Tracks database query performance
 */
export const databaseQueryDuration = new promClient.Histogram({
    name: 'invoix_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2],
    labelNames: ['operation'],
    registers: [register]
});

/**
 * Active Sessions Gauge
 * Tracks number of active user sessions
 */
export const activeSessions = new promClient.Gauge({
    name: 'invoix_active_sessions',
    help: 'Number of active user sessions',
    registers: [register]
});

/**
 * Email Delivery Counter
 * Tracks email sending attempts
 */
export const emailsSent = new promClient.Counter({
    name: 'invoix_emails_sent_total',
    help: 'Total emails sent',
    labelNames: ['type', 'status'],
    registers: [register]
});

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

/**
 * Express Prometheus middleware
 * Automatically tracks HTTP request metrics:
 * - Request count by method, path, status code
 * - Request duration histogram
 * - Response size
 */
export const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: {
        app: 'invoix',
        environment: process.env.NODE_ENV || 'development'
    },
    promClient: {
        collectDefaultMetrics: {}
    },
    // Normalize paths to avoid high cardinality
    normalizePath: (req) => {
        // Replace UUIDs with :id
        let path = req.path;
        path = path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
        // Replace wallet addresses with :wallet
        path = path.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, ':wallet');
        // Replace transaction signatures with :signature
        path = path.replace(/[1-9A-HJ-NP-Za-km-z]{87,88}/g, ':signature');
        return path;
    }
});

// ============================================
// METRICS ENDPOINT
// ============================================

/**
 * Get all metrics in Prometheus format
 * Endpoint: GET /metrics
 */
export async function getMetrics(): Promise<string> {
    return await register.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
    return register.contentType;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Record invoice creation
 */
export function recordInvoiceCreated(currency: string, status: string, isPrivate: boolean) {
    invoicesCreated.inc({
        currency,
        status,
        privacy: isPrivate ? 'private' : 'public'
    });
}

/**
 * Record payment processing
 */
export function recordPaymentProcessed(
    currency: string,
    method: string,
    status: 'success' | 'failed',
    amountUsd?: number
) {
    paymentsProcessed.inc({ currency, method, status });

    if (status === 'success' && amountUsd) {
        paymentAmount.observe({ currency }, amountUsd);
    }
}

/**
 * Record webhook delivery
 */
export function recordWebhookDelivery(eventType: string, status: 'success' | 'failed') {
    webhookDeliveries.inc({ event_type: eventType, status });
}

/**
 * Record NFT mint
 */
export function recordNftMint(type: 'invoice' | 'receipt' | 'special', status: 'success' | 'failed') {
    nftMints.inc({ type, status });
}

/**
 * Record subscription event
 */
export function recordSubscriptionEvent(eventType: 'created' | 'cancelled' | 'renewed') {
    subscriptionEvents.inc({ event_type: eventType });
}

/**
 * Record marketplace transaction
 */
export function recordMarketplaceTransaction(action: 'list' | 'buy' | 'cancel', status: 'success' | 'failed') {
    marketplaceTransactions.inc({ action, status });
}

/**
 * Record credit score update
 */
export function recordCreditScoreUpdate(updateType: 'payment' | 'invoice' | 'full_recalc') {
    creditScoreUpdates.inc({ update_type: updateType });
}

/**
 * Record Solana RPC call
 */
export function recordSolanaRpcCall(method: string, status: 'success' | 'failed', durationSeconds?: number) {
    solanaRpcCalls.inc({ method, status });

    if (durationSeconds) {
        solanaRpcLatency.observe({ method }, durationSeconds);
    }
}

/**
 * Record database query
 */
export function recordDatabaseQuery(operation: string, durationSeconds: number) {
    databaseQueryDuration.observe({ operation }, durationSeconds);
}

/**
 * Update active sessions count
 */
export function updateActiveSessions(count: number) {
    activeSessions.set(count);
}

/**
 * Record email sent
 */
export function recordEmailSent(type: 'invoice' | 'receipt' | 'reminder', status: 'success' | 'failed') {
    emailsSent.inc({ type, status });
}
