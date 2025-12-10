// Load environment variables from .env file
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
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
const MemoryStore = createMemoryStore(session);
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️  WARNING: SESSION_SECRET not set in production! Using insecure default.");
}

// Trust proxy - MUST be set before rate limiting middleware
// This is required when the app is behind a reverse proxy (production)
app.set('trust proxy', true);

// Security middleware - FIRST (headers and CORS before body parsing)
app.use(securityHeaders());
app.use(corsPolicy());

// Session middleware - BEFORE body parsing so it's available in all routes
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000, // Prune expired entries every 24h
  }),
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

    // Initialize NFT Service
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

    server = await registerRoutes(app);
    console.log("✅ Routes registered");



    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error but don't rethrow - only route errors, not fatal system errors
      console.error(`[Express Error] ${status}: ${message}`, err.stack);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      console.log(`✅ Server successfully started!`);
      log(`serving on port ${port}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      log("SIGTERM received, shutting down gracefully");
      server.close(() => {
        log("Server closed");
        process.exit(0);
      });
    });

    // Global error handlers for controlled shutdown on critical failures
    process.on("unhandledRejection", async (reason, promise) => {
      console.error("❌ Unhandled Promise Rejection:", reason);
      console.error("Promise:", promise);
      // Allow process to restart cleanly on unhandled rejections
      console.error("Initiating controlled shutdown...");

      // Force exit after 10 seconds if shutdown hangs
      const forceExitTimer = setTimeout(() => {
        console.error("⚠️ Shutdown timeout - forcing exit");
        process.exit(1);
      }, 10000);

      try {
        // scheduler removed
        // realtimeService removed
        await new Promise((resolve, reject) => {
          server.close((err: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      } catch (shutdownError) {
        console.error("Error during shutdown:", shutdownError);
      }

      clearTimeout(forceExitTimer);
      process.exit(1);
    });

    process.on("uncaughtException", async (error) => {
      console.error("❌ Uncaught Exception:", error);
      console.error("Stack:", error.stack);
      // Allow process to restart cleanly on uncaught exceptions
      console.error("Initiating controlled shutdown...");

      // Force exit after 10 seconds if shutdown hangs
      const forceExitTimer = setTimeout(() => {
        console.error("⚠️ Shutdown timeout - forcing exit");
        process.exit(1);
      }, 10000);

      try {
        await new Promise((resolve, reject) => {
          server.close((err: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      } catch (shutdownError) {
        console.error("Error during shutdown:", shutdownError);
      }

      clearTimeout(forceExitTimer);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ FATAL ERROR during server startup:");
    console.error(error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    console.error("\n⚠️ Server failed to start. Exiting...");
    process.exit(1);
  }
})();
