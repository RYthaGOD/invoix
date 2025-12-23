// Load environment variables from .env file
import 'dotenv/config';
import dns from 'node:dns';

// Force IPv4 resolution to prevent connection issues on some networks (like Railway Internal)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, type Server } from "http";

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
import { initializeNFTService } from "./nft-service";
import { initializeArciumService } from "./arcium-service";
import { loadKeypairFromPrivateKey } from "./arcium-service";
import { logger } from "./logger";

// Validate environment variables on startup (before security check)
validateEnvironment();
console.log("[SYSTEM] Config reload trigger: " + Date.now());

// Check security environment variables on startup
checkSecurityEnvVars();

const app = express();
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️  WARNING: SESSION_SECRET not set in production! Using insecure default.");
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

// Global rate limiting for all API routes
app.use("/api", globalRateLimit);

// Module-level variables to be accessible by shutdown function
let server: any;
let isShuttingDown = false;

// -------------------------------------------------------------------------
// REFACTOR: INVINCIBLE STARTUP PATTERN
// -------------------------------------------------------------------------

// Service Readiness State
let isServiceReady = false;
let lastStartupError: string | null = null;
let startupPhase = "bootstrapping";

// Create the server IMMEDIATELY to satisfy platform health checks
server = createServer(app);
const port = parseInt(process.env.PORT || "5000", 10);

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ [BOOT] Listening on port ${port} - Service initializing...`);
  log(`serving on port ${port}`);
});

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
(async () => {
  try {
    console.log("🚀 Initializing Invoix Platform Components...");
    console.log("   Cluster:", process.env.NODE_ENV || "development");

    // 1. DNS Resolution Check
    if (process.env.DATABASE_URL) {
      startupPhase = "dns_preflight";
      try {
        const urlObj = new URL(process.env.DATABASE_URL);
        console.log(`   🔍 DB Host: ${urlObj.hostname}`);
      } catch (e) {
        console.warn("   ⚠️  Invalid DATABASE_URL format");
      }
    }

    // Initialize Arcium Service (Non-Critical)
    try {
      if (process.env.ENABLE_ARCIUM_ENCRYPTION === 'true') {
        const arciumSuccess = await initializeArciumService();
        if (arciumSuccess) {
          console.log("✅ Arcium Service initialized");
        }
      } else {
        console.log("ℹ️  Arcium Encryption Disabled (ENABLE_ARCIUM_ENCRYPTION != true)");
      }
    } catch (arciumError) {
      console.error("⚠️  Arcium Service Initialization Failed:", arciumError);
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

    // 4. Register Routes
    startupPhase = "route_registration";
    await registerRoutes(app);
    console.log("   ✅ App routes registered.");

    // 5. Static Assets
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // 6. DB Verification
    startupPhase = "database_sync";
    console.log("   ⏳ Connecting to Database...");
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
      await initializeNFTService(payerKeypair).catch(e => console.warn("⚠️ NFT Init failed:", e));
    }
    if (process.env.ENABLE_ARCIUM_ENCRYPTION === "true") {
      await initializeArciumService().catch(e => console.warn("⚠️ Arcium Init failed:", e.message));
    }

    // Finalize
    isServiceReady = true;
    startupPhase = "ready";
    console.log("🚀 [READY] Invoix Platform is fully operational!");

    // 9. Realtime Systems (WS)
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (ws: WebSocket) => {
      invoiceStorage.getGlobalStats().then((stats: any) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "global_stats_update", data: stats }));
      }).catch(() => { });
    });

    setInterval(async () => {
      if (wss.clients.size > 0 && isServiceReady) {
        try {
          const stats = await invoiceStorage.getGlobalStats();
          const msg = JSON.stringify({ type: "global_stats_update", data: stats });
          wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
        } catch (e) { }
      }
    }, 5000);

  } catch (error: any) {
    console.error("❌ [FATAL] Startup Failure:", error);
    lastStartupError = error.message;
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
