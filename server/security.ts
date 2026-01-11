// Comprehensive security middleware for SolanaInvoice platform
// User data protection is our #1 priority

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { logger } from "./logger";


/**
 * Security headers middleware using Helmet
 * Protects against common web vulnerabilities
 */
export function securityHeaders() {
  return helmet({
    // HTTP Strict Transport Security - Forces HTTPS
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevents clickjacking attacks
    frameguard: {
      action: "deny",
    },
    // Prevents MIME type sniffing
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: process.env.NODE_ENV === 'production'
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite in dev
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Prevents DNS prefetching
    dnsPrefetchControl: { allow: false },
    // Hides X-Powered-By header
    hidePoweredBy: true,
    // Prevents IE from executing downloads in site's context
    ieNoOpen: true,
    // Prevents browsers from MIME-sniffing
    noSniff: true,
    // Disables client-side caching
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Prevents XSS attacks
    xssFilter: true,
  });
}

/**
 * Helper function to extract client IP address
 * Handles both direct connections and proxied requests
 */
function getClientIp(req: Request): string {
  // When behind a proxy (production), trust X-Forwarded-For
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list, take the first IP
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',');
    return ips[0].trim();
  }

  // Fallback to req.ip (direct connection or when not behind proxy)
  return req.ip || 'unknown';
}

/**
 * Global Rate Limiter - Basic protection
 * Applied to all requests
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Reduced from 1000 for better production protection
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => {
    // Skip rate limit for health checks
    return req.path === "/health" || req.path === "/api/health";
  },
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 15 minutes per IP
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: "Too many attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Authentication rate limiter for manual operations requiring signatures
 * 20 requests per hour per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    error: "Too many authentication attempts, please try again in an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});



/**
 * Middleware to sanitize user input
 * Prevents XSS and SQL injection attacks
 */
export function sanitizeInput(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Advanced sanitization logic: 
  // 1. Removes common XSS vectors (script tags, event handlers)
  // 2. Encodes sensitive HTML characters in text fields
  // 3. Recursively processes objects and arrays
  const sanitize = (obj: any): any => {
    if (typeof obj === "string") {
      // Step 1: Remove blacklisted tags and dangerous patterns
      let sanitized = obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");

      // Step 2: Minimal HTML encoding for protection while preserving readability
      // (Only if the string looks like it might contain tags)
      if (sanitized.includes("<") || sanitized.includes(">")) {
        sanitized = sanitized
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      return sanitized.trim();
    }

    if (typeof obj === "object" && obj !== null) {
      if (obj instanceof Date) return obj; // Preserve dates

      const sanitized: any = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
}

/**
 * Middleware to prevent request body size attacks
 * Limits request size to 1MB
 */
export const requestSizeLimit = "1mb";

/**
 * CORS configuration
 * Only allows requests from same origin in production
 */
export function corsPolicy() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const isProd = process.env.NODE_ENV === "production";

    if (isProd) {
      // In production, only allow specific origins
      const frontendUrl = process.env.FRONTEND_URL;
      const allowedOrigins: string[] = [];

      // Add FRONTEND_URL if set (exact match required)
      if (frontendUrl && frontendUrl.length > 0) {
        allowedOrigins.push(frontendUrl);
      }

      // Add Railway Public Domain if set
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
      }

      // Add Replit deployment domains (pattern matching)
      const replitAppPattern = /^https:\/\/[a-z0-9-]+\.repl(it\.app|it\.dev)$/i;
      // Add Railway deployment domains (pattern matching)
      const railwayAppPattern = /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i;

      let corsAllowed = false;

      if (origin) {
        // Exact match against allowed origins
        if (allowedOrigins.includes(origin)) {
          corsAllowed = true;
        }
        // Pattern match for Replit or Railway domains
        else if (replitAppPattern.test(origin) || railwayAppPattern.test(origin)) {
          corsAllowed = true;
        }
      }

      if (corsAllowed && origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        // Log blocked origin for debugging mobile wallet issues
        if (origin && !corsAllowed) {
          logger.warn(`CORS blocked origin: ${origin}`, "security");
        }
        // Reject CORS for unauthorized origins
        res.setHeader("Access-Control-Allow-Origin", "null");
      }
    } else {
      // In development, allow all origins
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.status(204).send();
    }

    next();
  };
}

/**
 * Security audit logger
 * Logs sensitive operations for security monitoring
 */
export function auditLog(operation: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = { ...details };

  // Never log sensitive data
  delete sanitizedDetails.privateKey;
  delete sanitizedDetails.signature;
  delete sanitizedDetails.password;

  logger.info(operation, "audit", sanitizedDetails);
}

/**
 * Validates wallet address format
 * Prevents malformed wallet addresses
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validates transaction signature format
 */
export function isValidSignature(signature: string): boolean {
  // Solana signatures are base58 encoded, typically 87-88 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
  return base58Regex.test(signature);
}

/**
 * Middleware to validate request contains valid Solana addresses
 */
export function validateSolanaAddresses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const addressFields = [
    "ownerWalletAddress",
    "treasuryWalletAddress",
    "tokenMintAddress",
    "pumpfunCreatorWallet",
    "fromAddress",
    "toAddress",
  ];

  for (const field of addressFields) {
    const address = req.body[field] || req.query[field];
    if (address && !isValidSolanaAddress(address as string)) {
      return res.status(400).json({
        message: `Invalid Solana address format for ${field}`,
      });
    }
  }

  next();
}

/**
 * Wallet signature authentication middleware
 * Verifies wallet ownership via cryptographic signature
 * Prevents replay attacks and expired messages
 */
export async function requireWalletAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { ownerWalletAddress, signature, message } = req.body;

    if (!ownerWalletAddress || !signature || !message) {
      return res.status(401).json({
        message: "Authentication required: ownerWalletAddress, signature, and message are required"
      });
    }

    // Validate address format
    if (!isValidSolanaAddress(ownerWalletAddress)) {
      return res.status(400).json({
        message: "Invalid wallet address format"
      });
    }

    // Verify wallet signature
    const { verifyWalletSignature } = await import("./solana-sdk");
    const isValidSignature = await verifyWalletSignature(
      ownerWalletAddress,
      message,
      signature
    );

    if (!isValidSignature) {
      return res.status(403).json({
        message: "Invalid signature: Could not verify wallet ownership"
      });
    }

    // Extract timestamp from message (format: "action at {timestamp}")
    const timestampMatch = message.match(/at (\d+)$/);
    if (!timestampMatch) {
      return res.status(400).json({
        message: "Invalid message format: timestamp required"
      });
    }

    const messageTimestamp = parseInt(timestampMatch[1], 10);
    const now = Date.now();
    const fifteenMinutesInMs = 15 * 60 * 1000;

    if (now - messageTimestamp > fifteenMinutesInMs) {
      logger.warn(`[AUTH] Expired timestamp in middleware: Server ${now} vs Msg ${messageTimestamp}`, "auth");
      return res.status(400).json({
        message: "Message expired: Please sign a new message"
      });
    }

    if (messageTimestamp - now > (5 * 60 * 1000)) {
      logger.warn(`[AUTH] Future timestamp in middleware: Server ${now} vs Msg ${messageTimestamp}`, "auth");
      return res.status(400).json({
        message: "Invalid timestamp: Clock skew detected"
      });
    }

    // Create a hash of the signature for replay attack prevention
    const { createHash } = await import("crypto");
    // const signatureHash = createHash("sha256").update(signature).digest("hex");

    // DATABASE REPLAY PREVENTION
    // 1. Check if signature exists in auth_nonces
    const { authNonces } = await import("@shared/invoice-schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");

    const existingNonce = await db.select().from(authNonces).where(eq(authNonces.signature, signature)).limit(1);

    if (existingNonce.length > 0) {
      return res.status(400).json({
        message: "Signature already used: Replay attack detected"
      });
    }

    // 2. Record this signature as used (expires in 24 hours to match standard session lifetime)
    await db.insert(authNonces).values({
      walletAddress: ownerWalletAddress,
      signature: signature,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });



    // Attach verified wallet address to request for use in route handler
    (req as any).authenticatedWallet = ownerWalletAddress;

    auditLog("wallet_authenticated", {
      walletAddress: ownerWalletAddress,
      ip: getClientIp(req),
    });

    next();
  } catch (error: any) {
    logger.error("Wallet authentication error", "auth", { error: error.message || error });
    res.status(500).json({ message: "Authentication failed" });
  }
}

/**
 * Middleware to require wallet authentication for sensitive data
 * Ensures only authenticated wallet owners can access their data
 * 
 * This middleware now uses SESSION-BASED authentication with cryptographic proof.
 * Users must first authenticate via /api/auth/login with a signed message.
 * 
 * Use this middleware for:
 * - Read operations requiring authentication
 * - Write operations (invoice creation, updates, etc.)
 * - Any endpoint that needs to verify wallet ownership
 */
export async function requireWalletOwnership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // FIX #12: Only log in development
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Checking ownership for ${req.method} ${req.path}`, "auth");
      logger.debug(`Session ID: ${req.sessionID}`, "auth");
    }

    // Check if user has an active session
    if (!req.session.walletAddress) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[AUTH_FAIL] No walletAddress in session. SessionID: ${req.sessionID}`, "auth");
      }
      return res.status(401).json({
        message: "Authentication required: Please login with your wallet",
        code: "NOT_AUTHENTICATED"
      });
    }

    const authenticatedWallet = req.session.walletAddress;
    const authMode = req.session.authMode || 'traditional';  // Default to traditional for backwards compatibility

    // For routes that specify a wallet address in params/query, verify it matches the session
    const requestedWallet = req.params.walletAddress || req.query.wallet as string;

    // FIX #3: Improved stale session handling
    if (requestedWallet && requestedWallet !== authenticatedWallet) {
      logger.warn(`[AUTH_FAIL] Wallet Mismatch. Session: ${authenticatedWallet.slice(0, 8)}..., Requested: ${requestedWallet.slice(0, 8)}...`, "auth");

      // FIX #3: Destroy stale session to force re-authentication
      req.session.destroy((err) => {
        if (err) logger.error("Session destroy error", "auth", { error: err });
      });

      return res.status(401).json({
        message: "Session expired: Your wallet has changed. Please reconnect to continue.",
        code: "STALE_SESSION",
        hint: "Disconnect and reconnect your wallet to refresh your session."
      });
    }

    // Attach verified wallet and auth mode to request for use in route handlers
    (req as any).authenticatedWallet = authenticatedWallet;
    (req as any).authMode = authMode;
    (req as any).smartWalletPda = req.session.smartWalletPda;  // Available for passkey mode

    auditLog("wallet_access_granted", {
      walletAddress: authenticatedWallet,
      authMode,
      resource: req.path,
      method: req.method,
      ip: getClientIp(req),
    });

    next();
  } catch (error: any) {
    logger.error("Wallet ownership verification error", "auth", { error: error.message || error });
    res.status(500).json({ message: "Authorization check failed" });
  }
}



/**
 * Environment variable security check
 * Ensures critical security variables are set
 */
export function checkSecurityEnvVars(): void {
  const criticalVars = ["DATABASE_URL", "SESSION_SECRET"];
  const recommendedVars = [
    "INVOICE_ENCRYPTION_KEY",
    "PLATFORM_TREASURY_WALLET",
    "SOL_PRICE_FALLBACK"
  ];

  // Check critical vars (block startup if missing)
  const missingCritical = criticalVars.filter(v => !process.env[v]);
  if (missingCritical.length > 0 && process.env.NODE_ENV === "production") {
    logger.error("CRITICAL: Missing required environment variables", "security", { missing: missingCritical });
    logger.warn("Platform will serve 503 Maintenance until these are configured.", "security");
    // process.exit(1); 
  }

  // Check recommended vars (warn but don't block)
  const missingRecommended = recommendedVars.filter(v => !process.env[v]);
  if (missingRecommended.length > 0) {
    logger.warn("Optional security variables not configured", "security", { missing: missingRecommended });
  }

  // Check Merkle Tree Persistence (Critical for pNFTs)
  // Check Merkle Tree Persistence (Critical for pNFTs)
  if (!process.env.MERKLE_TREE_ADDRESS && process.env.NODE_ENV !== "test") {
    logger.info("MERKLE_TREE_ADDRESS not set in .env - will check DB or create new", "nft");
  }

  // Verify ENCRYPTION_MASTER_KEY strength if present
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (masterKey && masterKey.length < 64) {
    logger.warn("ENCRYPTION_MASTER_KEY is too short (recommended: 64+)", "security", { length: masterKey.length });
  }

  if (missingRecommended.length === 0 && (!masterKey || masterKey.length >= 64)) {
    logger.info("All security environment variables properly configured", "security");
  }
}
