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

const schema = useSQLite ? schemaSqlite : schemaPg;

// Export strictly typed DB instance using Postgres schema (Production Priority)
export type AppDatabase = NodePgDatabase<typeof schemaPg>;

// Explicitly type db for strict TypeScript validation across the app
export let db: AppDatabase;

// Declare pool at top level for export (will be undefined in SQLite mode)
export let pool: pg.Pool | undefined;

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

// ------------
// EXPORTED FUNCTIONS
// ------------

export async function runMigrations() {
  if (useSQLite) return;

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
