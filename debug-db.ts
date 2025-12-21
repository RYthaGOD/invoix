
import 'dotenv/config';
import { checkDatabaseConnection } from './server/db.js';

console.log("TESTING DATABASE CONNECTION...");
const maskedUrl = process.env.DATABASE_URL?.replace(/:([^:@]+)@/, (match, p1) => `:${"*".repeat(p1.length)}@`);
console.log("URL:", maskedUrl);

async function main() {
    process.env.NODE_ENV = 'production';
    try {
        const result = await checkDatabaseConnection(5, 1000);
        console.log("Result:", result);
        process.exit(result.connected ? 0 : 1);
    } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
    }
}

main();
