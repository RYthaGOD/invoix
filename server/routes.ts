
import type { Express } from "express";
import { validateApiKey } from "./middleware/api-auth";
import { getArciumService, loadKeypairFromPrivateKey } from "./arcium-service";
import { getArciumOnChainService } from "./arcium-onchain-service";
import { getInvoiceNFTService, initializeNFTService } from "./nft-service";
import { getEmailService } from "./email-service"; // Import Email Service
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
import { analyticsRouter } from "./analytics-routes";
import { registerDynamicImageRoutes } from "./endpoints/dynamic-image";
import { registerCreditRoutes } from "./credit-routes";
import { registerMarketplaceRoutes } from "./marketplace-routes";
import { registerSubscriptionRoutes } from "./subscription-routes";
import webhookRouter from "./webhook-routes";
import { startWebhookCron } from "./webhook-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Invoix B2B Invoicing Platform" });
  });

  // ================================================
  // DYNAMIC IMAGE ROUTES (8K 3D Upgrade)
  // ================================================
  registerDynamicImageRoutes(app);

  // System status for dashboard badges
  app.get("/api/system/status", (_req, res) => {
    res.json({
      success: true,
      services: {
        arcium: { status: "ACTIVE", version: "0.5", label: "Arcium MXE 0.5" },
        x402: { status: "ACTIVE", label: "x402 Anti-Spam", skipFee: process.env.SKIP_FEE_CHECK === "true" },
        replay: { status: "SECURE", label: "Anti-Replay Guard" },
        atomic: { status: "ENFORCED", label: "Atomic Sequential" }
      },
      network: {
        status: "OPTIMIZED",
        rpc: process.env.SOLANA_NETWORK || "devnet"
      }
    });
  });

  // ================================================
  // ANALYTICS ROUTES
  // ================================================
  app.use("/api/analytics", analyticsRouter);

  // ================================================
  // AUTHENTICATION ROUTES
  // ================================================
  registerAuthRoutes(app);

  // ================================================
  // INVOICE ROUTES (New B2B Invoicing System)
  // ================================================
  await registerInvoiceRoutes(app);

  // ================================================
  // EXPORT ROUTES
  // ================================================
  app.use("/api/exports", exportRouter);

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

  // ================================================
  // CREDIT SCORING ROUTES (Invoice Marketplace)
  // ================================================
  registerCreditRoutes(app);

  // ================================================
  // INVOICE MARKETPLACE ROUTES
  // ================================================
  registerMarketplaceRoutes(app);

  // ================================================
  // SUBSCRIPTION / RECURRING BILLING ROUTES
  // ================================================
  registerSubscriptionRoutes(app);

  // ================================================
  // WEBHOOK ROUTES (Enterprise Oracle/ERP Integration)
  // ================================================
  app.use("/api/webhooks", webhookRouter);
  startWebhookCron();

  // ================================================
  // TAX DATA EXPORT ROUTES (Annual Reporting)
  // ================================================
  const { registerTaxRoutes } = await import("./tax-routes");
  registerTaxRoutes(app);

  // ================================================
  // GDPR COMPLIANCE ROUTES (Data Privacy)
  // ================================================
  const { registerGDPRRoutes } = await import("./gdpr-routes");
  registerGDPRRoutes(app);

  // ================================================
  // ADMIN: Glass Citadel Diagnostic Endpoint
  // ================================================



  const server = createServer(app);
  return server;
}
