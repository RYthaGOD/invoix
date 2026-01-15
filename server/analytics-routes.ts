import { Router } from "express";
import { db } from "./db"; // Adjust import path
import { analyticsEvents } from "@shared/invoice-schema";
import { count, sql, eq } from "drizzle-orm";
import { globalRateLimit } from "./security";
import { timingSafeEqual } from "crypto";

const router = Router();

// Constant-time comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Admin check middleware (reusable)
const requireAdmin = (req: any, res: any, next: any) => {
    const adminSecret = req.headers["x-admin-secret"] as string | undefined;
    const expectedKey = process.env.ADMIN_SECRET_KEY;
    if (!expectedKey || !adminSecret || !safeCompare(adminSecret, expectedKey)) {
        return res.status(403).json({ message: "Admin access denied" });
    }
    next();
};

// POST /api/analytics/event - Ingest a new event (Rate Limited)
router.post("/event", globalRateLimit, async (req, res) => {
    try {
        const { eventType, path, walletAddress, visitorHash, userAgent } = req.body;

        // Basic validation
        if (!eventType) {
            return res.status(400).json({ error: "Missing eventType" });
        }

        await db.insert(analyticsEvents).values({
            eventType,
            path,
            walletAddress: walletAddress || null,
            visitorHash: visitorHash || null,
            userAgent: userAgent || null
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error("Analytics error:", error);
        // Fail silently to client to not block UI
        res.status(200).json({ success: false });
    }
});

// GET /api/analytics/stats/public - Get basic stats for landing page (Public - rate limited)
router.get("/stats/public", globalRateLimit, async (req, res) => {
    try {
        // 1. Total Page Views
        const [viewsResult] = await db
            .select({ count: count() })
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventType, "page_view"));

        // 2. Total Unique Wallets (Community Members)
        const result = await db.execute(
            sql`SELECT COUNT(DISTINCT ${analyticsEvents.walletAddress}) as count FROM ${analyticsEvents} WHERE ${analyticsEvents.walletAddress} IS NOT NULL`
        );
        const walletsResult = result.rows[0] as { count: string };

        res.json({
            pageViews: Number(viewsResult?.count || 0),
            uniqueWallets: Number(walletsResult?.count || 0)
        });
    } catch (error: any) {
        console.error("Public analytics error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// GET /api/analytics/stats - Get detailed aggregate stats (Admin Only)
router.get("/stats", requireAdmin, async (req, res) => {
    try {
        // 1. Total Page Views
        const [viewsResult] = await db
            .select({ count: count() })
            .from(analyticsEvents)
            .where(eq(analyticsEvents.eventType, "page_view"));

        // 2. Total Unique Wallets (Community Members)
        // Drizzle with node-postgres returns a QueryResult object with a rows array
        const result = await db.execute(
            sql`SELECT COUNT(DISTINCT ${analyticsEvents.walletAddress}) as count FROM ${analyticsEvents} WHERE ${analyticsEvents.walletAddress} IS NOT NULL`
        );
        const walletsResult = result.rows[0] as { count: string };

        res.json({
            pageViews: Number(viewsResult?.count || 0),
            uniqueWallets: Number(walletsResult?.count || 0)
        });
    } catch (error: any) {
        console.error("Analytics stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

export const analyticsRouter = router;
