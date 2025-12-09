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

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for most cloud Postgres providers
  });

  db = drizzlePg(pool, { schema: schemaPg }) as AppDatabase;
}


