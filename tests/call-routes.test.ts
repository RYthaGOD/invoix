import { describe, it, expect } from "vitest";
import express from "express";
import { registerRoutes } from "../server/routes";
import request from "supertest";

describe("Debug Call Routes Central", () => {
    it("should register ALL central routes", async () => {
        console.log("Creating app...");
        const app = express();

        console.log("Calling registerRoutes...");
        try {
            await registerRoutes(app);
            console.log("Routes registered!");
        } catch (e: any) {
            console.error("CRASH registering routes:", e);
            throw e;
        }

        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);

        expect(true).toBe(true);
    });
});
