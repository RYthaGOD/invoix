
import "dotenv/config";
import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    if (!pool) {
        console.log("No Postgres pool. Skipping.");
        return;
    }

    try {
        console.log("Dropping conflicting tables...");
        // Drop tables that are causing migration conflicts
        await db.execute(sql`DROP TABLE IF EXISTS "marketplace_access_requests" CASCADE;`);
        await db.execute(sql`DROP TABLE IF EXISTS "audit_logs" CASCADE;`);
        console.log("Tables dropped.");
    } catch (e) {
        console.error("Error dropping tables:", e);
    } finally {
        await pool.end();
    }
}

main();
