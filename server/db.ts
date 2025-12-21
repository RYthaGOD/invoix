// Database integration - SQLite for development, Postgres for production
import { drizzle as drizzleSQLite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;

import Database from 'better-sqlite3';
import * as schemaPg from "@shared/invoice-schema";
import * as schemaSqlite from "@shared/invoice-schema-sqlite";

// Use SQLite for local development (no DATABASE_URL needed)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const useSQLite = isDevelopment && !process.env.DATABASE_URL;

// Export the schema so other files can use the correct one (SQLite vs Postgres)
export const schema = useSQLite ? schemaSqlite : schemaPg;

// Export strictly typed DB instance using Postgres schema (Production Priority)
export type AppDatabase = NodePgDatabase<typeof schemaPg>;

// Explicitly type db for strict TypeScript validation across the app
export let db: AppDatabase;

// Declare pool at top level for export (will be undefined in SQLite mode)
export let pool: pg.Pool | undefined;

// INITIALIZATION LOGIC
if (useSQLite) {
  // SQLite setup for local development
  const fs = await import("fs");
  const path = await import("path");
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database('./data/invoices.db');
  sqlite.pragma('foreign_keys = ON');
  sqlite.function('gen_random_uuid', () => crypto.randomUUID());
  sqlite.function('now', () => new Date().toISOString());

  console.log('✅ Using SQLite database: ./data/invoices.db');
  db = drizzleSQLite(sqlite, { schema: schema as any }) as unknown as AppDatabase;

} else {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL not set. Production database operations will fail until it is provided.");
    // We let the pool initialization be skipped or deferred
  } else {
    console.log('✅ Using PostgreSQL database (pg driver)');

    // Determine SSL mode based on URL and Environment
    const isInternal = process.env.DATABASE_URL.includes('railway.internal');

    // Standard Railway Config:
    // Internal = No SSL
    // Public = SSL Required (rejectUnauthorized: false)
    const sslConfig = isInternal ? false : { rejectUnauthorized: false };

    console.log(`🔌 DB Config: Internal=${isInternal}, SSL=${!!sslConfig}`);

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      max: 5, // Conservative limit to prevent 'terminating connection' due to overload
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    db = drizzlePg(pool, { schema: schemaPg }) as AppDatabase;
  }
}

// ------------
// EXPORTED FUNCTIONS
// ------------

export async function runMigrations() {
  try {
    console.log('⏳ Running database migrations...');
    const fs = await import("fs");
    const path = await import("path");

    if (useSQLite) {
      const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
      let migrationsFolder = path.resolve(process.cwd(), "migrations");
      console.log(`Using SQLite migrations folder: ${migrationsFolder}`);
      // Cast db to any because better-sqlite3 migrator expects BetterSQLite3Database
      await migrate(db as any, { migrationsFolder });
      console.log('✅ SQLite Migrations completed successfully');
      return;
    }

    const { migrate } = await import("drizzle-orm/node-postgres/migrator");

    let migrationsFolder = path.resolve(process.cwd(), "migrations");
    if (process.env.NODE_ENV === "production") {
      const distMigrations = path.resolve(process.cwd(), "dist", "migrations");
      if (fs.existsSync(distMigrations)) {
        migrationsFolder = distMigrations;
      }
    }

    console.log(`Using migrations folder: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Connection resiliency logic
export async function checkDatabaseConnection(retries = 30, delay = 2000): Promise<{ connected: boolean; error?: string }> {
  if (useSQLite) return { connected: true };
  if (!pool) return { connected: false, error: "Pool not initialized" };

  let lastError = "Unknown error";

  // Attempt IPv4 resolution if we are having connectivity issues
  const dns = await import('dns');
  const { promises: dnsPromises } = dns;

  // Parse current URL to get hostname (Robustly)
  let currentUrl = process.env.DATABASE_URL || "";
  let urlObj: URL | null = null;
  let hostname = "";

  try {
    urlObj = new URL(currentUrl);
    hostname = urlObj.hostname;
  } catch (e) {
    // Fallback: simple extraction for validation
    const match = currentUrl.match(/@([^:/]+)(?::(\d+))?/);
    if (match) hostname = match[1];
  }

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Database connection established');
      return { connected: true };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.log(`⏳ DB Attempt ${i + 1}/${retries} Failed: ${lastError}`);

      // FIX: If ENETUNREACH (IPv6 issue), force resolve to IPv4 and recreate pool
      // Also handle default error 'address not found' if DNS is weird
      if ((lastError.includes('ENETUNREACH') || lastError.includes('EAI_AGAIN') || lastError.includes('ETIMEDOUT')) && hostname && i === 0) {
        console.log(`🌍 Network Reachability Error detected: ${lastError}`);
        console.log(`🔄 Attempting to resolve host '${hostname}' to IPv4...`);
        try {
          const ipv4Addresses = await dnsPromises.resolve4(hostname);
          if (ipv4Addresses && ipv4Addresses.length > 0) {
            const newIp = ipv4Addresses[0];
            console.log(`✅ Resolved to IPv4: ${newIp}`);

            // Reconstruct URL with IP
            // If URL object is valid, use it. If not, use string replacement (risky if hostname appears in password, but unlikely for full domain)
            let newConnectionString = "";
            if (urlObj) {
              urlObj.hostname = newIp;
              newConnectionString = urlObj.toString();
            } else {
              newConnectionString = currentUrl.replace(hostname, newIp);
            }

            // Update Process Env (for persistence in this session)
            process.env.DATABASE_URL = newConnectionString;

            // Recreate Pool
            console.log("♻️  Recreating DB Pool with IPv4 Address...");
            await pool.end().catch(() => { });

            const isInternal = newConnectionString.includes('railway.internal');
            // For IP addresses, always require SSL unless internal, but often we need rejectUnauthorized: false since IP won't match cert
            const sslConfig = isInternal ? false : { rejectUnauthorized: false };

            pool = new Pool({
              connectionString: newConnectionString,
              ssl: sslConfig,
              max: 5,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
            });

            pool.on('error', (e) => console.error('Unexpected error on idle client', e));

            // Update Drizzle reference
            db = drizzlePg(pool, { schema: schemaPg }) as AppDatabase;

            console.log("🚀 IPv4 Pool Active. Retrying connection...");
            continue; // Retry immediately
          }
        } catch (dnsErr) {
          console.error("❌ DNS Resolution failed:", dnsErr);
        }
      }

      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  return { connected: false, error: lastError };
}

export async function runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  if (useSQLite) {
    return await callback(db);
  } else {
    return await db.transaction(callback);
  }
}
