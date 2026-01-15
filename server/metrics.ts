/**
 * System Metrics Endpoint
 * Provides application-level metrics for monitoring dashboards
 */

import { db } from "./db";
import { invoices, subscriptions, payments } from "@shared/invoice-schema";
import { sql, count, gte, eq } from "drizzle-orm";

export interface SystemMetrics {
    uptime: number;
    timestamp: string;
    version: string;
    database: {
        connected: boolean;
        responseTime?: number;
    };
    invoices: {
        total: number;
        pending: number;
        paid: number;
        overdue: number;
    };
    subscriptions: {
        total: number;
        active: number;
        cancelled: number;
        pendingConfirmation: number;
    };
    payments: {
        total: number;
        last24h: number;
    };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
        const dbStart = Date.now();

        // Parallel metric queries for performance
        const [invoiceStats, subscriptionStats, paymentStats, recentPayments] = await Promise.all([
            // Invoice statistics
            db
                .select({
                    total: count(),
                    pending: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)`.mapWith(Number),
                    paid: sql<number>`COUNT(CASE WHEN status = 'paid' THEN 1 END)`.mapWith(Number),
                    overdue: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)`.mapWith(Number),
                })
                .from(invoices)
                .execute(),

            // Subscription statistics
            db
                .select({
                    total: count(),
                    active: sql<number>`COUNT(CASE WHEN status = 'active' THEN 1 END)`.mapWith(Number),
                    cancelled: sql<number>`COUNT(CASE WHEN status = 'cancelled' THEN 1 END)`.mapWith(Number),
                    pending: sql<number>`COUNT(CASE WHEN status = 'pending_confirmation' THEN 1 END)`.mapWith(Number),
                })
                .from(subscriptions)
                .execute(),

            // Payment statistics
            db.select({ total: count() }).from(payments).execute(),

            // Recent payments (last 24h)
            db.select({ id: payments.id }).from(payments).where(gte(payments.createdAt, yesterday)).execute(),
        ]);

        const dbResponseTime = Date.now() - dbStart;

        return {
            uptime: process.uptime(),
            timestamp: now.toISOString(),
            version: "1.0.0",
            database: {
                connected: true,
                responseTime: dbResponseTime,
            },
            invoices: {
                total: invoiceStats[0]?.total || 0,
                pending: invoiceStats[0]?.pending || 0,
                paid: invoiceStats[0]?.paid || 0,
                overdue: invoiceStats[0]?.overdue || 0,
            },
            subscriptions: {
                total: subscriptionStats[0]?.total || 0,
                active: subscriptionStats[0]?.active || 0,
                cancelled: subscriptionStats[0]?.cancelled || 0,
                pendingConfirmation: subscriptionStats[0]?.pending || 0,
            },
            payments: {
                total: paymentStats[0]?.total || 0,
                last24h: recentPayments.length,
            },
        };
    } catch (error: any) {
        // Return partial metrics on error
        return {
            uptime: process.uptime(),
            timestamp: now.toISOString(),
            version: "1.0.0",
            database: {
                connected: false,
            },
            invoices: { total: 0, pending: 0, paid: 0, overdue: 0 },
            subscriptions: { total: 0, active: 0, cancelled: 0, pendingConfirmation: 0 },
            payments: { total: 0, last24h: 0 },
        };
    }
}
