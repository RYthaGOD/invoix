import { beforeAll, afterAll } from "vitest";

// Use distinct port/env for tests if needed, though supertest often doesn't need a port
process.env.NODE_ENV = "test";
process.env.PORT = "5002"; // Avoid conflict with dev server
delete process.env.DATABASE_URL; // Force SQLite usage

// Mock database interactions if necessary, or use a test DB file
// For this phase, we rely on the dev DB or a separate test implementation
// Ideally, we'd swap process.env.DATABASE_URL to a :memory: sqlite db for isolation

import { startupPromise, app } from "../server/index";

beforeAll(async () => {
    // Wait for server to be ready (DB connected, routes registered)
    await startupPromise;
    console.log("Test Server Ready");
});

export { app };
