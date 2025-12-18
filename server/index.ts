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
// REMOVED STATIC IMPORTS for DB and Routes to allow pre-flight DNS fix
// import { db, pool, runMigrations, checkDatabaseConnection } from "./db";
// import { invoiceStorage } from "./invoice-storage";
// import { registerRoutes } from "./routes";

import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";

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

// Validate environment variables on startup (before security check)
validateEnvironment();

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

// Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 2000) {
        logLine = logLine.slice(0, 1999) + "…";
      }
      log(logLine);
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

export async function triggerGracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("Graceful shutdown triggered programmatically");
  const forceExitTimer = setTimeout(() => {
    console.error("⚠️ Shutdown timeout - forcing exit");
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });
    }
  } catch (shutdownError) {
    console.error("Error during shutdown:", shutdownError);
  }
  clearTimeout(forceExitTimer);
  log("Shutdown complete, exiting...");
  process.exit(0);
}

// MAIN STARTUP SEQUENCE
(async () => {
  try {
    console.log("🚀 Starting Invoix B2B Platform...");
    console.log("Environment:", process.env.NODE_ENV || "development");
    console.log("Port:", process.env.PORT || "5000");

    // -------------------------------------------------------------------------
    // CRITICAL: PRE-FLIGHT DNS RESOLUTION TO FIX RAILWAY IPV6 ROUTING ISSUES
    // -------------------------------------------------------------------------
    if (process.env.DATABASE_URL) {
      console.log("🌍 Pre-flight: Checking Database DNS resolution...");
      let hostname = "";
      try {
        const urlObj = new URL(process.env.DATABASE_URL);
        hostname = urlObj.hostname;
      } catch (e) {
        const match = process.env.DATABASE_URL.match(/@([^:/]+)(?::(\d+))?/);
        if (match) hostname = match[1];
      }

      if (hostname && !hostname.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/)) { // If not already an IP
        try {
          console.log(`🔄 Resolving '${hostname}' to IPv4...`);
          const ips = await dns.promises.resolve4(hostname);
          if (ips && ips.length > 0) {
            const ip = ips[0];
            console.log(`✅ Resolved to IPv4: ${ip}`);
            // Overwrite Environment Variable with IP address
            process.env.DATABASE_URL = process.env.DATABASE_URL.replace(hostname, ip);
          }
        } catch (dnsErr) {
          console.error("⚠️ Pre-flight DNS Resolution failed (proceeding with original):", dnsErr);
        }
      }
    }
    // -------------------------------------------------------------------------

    // DYNAMIC IMPORTS (Now that env var is patched)
    console.log("📦 Loading Database Module...");
    const dbModule = await import("./db");
    db = dbModule.db;
    pool = dbModule.pool;
    runMigrations = dbModule.runMigrations;
    checkDatabaseConnection = dbModule.checkDatabaseConnection;

    console.log("📦 Loading Routes & Storage...");
    const storageModule = await import("./invoice-storage");
    invoiceStorage = storageModule.invoiceStorage;
    const routesModule = await import("./routes");
    registerRoutes = routesModule.registerRoutes;

    // Initialize Session Store (Requires Pool)
    const PgSession = connectPgSimple(session);
    const sessionStore = pool
      ? new PgSession({
        pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        ttl: 7 * 24 * 60 * 60 // 7 days
      })
      : new (createMemoryStore(session))({
        checkPeriod: 86400000 // 24h
      });

    // We must register session middleware HERE because it depends on `sessionStore` which depends on `pool`
    // But `app.use` order matters. We registered a placeholder? No, we didn't.
    // Wait, Express middleware stack is FIFO.
    // If we register it now, it will be AFTER security checks (good) but BEFORE routes (good).
    // ACTUALLY: we need to register it before `registerRoutes` is called.

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

    // Service Readiness Flag & Debug Info
    let isServiceReady = false;
    let lastStartupError: string | null = null;
    let startupPhase = "initializing";

    // Maintenance Mode Middleware
    app.use((req, res, next) => {
      if (!isServiceReady && req.path !== '/health') {
        return res.status(503).json({
          message: 'Service starting up - Waiting for database...',
          status: 'maintenance',
          phase: startupPhase,
          lastError: lastStartupError,
          timestamp: new Date().toISOString()
        });
      }
      next();
    });

    // Register routes
    server = await registerRoutes(app);

    console.log("✅ Routes registered");

    // ============================================
    // REALTIME WEBSOCKET SERVER
    // ============================================
    const wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (ws) => {
      console.log("[WS] Client connected");

      // Send immediate initial stats upon connection
      invoiceStorage.getGlobalStats().then(stats => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: "global_stats_update",
            timestamp: Date.now(),
            data: stats
          }));
        }
      }).catch(err => console.error("Error sending initial stats:", err));

      ws.on("close", () => {
        console.log("[WS] Client disconnected");
      });

      ws.on("error", (err) => {
        console.error("[WS] Error:", err);
      });
    });

    // OPTIMIZED: Global Broadcast Loop (Singleton)
    // Query DB once, broadcast to all.
    // Prevents DB overload: O(1) queries instead of O(N) where N = clients
    setInterval(async () => {
      // Only query if there are connected clients to save resources
      if (wss.clients.size > 0) {
        try {
          const stats = await invoiceStorage.getGlobalStats();
          const message = JSON.stringify({
            type: "global_stats_update",
            timestamp: Date.now(),
            data: stats
          });

          // Broadcast to all connected clients
          wss.clients.forEach((client) => {
            if (client.readyState === 1) { // 1 = WebSocket.OPEN
              client.send(message);
            }
          });
        } catch (error) {
          console.error("Error running global stats broadcast:", error);
        }
      }
    }, 5000);

    // Global generic error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(`[Express Error] ${status}: ${message}`, err.stack);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start Server IMMEDIATELY to satisfy Railway/Health checks
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      console.log(`✅ Server bound to port ${port}`);
      log(`serving on port ${port}`);
    });

    // Async Initialization (DB, Migrations, Services)
    (async () => {
      try {
        console.log("⏳ Connecting to Database...");
        startupPhase = "db_check";

        // Retry logic for DB connection
        let connected = false;
        let retries = 30; // 60 seconds total

        while (!connected && retries > 0) {
          const result = await checkDatabaseConnection(1, 100); // Quick check
          connected = result.connected;

          if (!connected) {
            retries--;
            if (result.error) {
              lastStartupError = `DB Connection Failed: ${result.error}`;
            }
            await new Promise(res => setTimeout(res, 2000));
          }
        }

        if (!connected) {
          console.error("❌ CRITICAL: Could not connect to database after 60 seconds. Service will remain unavailable.");
          // We do NOT exit here to keep the port open for logs, but service is broken.
          return;
        }

        // Run migrations synchronously
        startupPhase = "migrations";
        try {
          await runMigrations();
          console.log("✅ Migrations applied successfully");
        } catch (migrationError: any) {
          console.error("❌ CRITICAL: Database Migrations Failed:", migrationError);
          lastStartupError = `Migrations Failed: ${migrationError.message}`;
          return;
        }

        // Initialize NFT Service (Non-Critical)
        try {
          if (process.env.PAYER_PRIVATE_KEY) {
            const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY!);
            const nftInitSuccess = await initializeNFTService(payerKeypair);
            if (nftInitSuccess) {
              console.log("✅ NFT Service initialized with payer wallet");
            } else {
              console.warn("⚠️  NFT Service failed to initialize. NFT features will be disabled.");
            }
          } else {
            console.log("ℹ️  No PAYER_PRIVATE_KEY found, skipping NFT service initialization.");
          }
        } catch (nftError) {
          console.error("⚠️  NFT Service Initialization Crashed (Non-Fatal):", nftError);
          // Do NOT exit, allow server to run without NFTs
        }

        // Initialize Arcium Service (Non-Critical)
        try {
          const arciumSuccess = await initializeArciumService();
          if (arciumSuccess) {
            console.log("✅ Arcium Service initialized");
          }
        } catch (arciumError) {
          console.error("⚠️  Arcium Service Initialization Failed:", arciumError);
        }

        // Mark Service as Ready
        isServiceReady = true;
        startupPhase = "ready";
        console.log("🚀 Service is fully ready and accepting requests!");

      } catch (error: any) {
        console.error("❌ FATAL ERROR during initialization:", error);
        lastStartupError = `Initialization Error: ${error.message}`;
        // Do not exit, allow log drains
      }
    })();

    // Graceful shutdown
    process.on("SIGTERM", () => {
      log("SIGTERM received, shutting down gracefully");
      server.close(() => {
        log("Server closed");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("❌ FATAL ERROR during server startup:", error);
    process.exit(1);
  }
})();
