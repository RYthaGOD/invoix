import type { Express } from "express";
import { createServer, type Server } from "http";

import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  requireWalletOwnership,

} from "./security";
// Import crypto functions at module level for security

// Import invoice routes
import { registerInvoiceRoutes } from "./invoice-routes";

// Import auth routes
import { registerAuthRoutes } from "./auth-routes";

// Import export routes
import exportRouter from "./export-routes";

// Import NFT routes
import { registerNftRoutes } from "./nft-routes";

// Import Customer routes
import { registerCustomerRoutes } from "./customer-routes";

// Import Template routes
import { registerTemplateRoutes } from "./template-routes";

// Import Upload routes
import { registerUploadRoutes } from "./upload-routes";

// Import Profile routes
import { registerProfileRoutes } from "./profile-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Invoix B2B Invoicing Platform" });
  });

  // ================================================
  // AUTHENTICATION ROUTES
  // ================================================
  registerAuthRoutes(app);

  // ================================================
  // INVOICE ROUTES (New B2B Invoicing System)
  // ================================================
  registerInvoiceRoutes(app);


  // ================================================
  // EXPORT ROUTES (Accounting)
  // ================================================
  app.use("/api/exports", exportRouter);

  // ================================================
  // NFT MINTING ROUTES (User-Paid)
  // ================================================
  registerNftRoutes(app);

  // ================================================
  // CUSTOMER ROUTES
  // ================================================
  registerCustomerRoutes(app);

  // ================================================
  // TEMPLATE ROUTES
  // ================================================
  registerTemplateRoutes(app);

  // ================================================
  // UPLOAD ROUTES (Logos)
  // ================================================
  registerUploadRoutes(app);

  // ================================================
  // BUSINESS PROFILE ROUTES
  // ================================================
  registerProfileRoutes(app);

  const server = createServer(app);
  return server;
}
