import { beforeAll, afterAll } from "vitest";

// Use distinct port/env for tests if needed, though supertest often doesn't need a port
process.env.NODE_ENV = "test";
process.env.PORT = "5002"; // Avoid conflict with dev server
process.env.SKIP_MIGRATIONS = "true"; // Skip migrations as DB is managed externally/manually
delete process.env.DATABASE_URL; // Force SQLite usage

// Set mock program IDs for testing (valid Solana pubkey format)
process.env.MARKETPLACE_PROGRAM_ID = "11111111111111111111111111111112"; // System program (placeholder)
process.env.ARCIUM_PROGRAM_ID = "11111111111111111111111111111112"; // System program (placeholder)

// Mock database interactions if necessary, or use a test DB file
// For this phase, we rely on the dev DB or a separate test implementation
// Ideally, we'd swap process.env.DATABASE_URL to a :memory: sqlite db for isolation

let app: any;
let startupPromise: Promise<any>;

beforeAll(async () => {
    // Dynamic import to ensure env vars are applied BEFORE module load
    const serverModule = await import("../server/index");
    app = serverModule.app;
    startupPromise = serverModule.startupPromise;

    // Wait for server to be ready (DB connected, routes registered)
    await startupPromise;
    console.log("Test Server Ready");
});

export { app };
