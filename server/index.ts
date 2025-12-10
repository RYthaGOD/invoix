// Load environment variables from .env file
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db, pool, runMigrations, checkDatabaseConnection } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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
import { loadKeypairFromPrivateKey } from "./arcium-service";

// Validate environment variables on startup (before security check)
validateEnvironment();

// Check security environment variables on startup
checkSecurityEnvVars();

const app = express();

// Session store setup
const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️  WARNING: SESSION_SECRET not set in production! Using insecure default.");
}

// Trust proxy - MUST be set before rate limiting middleware
app.set('trust proxy', true);

// Security middleware - FIRST (headers and CORS before body parsing)
app.use(securityHeaders());
app.use(corsPolicy());

// Session middleware - BEFORE body parsing so it's available in all routes
// Use Postgres store if pool is available (Production), otherwise MemoryStore (Dev/SQLite)
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

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax", // CSRF protection
  },
  name: "invoix_sid", // Custom session cookie name
}));

// Body parsing with size limits - MUST come before sanitizeInput
app.use(express.json({ limit: requestSizeLimit }));
app.use(express.urlencoded({ extended: false, limit: requestSizeLimit }));

// Input sanitization - AFTER body parsing so req.body is populated
app.use(sanitizeInput);

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

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoints (no authentication required)
app.get("/health", healthCheck);
app.get("/health/live", liveness);
app.get("/health/ready", readiness);

// Global rate limiting for all API routes
app.use("/api", globalRateLimit);

// Module-level variables to be accessible by shutdown function
let server: any;
let isShuttingDown = false;

// Export shutdown function for external triggers (e.g., AI bot disabled)
export async function triggerGracefulShutdown() {
  if (isShuttingDown) {
    return; // Prevent multiple shutdown attempts
  }
  isShuttingDown = true;

  log("Graceful shutdown triggered programmatically");

  // Force exit after 10 seconds if shutdown hangs
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

(async () => {
  try {
    console.log("🚀 Starting Invoix B2B Platform...");
    console.log("Environment:", process.env.NODE_ENV || "development");
    console.log("Port:", process.env.PORT || "5000");

    // Check database connection before running migrations
    // await checkDatabaseConnection(); <- MOVED TO BACKGROUND

    // Run database migrations (Postgres only)
    // await runMigrations(); <- MOVED TO BACKGROUND

    // Initialize NFT Service



    // Service Readiness Flag
    let isServiceReady = false;

    // Maintenance Mode Middleware - Must come before routes!
    app.use((req, res, next) => {
      if (!isServiceReady && req.path !== '/health') {
        return res.status(503).json({
          message: 'Service starting up - Waiting for database...',
          status: 'maintenance'
        });
      }
      next();
    });

    // Register routes after maintenance middleware
    server = await registerRoutes(app);

    console.log("✅ Routes registered");

    // STARTUP STRATEGY:
    // 1. Start HTTP Server immediately (so Railway sees us as healthy/live)
    // 2. Try to connect to DB in background
    // 3. If DB fails, we serve 503 until it reconnects

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

    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      console.log(`✅ Server successfully started!`);
      log(`serving on port ${port}`);

      // Background DB Initialization
      (async () => {
        let connected = false;

        while (!connected) {
          try {
            connected = await checkDatabaseConnection(5, 2000); // Check in small bursts
            if (connected) {
              await runMigrations();

              // Initialize NFT Service (After DB is ready)
              if (process.env.PAYER_PRIVATE_KEY) {
                try {
                  const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
                  await initializeNFTService(payerKeypair);
                  console.log("✅ NFT Service initialized with payer wallet");
                } catch (error) {
                  console.warn("⚠️ Failed to initialize NFT service:", error);
                }
              } else {
                console.log("ℹ️ PAYER_PRIVATE_KEY not set - Server-side NFT minting disabled (Client-side minting enabled)");
              }

              isServiceReady = true;
              console.log("✅ Database connected. Service is now READY.");
            } else {
              console.log("⏳ Database not yet ready. Retrying in 5 seconds...");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          } catch (e) {
            console.error("❌ Critical error in background initialization (Retrying in 5s):", e);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      })();
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      log("SIGTERM received, shutting down gracefully");
      server.close(() => {
        log("Server closed");
        process.exit(0);
      });
    });

    // ... (Error handlers)
  } catch (error) {
    console.error("❌ FATAL ERROR during server startup:", error);
    process.exit(1);
  }
})();
