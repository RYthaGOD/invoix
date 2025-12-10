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
const isDevelopment = process.env.NODE_ENV === 'development';
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
  const isInternal = process.env.DATABASE_URL?.includes('railway.internal');
  const sslMode = process.env.DB_SSL_MODE || (isInternal ? 'disable' : 'require');

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

    // Determine the correct path
    // If running in tsx (dev), it's "migrations" in root.
    // If running in production (node dist/index.js), we expect "migrations" relative to the script OR "dist/migrations" if relative to root?
    // Let's try to resolve it relative to the current working directory first.

    // Try to find the migrations folder
    const fs = await import("fs");
    const path = await import("path");

    let migrationsFolder = "migrations";

    if (process.env.NODE_ENV === "production") {
      // In production, we might be running "node dist/index.js" from root
      // So "dist/migrations" would be the path if copied there
      if (fs.existsSync(path.resolve("dist/migrations"))) {
        migrationsFolder = "dist/migrations";
      } else if (fs.existsSync(path.resolve("migrations"))) {
        // Fallback to root migrations if verified
        migrationsFolder = "migrations";
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

export async function checkDatabaseConnection(retries = 10, delay = 2000): Promise<boolean> {
  if (useSQLite) return true;
  if (!pool) return false;

  console.log(`🔍 Checking database connection... (Timeout: ${retries * delay}ms)`);

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Database connection established');
      return true;
    } catch (err) {
      console.log(`⏳ Waiting for database... (Attempt ${i + 1}/${retries})`);
      if (i === retries - 1) {
        console.error('❌ Database connection failed:', (err as Error).message);
        // Don't throw here, let the caller decide or just return false
      }
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw new Error(`❌ Failed to connect to database after ${retries} attempts`);
}



