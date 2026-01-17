/**
 * Authentication Routes
 * 
 * Implements Sign-In With Solana (SIWS) for secure wallet-based authentication
 */

import type { Express, Request, Response } from "express";
import { verifyWalletSignature } from "./solana-sdk";
import { isValidSolanaAddress, auditLog, strictRateLimit, validateAuthMessage } from "./security";
import { logger } from "./logger";

// Extend Express Session type
declare module "express-session" {
    interface SessionData {
        walletAddress: string;
        authenticatedAt: number;
        authMode?: 'traditional' | 'passkey';  // Authentication mode
        smartWalletPda?: string;              // Smart wallet PDA (passkey mode)
    }
}

/**
 * Register authentication routes
 */
export function registerAuthRoutes(app: Express): void {
    // LazorKit configuration - Passkey Auth
    if (process.env.LAZORKIT_STRICT_MODE !== 'true') {
        logger.info("LazorKit running in non-strict mode (dev/demo). Signatures not cryptographically verified.", "auth");
    }

    /**
     * Login with wallet signature
     * POST /api/auth/login
     * 
     * Body: {
     *   walletAddress: string,
     *   message: string,
     *   signature: string
     * }
     */
    app.post("/api/auth/login", strictRateLimit, async (req: Request, res: Response) => {
        try {
            const { walletAddress, message, signature } = req.body;

            // Validate required fields
            if (!walletAddress || !message || !signature) {
                return res.status(400).json({
                    message: "Missing required fields: walletAddress, message, and signature are required"
                });
            }

            // Validate wallet address format
            if (!isValidSolanaAddress(walletAddress)) {
                return res.status(400).json({
                    message: "Invalid Solana wallet address format"
                });
            }

            // Validate message timestamp
            const authValidation = validateAuthMessage(message);
            if (!authValidation.isValid) {
                logger.warn(`[AUTH] Invalid message: ${authValidation.error}. Msg: "${message}"`, "auth");
                return res.status(400).json({
                    message: authValidation.error
                });
            }

            const now = Date.now();

            // Verify the signature cryptographically
            const isValid = await verifyWalletSignature(
                walletAddress,
                message,
                signature
            );

            if (!isValid) {
                logger.warn(`[AUTH_FAIL] Invalid signature for wallet ${walletAddress}`, "auth");
                auditLog("login_failed_invalid_signature", {
                    walletAddress,
                    ip: req.ip,
                });

                return res.status(403).json({
                    message: "Invalid signature: Could not verify wallet ownership"
                });
            }

            logger.debug(`Signature verified for ${walletAddress}. Creating session...`, "auth");

            // Create session
            req.session.walletAddress = walletAddress;
            req.session.authenticatedAt = now;

            // Explicitly save session before response to ensure persistence
            req.session.save((err) => {
                if (err) {
                    logger.error("[AUTH_ERROR] Session save error", "auth", { error: err });
                    return res.status(500).json({ message: "Session creation failed" });
                }

                logger.debug(`Session saved. SessionID: ${req.sessionID}`, "auth", { sessionData: req.session });

                auditLog("login_success", {
                    walletAddress,
                    ip: req.ip,
                });

                res.json({
                    success: true,
                    walletAddress,
                    message: "Authentication successful"
                });
            });
        } catch (error: any) {
            logger.error("Login error", "auth", { error });
            res.status(500).json({ message: "Authentication failed" });
        }
    });

    /**
     * Get current authenticated user
     * GET /api/auth/me
     */
    app.get("/api/auth/me", (req: Request, res: Response) => {
        if (!req.session.walletAddress) {
            return res.status(401).json({
                authenticated: false,
                message: "Not authenticated"
            });
        }

        res.json({
            authenticated: true,
            walletAddress: req.session.walletAddress,
            authenticatedAt: req.session.authenticatedAt,
            authMode: req.session.authMode || 'traditional'  // Include auth mode
        });
    });

    /**
     * Login with LazorKit passkey (smart wallet)
     * POST /api/auth/login/passkey
     * 
     * Body: {
     *   smartWalletAddress: string,
     *   message: string,
     *   signature: string
     * }
     */
    app.post("/api/auth/login/passkey", strictRateLimit, async (req: Request, res: Response) => {
        try {
            const { smartWalletAddress, message, signature } = req.body;

            // Validate required fields
            if (!smartWalletAddress || !message || !signature) {
                return res.status(400).json({
                    message: "Missing required fields: smartWalletAddress, message, and signature are required"
                });
            }

            // Validate wallet address format
            if (!isValidSolanaAddress(smartWalletAddress)) {
                return res.status(400).json({
                    message: "Invalid Solana wallet address format"
                });
            }

            // Validate message timestamp
            const authValidation = validateAuthMessage(message);
            if (!authValidation.isValid) {
                logger.warn(`[AUTH] Invalid message: ${authValidation.error}. Msg: "${message}"`, "auth");
                return res.status(400).json({
                    message: authValidation.error
                });
            }

            const now = Date.now();

            // SERVER-SIDE SIGNATURE VERIFICATION
            // Verify the smart wallet signature using on-chain verification
            const { Connection, clusterApiUrl, PublicKey } = await import("@solana/web3.js");
            const { verifySmartWalletSignature } = await import("./lazorkit-verify");

            // Create connection to Solana
            const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
            const connection = new Connection(rpcUrl, 'confirmed');

            // Verify signature authenticity
            // Note: For NEW wallets, the on-chain account may not exist yet
            // If we have credential data, we try to initialize it first

            // Check if account exists first
            const walletPubkey = new PublicKey(smartWalletAddress);
            let accountInfo = await connection.getAccountInfo(walletPubkey);

            if (!accountInfo) {
                // NEW USER: Initialize wallet on-chain using treasury
                // We only do this if we received the necessary credential data
                const { passkeyPublicKey, credentialId } = req.body;

                if (passkeyPublicKey && credentialId) {
                    logger.info(`[AUTH] New wallet detected. Initializing on-chain...`, "auth");

                    const { initializeSmartWallet } = await import('./lazorkit-init-service');
                    const initResult = await initializeSmartWallet(
                        passkeyPublicKey,
                        credentialId,
                        connection
                    );

                    if (!initResult.success) {
                        logger.error(`[AUTH] Failed to initialize wallet: ${initResult.error}`, 'auth');
                        // Fall through to standard verification - it will likely fail in strict mode
                    } else {
                        logger.info(`[AUTH] Successfully initialized new wallet: ${smartWalletAddress}`, 'auth');
                        // FIX: Refresh account info so verification sees the new on-chain state
                        // Otherwise it uses the stale 'null' accountInfo and verification fails
                        accountInfo = await connection.getAccountInfo(walletPubkey);
                    }
                }
            }

            const { isValid: isSignatureValid, isNewWallet } = await verifySmartWalletSignature(
                smartWalletAddress,
                message,
                signature,
                connection,
                accountInfo
            );

            if (!isSignatureValid) {
                logger.warn(`[AUTH] Signature verification failed for ${smartWalletAddress}`, "auth");

                // STRICT MODE CHECK
                if (process.env.LAZORKIT_STRICT_MODE === 'true') {
                    auditLog("login_failed_invalid_signature_passkey_strict", {
                        walletAddress: smartWalletAddress,
                        ip: req.ip,
                    });
                    return res.status(403).json({
                        message: "Strict Mode: Invalid signature. Could not strictly verify smart wallet authorization."
                    });
                } else {
                    logger.warn(`[AUTH] Strict mode disabled. Allowing despite signature failure (DEV MODE).`, "auth");
                }
            }

            // Log new wallet authentication (if it's still considered new by verifySmartWalletSignature)
            if (isNewWallet) {
                logger.info(`[AUTH] LazorKit wallet authenticated (validated as new/off-chain): ${smartWalletAddress}`, "auth");
            }

            logger.debug(`Passkey auth verified for smart wallet ${smartWalletAddress}`, "auth");

            // REPLAY ATTACK PROTECTION: Check signature hasn't been used before
            const { authNonces } = await import("@shared/invoice-schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");

            const existingNonce = await db.select()
                .from(authNonces)
                .where(eq(authNonces.signature, signature))
                .limit(1);

            if (existingNonce.length > 0) {
                return res.status(400).json({
                    message: "Signature already used: Replay attack detected"
                });
            }

            // Record this signature as used (expires in 24 hours)
            await db.insert(authNonces).values({
                walletAddress: smartWalletAddress,
                signature: signature,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            // Create session with passkey mode
            req.session.walletAddress = smartWalletAddress;
            req.session.authenticatedAt = now;
            req.session.authMode = 'passkey';
            req.session.smartWalletPda = smartWalletAddress;

            // Explicitly save session
            req.session.save((err) => {
                if (err) {
                    logger.error("[AUTH_ERROR] Session save error", "auth", { error: err });
                    return res.status(500).json({ message: "Session creation failed" });
                }

                logger.debug(`Passkey session saved. SessionID: ${req.sessionID}`, "auth");

                auditLog("login_success_passkey", {
                    walletAddress: smartWalletAddress,
                    ip: req.ip,
                    authMode: 'passkey'
                });

                res.json({
                    success: true,
                    walletAddress: smartWalletAddress,
                    authMode: 'passkey',
                    message: "Passkey authentication successful"
                });
            });
        } catch (error: any) {
            logger.error("Passkey login error", "auth", { error });
            res.status(500).json({ message: "Passkey authentication failed" });
        }
    });

    /**
     * Logout
     * POST /api/auth/logout
     */
    app.post("/api/auth/logout", (req: Request, res: Response) => {
        const walletAddress = req.session.walletAddress;

        req.session.destroy((err) => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).json({ message: "Logout failed" });
            }

            if (walletAddress) {
                auditLog("logout", {
                    walletAddress,
                    ip: req.ip,
                });
            }

            res.json({
                success: true,
                message: "Logged out successfully"
            });
        });
    });
}
