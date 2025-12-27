import { Router } from "express";
import { db } from "./db"; // Adjust import path
import { analyticsEvents } from "@shared/invoice-schema";
import { count, sql, eq } from "drizzle-orm";

const router = Router();

// POST /api/analytics/event - Ingest a new event
router.post("/event", async (req, res) => {
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
    } catch (error) {
        console.error("Analytics error:", error);
        // Fail silently to client to not block UI
        res.status(200).json({ success: false });
    }
});

// GET /api/analytics/stats - Get aggregate stats
router.get("/stats", async (req, res) => {
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
    } catch (error) {
        console.error("Analytics stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

export const analyticsRouter = router;
