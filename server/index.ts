// Load environment variables from .env file
import 'dotenv/config';

// Initialize Sentry FIRST for complete error capture
import { initSentry, sentryRequestHandler, captureError } from './sentry';
initSentry();

import dns from 'node:dns';
// Force IPv4 resolution to prevent connection issues on some networks (like Railway Internal)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./error-handler";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

import {
  securityHeaders,
  globalRateLimit,
  sanitizeInput,
  corsPolicy,
  checkSecurityEnvVars,
  requestSizeLimit,
} from "./security";
import { validateEnvironment } from "./env-validator";
import { healthCheck, liveness, readiness } from "./health";
import { getSystemMetrics } from "./metrics";
import { initializeNFTService } from "./nft-service";
import { initializeArciumService } from "./arcium-service";
import { loadKeypairFromPrivateKey } from "./arcium-service";
import { logger } from "./logger";

// Validate environment variables on startup (before security check)
validateEnvironment();
logger.info("Config reload trigger", "system", { timestamp: Date.now() });

// Check security environment variables on startup
checkSecurityEnvVars();

export const app = express();
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  logger.warn("SESSION_SECRET not set in production! Using insecure default.", "security");
}

// Trust proxy - MUST be set before rate limiting middleware
app.set('trust proxy', true);

// Security middleware - FIRST (headers and CORS before body parsing)
app.use(securityHeaders());
app.use(corsPolicy());
app.use(compression());

// Serve uploaded files statically
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// PLACEHOLDERS for Dynamic Imports
let db: any, pool: any, runMigrations: any, checkDatabaseConnection: any;
let invoiceStorage: any;
let registerRoutes: any;

// Body parsing with size limits
app.use(express.json({ limit: requestSizeLimit }));
app.use(express.urlencoded({ extended: false, limit: requestSizeLimit }));

// Input sanitization
app.use(sanitizeInput);

// Structured JSON Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Only log API and asset requests (skip health)
  if (path === "/health" || path === "/health/live" || path === "/health/ready") {
    return next();
  }

  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info(`${req.method} ${path} ${res.statusCode}`, "express", {
        method: req.method,
        path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        // In perfection phase, we capture success responses but omit large bodies
        response: res.statusCode < 400 ? { success: true } : capturedJsonResponse
      }, req);
    }
  });

  next();
});

// Health check endpoints
app.get("/health", healthCheck);
app.get("/health/live", liveness);
app.get("/health/ready", readiness);
app.get("/api/metrics", async (req, res) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (error: any) {
    logger.error("Failed to fetch metrics", "metrics", { error });
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// Sentry request handler (must be first middleware)
app.use(sentryRequestHandler());

// Global rate limiting for all API routes
app.use("/api", globalRateLimit);

// Module-level variables to be accessible by shutdown function
const isShuttingDown = false;

// -------------------------------------------------------------------------
// REFACTOR: INVINCIBLE STARTUP PATTERN
// -------------------------------------------------------------------------

// Service Readiness State
let isServiceReady = false;
let lastStartupError: string | null = null;
let startupPhase = "bootstrapping";

// Create the server IMMEDIATELY to satisfy platform health checks
const server = createServer(app);
const port = parseInt(process.env.PORT || "5000", 10);

// Server will listen on port after initialization completes (see startup sequence ~line 251)
// This prevents duplicate port binding and ensures maintenance mode works correctly.


// Maintenance Mode Middleware (Intercepts requests until ready)
app.use((req, res, next) => {
  if (!isServiceReady && req.path !== "/health" && !req.path.startsWith("/health/")) {
    return res.status(503).json({
      status: "starting_up",
      message: "Invoix is initializing - Please try again in a few seconds.",
      phase: startupPhase,
      lastError: lastStartupError,
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// GLOBAL STARTUP SEQUENCE
export const startupPromise = (async () => {
  try {
    logger.info("Initializing Invoix Platform Components...", "boot", { cluster: process.env.NODE_ENV });

    // 1. DNS Resolution Check
    if (process.env.DATABASE_URL) {
      startupPhase = "dns_preflight";
      try {
        const urlObj = new URL(process.env.DATABASE_URL);
        logger.info(`DB Host: ${urlObj.hostname}`, "dns");
      } catch {
        logger.warn("Invalid DATABASE_URL format", "dns");
      }
    }

    // Initialize Arcium Service (Non-Critical)
    try {
      if (process.env.ENABLE_ARCIUM_ENCRYPTION === 'true') {
        const arciumSuccess = await initializeArciumService();
        if (arciumSuccess) {
          logger.info("Arcium Service initialized", "arcium");
        }
      } else {
        logger.info("Arcium Encryption Disabled (ENABLE_ARCIUM_ENCRYPTION != true)", "arcium");
      }
    } catch (arciumError: any) {
      logger.error("Arcium Service Initialization Failed", "arcium", { error: arciumError.message || arciumError });
    }

    // 2. Load Modules
    startupPhase = "module_loading";
    const dbModule = await import("./db");
    db = dbModule.db;
    pool = dbModule.pool;
    runMigrations = dbModule.runMigrations;
    checkDatabaseConnection = dbModule.checkDatabaseConnection;

    const storageModule = await import("./invoice-storage");
    invoiceStorage = storageModule.invoiceStorage;
    const routesModule = await import("./routes");
    registerRoutes = routesModule.registerRoutes;

    // 3. Initialize Session Store
    startupPhase = "session_init";
    const PgSession = connectPgSimple(session);
    const sessionStore = pool
      ? new PgSession({
        pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        ttl: 7 * 24 * 60 * 60
      })
      : new (createMemoryStore(session))({ checkPeriod: 86400000 });

    if (process.env.NODE_ENV === "production" && !(sessionStore instanceof PgSession)) {
      if (process.env.STRICT_SESSION === "true") {
        throw new Error("Persistent session store required in production.");
      }
    }

    app.use(session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
      name: "invoix_sid",
    }));

    // TEST MODE: Auth Bypass Middleware
    if (process.env.NODE_ENV === "test") {
      app.use((req, res, next) => {
        const testUser = req.headers['x-test-auth'];
        if (testUser) {
          req.session.walletAddress = Array.isArray(testUser) ? testUser[0] : testUser;
        }
        next();
      });
    }

    // 8. Start server
    startupPhase = "server_start";
    if (process.env.NODE_ENV !== "test") {
      server.listen(port, () => {
        log(`🚀 Server running on port ${port}`);
        log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        log(`   Health: http://localhost:${port}/api/health`);
        startupPhase = "running";

        // Start automated cleanup jobs
        import('./subscription-cleanup').then(({ startCleanupJobs }) => {
          startCleanupJobs();
        }).catch((error) => {
          logger.error('Failed to start cleanup jobs', 'system', { error: String(error) });
        });

        // Start Subscription Biller
        import('./subscription-biller').then(({ startBillingCron }) => {
          startBillingCron();
        }).catch((error) => {
          logger.error('Failed to start billing cron', 'system', { error: String(error) });
        });
      });
    } else {
      startupPhase = "running_test";
      logger.info("Test mode detected, skipping server.listen", "boot");
    }

    // 4. Register Routes
    startupPhase = "route_registration";
    await registerRoutes(app);
    logger.info("App routes registered", "boot");

    // FIX: Global API 404 Handler (Prevent HTML Fallback)
    // This ensures that any missing /api/* route returns JSON 404
    // instead of falling through to the React implementation (index.html)
    app.all("/api/*", (req, res) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: "API endpoint not found" });
      }
    });

    // 5. Global Error Handler (Must be after routes and before static files?) 
    // Actually, standard practice is error handler LAST. 
    // But sending JSON for API errors is priority.
    app.use(errorHandler);

    // 5. Static Assets
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // 6. DB Verification
    startupPhase = "database_sync";
    logger.info("Connecting to Database...", "boot");
    const dbResult = await checkDatabaseConnection(10, 2000); // 20s total retry
    if (!dbResult.connected) {
      throw new Error(`DB Connection Timeout: ${dbResult.error}`);
    }

    // 7. Migrations
    startupPhase = "migrations";
    await runMigrations();

    // 8. Service Initialization
    startupPhase = "services_init";
    if (process.env.PAYER_PRIVATE_KEY) {
      const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY!);
      await initializeNFTService(payerKeypair).catch(e => logger.warn("NFT Init failed", "nft", { error: e }));
    }
    if (process.env.ENABLE_ARCIUM_ENCRYPTION === "true") {
      await initializeArciumService().catch(e => logger.warn("Arcium Init failed", "arcium", { error: e.message }));
    }

    // 9. Start QR Payment Processor (monitors Treasury for QR payments)
    if (process.env.PAYER_PRIVATE_KEY) {
      const { startQRPaymentProcessor } = await import("./qr-payment-processor");
      startQRPaymentProcessor();

      // 10. Start Marketplace Cron (Expired Listings)
      const { startMarketplaceCron } = await import("./marketplace-cron");
      startMarketplaceCron();

      // 11. Start Webhook Delivery Cron (Retry Failed Deliveries)
      const { startWebhookCron } = await import("./webhook-service");
      startWebhookCron();
    }

    // Finalize
    isServiceReady = true;
    startupPhase = "ready";
    logger.info("Invoix Platform is fully operational!", "boot", { ready: true });

    // 9. Realtime Systems (WS)
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (ws: WebSocket) => {
      invoiceStorage.getGlobalStats().then((stats: any) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "global_stats_update", data: stats }));
      }).catch((e: Error) => logger.debug('WS initial stats failed', 'websocket', { error: e }));
    });

    setInterval(async () => {
      if (wss.clients.size > 0 && isServiceReady) {
        try {
          const stats = await invoiceStorage.getGlobalStats();
          const msg = JSON.stringify({ type: "global_stats_update", data: stats });
          wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
        } catch (err) {
          logger.debug('WS stats broadcast failed', 'websocket', { error: err });
        }
      }
    }, 5000);


    // 10. Self-Healing / Retry Monitor (background)
    setInterval(async () => {
      // Retry NFT Service if needed
      if (process.env.PAYER_PRIVATE_KEY) {
        try {
          const { getInvoiceNFTService } = await import("./nft-service");
          const nftService = getInvoiceNFTService();
          if (!nftService.isReady() || (process.env.ENABLE_NFT_MINTING === 'true' && !nftService.hasCollection())) {
            logger.info("Attempting to self-heal NFT Service...", "system");
            const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY!);
            await nftService.initialize(payerKeypair);
          }
        } catch (err) {
          // Silent failure on retry to avoid log spam, or debug log
          logger.debug("Self-heal attempt failed", "system", { error: err });
        }
      }
    }, 60000); // Check every minute

  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Startup Failure", "boot", { error: err.message, stack: err.stack });
    captureError(err, { phase: startupPhase });
    lastStartupError = err.message;
    startupPhase = "failed";
    // We do NOT exit, to keep the port open for logs and status visibility
  }
})();

// Shutdown
process.on("SIGTERM", () => {
  log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    log("Server closed");
    process.exit(0);
  });
});
