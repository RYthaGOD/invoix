
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Force disable TLS rejection for self-signed certs (Supabase Pooler)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    connectionString: process.env.DATABASE_URL?.split('?')[0], // Strip params like sslmode=require
    ssl: { rejectUnauthorized: false }
});

async function checkTables() {
    try {
        await client.connect();
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log("📂 Tables in 'public' schema:");
        res.rows.forEach(row => console.log(` - ${row.table_name}`));

        const webhooks = res.rows.find(r => r.table_name === 'webhooks');
        if (webhooks) {
            console.log("✅ 'webhooks' table EXISTS.");
        } else {
            console.error("❌ 'webhooks' table is MISSING.");
        }

    } catch (err) {
        console.error("Error checking tables:", err);
    } finally {
        await client.end();
    }
}

checkTables();
