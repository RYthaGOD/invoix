/**
 * Authentication Routes
 * 
 * Implements Sign-In With Solana (SIWS) for secure wallet-based authentication
 */

import type { Express, Request, Response } from "express";
import { verifyWalletSignature } from "./solana-sdk";
import { isValidSolanaAddress, auditLog, strictRateLimit } from "./security";
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

            // Extract timestamp from message (format: "Sign in to SolanaInvoice at {timestamp}")
            const timestampMatch = message.match(/at (\d+)$/);
            if (!timestampMatch) {
                console.warn(`[AUTH] Invalid message format received: "${message}"`);
                return res.status(400).json({
                    message: "Invalid message format: timestamp required"
                });
            }

            const messageTimestamp = parseInt(timestampMatch[1], 10);
            const now = Date.now();
            const fifteenMinutesInMs = 15 * 60 * 1000;

            // Check message is not expired (15 minute window)
            // We also check if it's too far in the future (> 5 mins) to prevent weirdness
            if (now - messageTimestamp > fifteenMinutesInMs) {
                console.warn(`[AUTH] Expired timestamp: Server ${now} vs Msg ${messageTimestamp} (Diff: ${now - messageTimestamp}ms)`);
                return res.status(400).json({
                    message: "Message expired: Please sign a new message"
                });
            }
            if (messageTimestamp - now > (5 * 60 * 1000)) {
                console.warn(`[AUTH] Future timestamp detected: Server ${now} vs Msg ${messageTimestamp}`);
                return res.status(400).json({
                    message: "Invalid timestamp: Your clock appears to be significantly ahead"
                });
            }

            // Verify the signature cryptographically
            const isValid = await verifyWalletSignature(
                walletAddress,
                message,
                signature
            );

            if (!isValid) {
                console.warn(`[AUTH_FAIL] Invalid signature for wallet ${walletAddress}`);
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
                    console.error("[AUTH_ERROR] Session save error:", err);
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
            console.error("Login error:", error);
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

            // Extract timestamp from message
            const timestampMatch = message.match(/(\d+)$/);
            if (!timestampMatch) {
                console.warn(`[AUTH] Invalid message format received: "${message}"`);
                return res.status(400).json({
                    message: "Invalid message format: timestamp required"
                });
            }

            const messageTimestamp = parseInt(timestampMatch[1], 10);
            const now = Date.now();
            const fifteenMinutesInMs = 15 * 60 * 1000;

            // Check message is not expired (15 minute window)
            if (now - messageTimestamp > fifteenMinutesInMs) {
                console.warn(`[AUTH] Expired timestamp: Server ${now} vs Msg ${messageTimestamp}`);
                return res.status(400).json({
                    message: "Message expired: Please sign a new message"
                });
            }
            if (messageTimestamp - now > (5 * 60 * 1000)) {
                console.warn(`[AUTH] Future timestamp detected: Server ${now} vs Msg ${messageTimestamp}`);
                return res.status(400).json({
                    message: "Invalid timestamp: Your clock appears to be significantly ahead"
                });
            }

            // SERVER-SIDE SIGNATURE VERIFICATION
            // Verify the smart wallet signature using on-chain verification
            const { Connection, clusterApiUrl } = await import("@solana/web3.js");
            const { verifySmartWalletSignature, verifySmartWalletOwnership } = await import("./lazorkit-verify");

            // Create connection to Solana
            const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
            const connection = new Connection(rpcUrl, 'confirmed');

            // Step 1: Verify account exists and is owned by LazorKit program
            const LAZORKIT_PROGRAM_ID = process.env.LAZORKIT_PROGRAM_ID || 'Lazor1111111111111111111111111111111111111111'; // Placeholder

            const isOwnershipValid = await verifySmartWalletOwnership(
                smartWalletAddress,
                LAZORKIT_PROGRAM_ID,
                connection
            );

            if (!isOwnershipValid) {
                logger.warn(`[AUTH] Smart wallet ownership verification failed for ${smartWalletAddress}`, "auth");
                return res.status(403).json({
                    message: "Invalid smart wallet: Account verification failed"
                });
            }

            // Step 2: Verify signature authenticity
            const isSignatureValid = await verifySmartWalletSignature(
                smartWalletAddress,
                message,
                signature,
                connection
            );

            if (!isSignatureValid) {
                logger.warn(`[AUTH] Signature verification failed for ${smartWalletAddress}`, "auth");
                auditLog("login_failed_invalid_signature_passkey", {
                    walletAddress: smartWalletAddress,
                    ip: req.ip,
                });
                return res.status(403).json({
                    message: "Invalid signature: Could not verify smart wallet authorization"
                });
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
                    console.error("[AUTH_ERROR] Session save error:", err);
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
            console.error("Passkey login error:", error);
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
