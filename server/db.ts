// Database integration - SQLite for development, Postgres for production
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
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

// Type re-exports based on schema being used
// Note: Types between schemas should be compatible enough for this application
// but in strict TypeScript, they might diverge slightly (e.g. number vs Date).
// Since we use 'mode: timestamp' in SQLite, Dates should be preserved.


let db;

if (useSQLite) {
  // SQLite setup for local development
  const sqlite = new Database('./data/invoices.db');

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');

  console.log('✅ Using SQLite database: ./data/invoices.db');

  db = drizzleSQLite(sqlite, { schema });
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

  db = drizzlePg(pool, { schema });
}

export { db };
