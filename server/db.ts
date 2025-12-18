// Database integration - SQLite for development, Postgres for production
import { drizzle as drizzleSQLite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;

import Database from 'better-sqlite3';
import * as schemaPg from "@shared/invoice-schema";
import * as schemaSqlite from "@shared/invoice-schema-sqlite";

// Use SQLite for local development (no DATABASE_URL needed)
// Use Postgres for production (requires DATABASE_URL)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const useSQLite = isDevelopment && !process.env.DATABASE_URL;

const schema = useSQLite ? schemaSqlite : schemaPg;

// Export strictly typed DB instance using Postgres schema (Production Priority)
export type AppDatabase = NodePgDatabase<typeof schemaPg>;

// Explicitly type db for strict TypeScript validation across the app
export let db: AppDatabase;

// Declare pool at top level for export (will be undefined in SQLite mode)
export let pool: pg.Pool | undefined;

if (useSQLite) {
  // SQLite setup for local development
  const sqlite = new Database('./data/invoices.db');

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');

  // Polyfill generic Postgres functions for SQLite compatibility
  sqlite.function('gen_random_uuid', () => crypto.randomUUID());
  sqlite.function('now', () => new Date().toISOString());

  console.log('✅ Using SQLite database: ./data/invoices.db');

  // Force cast SQLite instance to AppDatabase to satisfy TypeScript
  // This allows strict typing in the rest of the app based on the Production schema
  db = drizzleSQLite(sqlite, { schema: schema as any }) as unknown as AppDatabase;
} else {
  // PostgreSQL setup for production (using pg driver for Railway/Standard Postgres)
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set for production. For local development, unset DATABASE_URL to use SQLite.",
    );
  }

  console.log('✅ Using PostgreSQL database (pg driver)');

  // Create a reusable pool configuration with smart SSL default
  // Allow manual override via DB_SSL_MODE
  // Create a reusable pool configuration with smart SSL default
  // Allow manual override via DB_SSL_MODE
  const isInternal = process.env.DATABASE_URL?.includes('railway.internal');
  // Default to 'require' (with allow self-signed) to prevent "Connection terminated unexpectedly"
  // Many internal networks still accept/prefer SSL, and 'disable' can cause termination if server expects SSL.
  const sslMode = process.env.DB_SSL_MODE || 'require';

  const sslConfig = sslMode === 'disable' ? false : { rejectUnauthorized: false };

  console.log(`🔌 DB SSL Mode: ${sslMode} (Internal network: ${isInternal})`);

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    max: 10, // Reduce pool size for safety on smaller plans
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true, // Prevent TCP dropouts
    keepAliveInitialDelayMillis: 10000,
  });

  // Global pool error handler to prevent crashing on "Connection terminated unexpectedly"
  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    // Don't exit, just log. The pool will reconnect.
  });


  db = drizzlePg(pool, { schema: schemaPg }) as AppDatabase;
}

export async function runMigrations() {
  if (useSQLite) {
    console.log('Skipping Postgres migrations (using SQLite)');
    return;
  }

  try {
    console.log('⏳ Running database migrations...');
    // Dynamic import to avoid bundling issues if possible, or just standard import
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");

    // In production (bundled), the migrations are copied to dist/migrations
    // But we are running from dist/index.js, so the relative path "migrations" locally works if cwd is project root.
    // However, if we start from dist, we need to be careful.
    // The build script now copies migrations to dist/migrations.

    // Determine the correct path - ALWAYS use absolute paths to avoid ambiguity
    const fs = await import("fs");
    const path = await import("path");

    // Default to resolving "migrations" relative to CWD (root)
    let migrationsFolder = path.resolve(process.cwd(), "migrations");

    if (process.env.NODE_ENV === "production") {
      // In production, prefer the "dist/migrations" folder if it exists
      const distMigrations = path.resolve(process.cwd(), "dist", "migrations");

      if (fs.existsSync(distMigrations)) {
        migrationsFolder = distMigrations;
      }
    }

    console.log(`Using migrations folder: ${migrationsFolder}`);

    // Diagnostic check for meta/_journal.json
    const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
    if (!fs.existsSync(journalPath)) {
      console.error(`❌ CRITICAL: Migration journal not found at ${journalPath}`);
      // List contents of the migrations folder for debugging
      if (fs.existsSync(migrationsFolder)) {
        console.log(`Contents of ${migrationsFolder}:`, fs.readdirSync(migrationsFolder));
        const metaDir = path.join(migrationsFolder, "meta");
        if (fs.existsSync(metaDir)) {
          console.log(`Contents of ${metaDir}:`, fs.readdirSync(metaDir));
        } else {
          console.log(`Meta directory does not exist at ${metaDir}`);
        }
      } else {
        console.log(`Migrations folder does not exist at ${migrationsFolder}`);
      }
    } else {
      console.log(`✅ Found migration journal at ${journalPath}`);
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
  if (!pool) return { connected: false, error: "Database pool not initialized (DATABASE_URL missing?)" };

  const connectionString = process.env.DATABASE_URL || "";
  const isInternal = connectionString.includes('railway.internal');
  const host = connectionString.split('@')[1]?.split(':')[0] || 'unknown';

  console.log(`🔍 Connection Config: Host=${host}, Internal=${isInternal}, SSL=${process.env.DB_SSL_MODE || 'require'}`);
  console.log(`🔍 Checking database connection... (Timeout: ${retries * delay}ms)`);

  let lastError = "Unknown error";

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Database connection established');
      return { connected: true };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.log(`⏳ Waiting for database... (Attempt ${i + 1}/${retries}) - Error: ${lastError}`);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  console.error('❌ Database connection failed:', lastError);
  return { connected: false, error: lastError };
}

/**
 * Transaction helper to support Async logic in SQLite (Tests/Dev).
 * Drizzle's better-sqlite3 driver does not support async transactions.
 * In Prod (Postgres), we use real transactions.
 * In Dev/Test (SQLite), we bypass transaction wrapper if async is needed.
 */
export async function runTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  if (useSQLite) {
    // Run directly on DB instance (No Atomicity, but allows Async)
    return await callback(db);
  } else {
    // Run in proper transaction (Postgres supports Async)
    return await db.transaction(callback);
  }
}
