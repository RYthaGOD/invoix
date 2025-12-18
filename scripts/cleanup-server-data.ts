
import 'dotenv/config';
import { db } from "../server/db";
import { invoices, authNonces } from "@shared/invoice-schema";
import { lt, and, eq, sql } from "drizzle-orm";

async function cleanup() {
    console.log("🧹 Starting Disk Cleanup...");

    // 1. Delete Nonces
    console.log("   - Cleaning expired nonces...");
    const now = new Date();
    try {
        const noncesRes = await db.delete(authNonces)
            .where(lt(authNonces.expiresAt, now))
            .returning();
        console.log(`     ✅ Deleted ${noncesRes.length} expired nonces.`);
    } catch (err) {
        console.error("     ❌ Error cleaning nonces:", err);
    }

    // 2. Delete Stale Drafts
    console.log("   - Cleaning stale drafts (>30 days)...");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const draftsRes = await db.delete(invoices)
            .where(and(
                eq(invoices.status, 'draft'),
                lt(invoices.updatedAt, thirtyDaysAgo)
            ))
            .returning();
        console.log(`     ✅ Deleted ${draftsRes.length} stale drafts.`);
    } catch (err) {
        console.error("     ❌ Error cleaning drafts:", err);
    }

    // 3. Prune Sessions (Raw SQL)
    console.log("   - Cleaning expired sessions...");
    try {
        // user_sessions table from connect-pg-simple
        // columns: sid, sess, expire
        await db.execute(sql`DELETE FROM "user_sessions" WHERE "expire" < NOW()`);
        console.log(`     ✅ Pruned expired sessions.`);
    } catch (e: any) {
        if (e.message?.includes('does not exist')) {
            console.log("     ℹ️  Session table does not exist (skipping).");
        } else {
            console.log("     ⚠️  Could not clean sessions (might be different table name):", e.message);
        }
    }

    // 4. Reclaim Space (Postgres only)
    console.log("🗜️  Reclaiming disk space (VACUUM FULL)...");
    if (!process.env.DATABASE_URL) {
        console.log("   ℹ️  Skipping VACUUM (SQLite detected, or no URL).");
    } else {
        try {
            console.log("   - Vaccuming 'auth_nonces'...");
            await db.execute(sql`VACUUM FULL "auth_nonces"`);

            console.log("   - Vaccuming 'invoices'...");
            await db.execute(sql`VACUUM FULL "invoices"`);

            console.log("   - Vaccuming 'invoice_line_items'...");
            await db.execute(sql`VACUUM FULL "invoice_line_items"`);

            try {
                console.log("   - Vaccuming 'user_sessions'...");
                await db.execute(sql`VACUUM FULL "user_sessions"`);
            } catch { /* ignore if missing */ }

            console.log("   ✅ Disk space reclaimed.");
        } catch (err) {
            console.error("   ❌ VACUUM failed (you might need superuser, or DB is busy):", err);
        }
    }

    console.log("Done.");
    process.exit(0);
}

cleanup().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
