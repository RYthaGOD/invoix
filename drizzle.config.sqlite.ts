import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./migrations",
    schema: "./shared/invoice-schema-sqlite.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: "./data/invoices.db",
    },
});
