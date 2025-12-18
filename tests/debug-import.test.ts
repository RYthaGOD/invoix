```
import { describe, it, expect } from "vitest";
import { db } from "../server/db";
import { registerInvoiceRoutes } from "../server/invoice-routes";
import express from "express";

describe("Debug Import", () => {
  it("should load db", () => {
    expect(db).toBeDefined();
  });

  it("should load routes", () => {
     const app = express();
     registerInvoiceRoutes(app);
     expect(true).toBe(true);
  });
});
```
