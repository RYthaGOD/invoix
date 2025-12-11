
import 'dotenv/config';
import { db } from "./db";
import { payments } from "@shared/invoice-schema";
import { sql } from "drizzle-orm";
import * as fs from 'fs';

const logFile = 'diagnosis_result.txt';

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function diagnose() {
    fs.writeFileSync(logFile, "STARTING DIAGNOSIS\n");

    try {
        log("1. Testing DB Connection...");
        // Simple query
        const result = await db.execute(sql`SELECT 1 as connected`);
        log("DB Connected successfully.");

        log("2. Checking 'payments' table existence...");
        // Check postgres info schema
        const existsMap = await db.execute(sql`
        SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE  table_schema = 'public'
           AND    table_name   = 'payments'
        );
    `);
        log("Check Result: " + JSON.stringify(existsMap));

        log("3. Running Select Query...");
        const rows = await db.select().from(payments).limit(1);
        log("Select Query Success. Rows found: " + rows.length);

        // Check createdAt column by explicit SQL if select worked
        log("4. Checking Sort Column...");
        const sortCheck = await db.execute(sql`SELECT created_at FROM payments LIMIT 1`);
        log("Sort Column Access Success.");

    } catch (error: any) {
        log("ERROR DETECTED:");
        log("Message: " + error.message);
        log("Stack: " + error.stack);
    }

    process.exit(0);
}

diagnose();
