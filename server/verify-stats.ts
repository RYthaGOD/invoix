import 'dotenv/config';
import { invoiceStorage } from './invoice-storage';
import * as fs from 'fs';

async function verifyStats() {
    try {
        console.log("Verifying Global Stats...");
        const stats = await invoiceStorage.getGlobalStats();
        console.log("Global Stats Result:", JSON.stringify(stats, null, 2));

        fs.writeFileSync('stats-output.json', JSON.stringify(stats, null, 2));

        // Basic assertion check
        if (stats.totalVolume === undefined) {
            console.error("❌ totalVolume is missing!");
            process.exit(1);
        }

        process.exit(0);
    } catch (error: any) {
        console.error("Error verifying stats:", error);
        fs.writeFileSync('stats-output.json', JSON.stringify({ error: String(error) }));
        process.exit(1);
    }
}

verifyStats();
