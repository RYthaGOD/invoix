// Database integration - SQLite for development, Postgres for production
import { drizzle as drizzleSQLite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool, Client } = pg;

import Database from 'better-sqlite3';
import * as schemaPg from "@shared/invoice-schema";
import * as schemaSqlite from "@shared/invoice-schema-sqlite";

// Use SQLite for local development (no DATABASE_URL needed)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const useSQLite = isDevelopment && !process.env.DATABASE_URL;

const schema = useSQLite ? schemaSqlite : schemaPg;

// Export strictly typed DB instance using Postgres schema (Production Priority)
export type AppDatabase = NodePgDatabase<typeof schemaPg>;

// Explicitly type db for strict TypeScript validation across the app
export let db: AppDatabase;

// Declare pool at top level for export (will be undefined in SQLite mode)
export let pool: pg.Pool | undefined;

// State to track current SSL mode for self-healing
let currentSSLMode: string | undefined;

// HELPER FUNCTIONS Definitions (Must be outside block for clarity, though JS allows hoisting)
function getSSLConfig(mode: string) {
  if (mode === 'disable') return false;
  return { rejectUnauthorized: false };
}

function createPool(forcedSSLMode?: string): string {
  // Only used in Postgres mode
  const isInternal = process.env.DATABASE_URL?.includes('railway.internal');

  let mode = forcedSSLMode;
  if (!mode) {
    // Default Smart Logic
    mode = process.env.DB_SSL_MODE || (isInternal ? 'disable' : 'require');
  }

  const sslConfig = getSSLConfig(mode);
  console.log(`🔌 Initializing DB Pool. Mode: ${mode} (SSL: ${sslConfig ? 'YES' : 'NO'})`);

  // Destroy old pool if exists
  if (pool) {
    pool.end().catch(() => { });
  }

  // Clean connection string to prevent parameter conflicts (e.g. ?sslmode=require vs ssl: false)
  let connectionString = process.env.DATABASE_URL || "";
  try {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('ssl');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('options'); // Sometimes options=-c%20... causes issues
    connectionString = urlObj.toString();
  } catch (e) {
    // failed to parse, use original
  }

  pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Global pool error handler
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return mode;
}

// INITIALIZATION LOGIC
if (useSQLite) {
  // SQLite setup for local development
  const sqlite = new Database('./data/invoices.db');
  sqlite.pragma('foreign_keys = ON');
  sqlite.function('gen_random_uuid', () => crypto.randomUUID());
  sqlite.function('now', () => new Date().toISOString());

  console.log('✅ Using SQLite database: ./data/invoices.db');
  db = drizzleSQLite(sqlite, { schema: schema as any }) as unknown as AppDatabase;

} else {
  // PostgreSQL setup for production
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for production.");
  }
  console.log('✅ Using PostgreSQL database (pg driver)');

  // Initial Pool Creation
  currentSSLMode = createPool();
  db = drizzlePg(pool!, { schema: schemaPg }) as AppDatabase;
}

// ------------
// EXPORTED FUNCTIONS (Must be Top-Level)
// ------------

export async function runMigrations() {
  if (useSQLite) {
    console.log('Skipping Postgres migrations (using SQLite)');
    return;
  }

  try {
    console.log('⏳ Running database migrations...');
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const fs = await import("fs");
    const path = await import("path");

    let migrationsFolder = path.resolve(process.cwd(), "migrations");
    if (process.env.NODE_ENV === "production") {
      const distMigrations = path.resolve(process.cwd(), "dist", "migrations");
      if (fs.existsSync(distMigrations)) {
        migrationsFolder = distMigrations;
      }
    }

    console.log(`Using migrations folder: ${migrationsFolder}`);

    // Diagnostic
    const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
    if (fs.existsSync(journalPath)) {
      console.log(`✅ Found migration journal at ${journalPath}`);
    } else {
      console.error(`❌ CRITICAL: Migration journal not found at ${journalPath}`);
    }

    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export async function checkDatabaseConnection(retries = 30, delay = 2000): Promise<{ connected: boolean; error?: string }> {
  if (useSQLite) return { connected: true };
  if (!pool) return { connected: false, error: "Pool not initialized" };

  let lastError = "Unknown error";

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Database connection established');
      return { connected: true };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.log(`⏳ DB Attempt ${i + 1}/${retries} Failed: ${lastError}`);

      // AUTO-HEALING: Probe with opposite SSL mode
      if (i === 0 && currentSSLMode) { // Only probe on first failure
        const altMode = currentSSLMode === 'require' ? 'disable' : 'require';
        console.log(`🕵️ Probing alternative SSL mode: ${altMode}...`);

        const probeClient = new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: getSSLConfig(altMode),
          connectionTimeoutMillis: 5000,
        });

        try {
          await probeClient.connect();
          await probeClient.end();
          console.log(`💡 SUCCESS! Alternative SSL mode (${altMode}) worked.`);
          console.log("🔄 Switching Main Pool to use valid configuration...");

          // Re-create pool
          currentSSLMode = createPool(altMode);

          // Re-init Drizzle (Critical!)
          db = drizzlePg(pool!, { schema: schemaPg }) as AppDatabase;

          // Retry loop immediately with new pool
          continue;
        } catch (probeErr: any) {
          const probeMsg = `Probe failed (${altMode}): ${probeErr.message}`;
          console.log(`❌ ${probeMsg}. Sticking with ${currentSSLMode}.`);
          lastError += ` | ${probeMsg}`;
        }
      }

      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  return { connected: false, error: `${lastError} (Mode: ${currentSSLMode})` };
}

export async function runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  if (useSQLite) {
    return await callback(db);
  } else {
    return await db.transaction(callback);
  }
}
