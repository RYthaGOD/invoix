
import { checkDatabaseConnection } from './server/db';
import 'dotenv/config';

console.log("TESTING DATABASE CONNECTION...");
console.log("URL:", process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));

async function main() {
    process.env.NODE_ENV = 'production'; // Force PG mode
    const result = await checkDatabaseConnection(5, 1000);
    console.log("Result:", result);
    process.exit(result.connected ? 0 : 1);
}

main();
