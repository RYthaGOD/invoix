import { defineConfig } from "drizzle-kit";

// Use SQLite for development (when DATABASE_URL is not set)
const useSQLite = !process.env.DATABASE_URL;

export default defineConfig({
  out: "./migrations",
  schema: useSQLite ? "./shared/invoice-schema-sqlite.ts" : ["./shared/invoice-schema.ts", "./shared/webhooks-schema.ts"],
  dialect: useSQLite ? "sqlite" : "postgresql",
  dbCredentials: useSQLite
    ? { url: "./data/invoices.db" }
    : { url: process.env.DATABASE_URL! },
});
