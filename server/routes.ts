import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth-routes";
import { registerInvoiceRoutes } from "./invoice-routes";
import { registerNftRoutes } from "./nft-routes";
import { registerCustomerRoutes } from "./customer-routes";
import { registerTemplateRoutes } from "./template-routes";
import { registerUploadRoutes } from "./upload-routes";
import { registerProfileRoutes } from "./profile-routes";
import { registerSpecialMintRoutes } from "./special-mint-routes";
import { paymentRouter } from "./payment-routes";
import { registerCommunityDropRoutes } from "./community-drop-routes";
import exportRouter from "./export-routes";
import { pricingRouter } from "./pricing-routes";
import { registerSolanaPayRoutes } from "./solana-pay-routes";
import { registerWaitlistRoutes } from "./waitlist-routes";

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
  // EXPORT ROUTES (Mounted under /invoices to access /api/invoices/export)
  // ================================================
  app.use("/api/invoices", exportRouter);

  app.use("/api/pricing", pricingRouter);

  // ================================================
  // NFT MINTING ROUTES (User-Paid)
  // ================================================
  registerNftRoutes(app);

  // ================================================
  // GASLESS PAYMENT ROUTES
  // ================================================
  app.use("/api", paymentRouter);

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

  // ================================================
  // SPECIAL NFT ROUTES
  // ================================================
  registerSpecialMintRoutes(app);

  // ================================================
  // COMMUNITY DROP ROUTES (Invoice Gated)
  // ================================================
  registerCommunityDropRoutes(app);

  // ================================================
  // SOLANA PAY ROUTES (Mobile Integration)
  // ================================================
  registerSolanaPayRoutes(app);

  // ================================================
  // WAITLIST / DEVELOPER ROUTES
  // ================================================
  registerWaitlistRoutes(app);

  const server = createServer(app);
  return server;
}
