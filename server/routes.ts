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
  // ADMIN: Glass Citadel Diagnostic Endpoint
  // ================================================

  // TEMPORARY: Unauthenticated GET for debugging (shows last init error)
  app.get("/api/admin/glass-citadel/status", async (req, res) => {
    try {
      const { getInvoiceNFTService, initializeNFTService } = await import("./nft-service");
      const { loadKeypairFromPrivateKey } = await import("./arcium-service");
      const { db } = await import("./db");
      const { systemSettings } = await import("@shared/invoice-schema");
      const { eq } = await import("drizzle-orm");

      const nftService = getInvoiceNFTService();

      // Get current in-memory state
      const currentState = {
        isReady: nftService.isReady(),
        hasCollection: nftService.hasCollection(),
        merkleTree: nftService.isReady() ? nftService.getMerkleTree() : null,
        collectionMint: nftService.getCollectionMint(),
      };

      // Get DB values
      const dbTreeResult = await db.select().from(systemSettings).where(eq(systemSettings.key, "merkle_tree_address")).limit(1);
      const dbCollectionResult = await db.select().from(systemSettings).where(eq(systemSettings.key, "genesis_collection_mint")).limit(1);

      const dbState = {
        merkleTreeInDb: dbTreeResult[0]?.value || null,
        collectionMintInDb: dbCollectionResult[0]?.value || null,
      };

      // Attempt re-initialization if collection is missing
      let initResult = null;
      let initError = null;

      if (!nftService.hasCollection() && process.env.PAYER_PRIVATE_KEY) {
        try {
          const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
          initResult = await initializeNFTService(payerKeypair);
        } catch (err: any) {
          initError = err.message || String(err);
        }
      }

      // Get after state
      const afterState = {
        isReady: nftService.isReady(),
        hasCollection: nftService.hasCollection(),
        merkleTree: nftService.isReady() ? nftService.getMerkleTree() : null,
        collectionMint: nftService.getCollectionMint(),
      };

      res.json({
        before: currentState,
        db: dbState,
        reinitAttempt: { success: initResult, error: initError },
        after: afterState,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || String(error),
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // TEMPORARY: Clear stale collection from DB
  app.post("/api/admin/glass-citadel/clear-collection", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { systemSettings } = await import("@shared/invoice-schema");
      const { eq } = await import("drizzle-orm");

      // Delete the stale collection entry
      await db.delete(systemSettings).where(eq(systemSettings.key, "genesis_collection_mint"));

      res.json({
        success: true,
        message: "Cleared genesis_collection_mint from DB. Self-healing will create a new one within 60 seconds.",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/admin/glass-citadel/reinit", async (req, res) => {
    try {
      // Admin auth check
      const authHeader = req.headers.authorization;
      const expectedKey = process.env.ADMIN_SECRET_KEY;

      if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { getInvoiceNFTService, initializeNFTService } = await import("./nft-service");
      const { loadKeypairFromPrivateKey } = await import("./arcium-service");

      const nftService = getInvoiceNFTService();

      // Get current state
      const beforeState = {
        version: "debug-v1", // VERIFICATION TAG
        isReady: nftService.isReady(),
        hasCollection: nftService.hasCollection(),
        merkleTree: nftService.getMerkleTree(),
        collectionMint: nftService.getCollectionMint(),
        lastError: nftService.getLastInitializationError() // Expose hidden error
      };

      // Attempt reinitialization
      let initResult = false;
      let initError: string | null = null;

      if (process.env.PAYER_PRIVATE_KEY) {
        try {
          const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
          initResult = await initializeNFTService(payerKeypair);
        } catch (err: any) {
          initError = err.message || String(err);
        }
      } else {
        initError = "PAYER_PRIVATE_KEY not configured";
      }

      // Get after state
      const afterState = {
        isReady: nftService.isReady(),
        hasCollection: nftService.hasCollection(),
        merkleTree: nftService.isReady() ? nftService.getMerkleTree() : null,
        collectionMint: nftService.getCollectionMint(),
      };

      res.json({
        success: initResult,
        error: initError,
        before: beforeState,
        after: afterState,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  const server = createServer(app);
  return server;
}
