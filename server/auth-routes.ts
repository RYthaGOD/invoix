/**
 * Authentication Routes
 * 
 * Implements Sign-In With Solana (SIWS) for secure wallet-based authentication
 */

import type { Express, Request, Response } from "express";
import { verifyWalletSignature } from "./solana-sdk";
import { isValidSolanaAddress, auditLog, strictRateLimit } from "./security";

// Extend Express Session type
declare module "express-session" {
    interface SessionData {
        walletAddress: string;
        authenticatedAt: number;
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
                return res.status(400).json({
                    message: "Invalid message format: timestamp required"
                });
            }

            const messageTimestamp = parseInt(timestampMatch[1], 10);
            const now = Date.now();
            const fiveMinutesInMs = 5 * 60 * 1000;

            // Check message is not expired (5 minute window)
            if (now - messageTimestamp > fiveMinutesInMs) {
                return res.status(400).json({
                    message: "Message expired: Please sign a new message"
                });
            }

            // Verify the signature cryptographically
            const isValid = await verifyWalletSignature(
                walletAddress,
                message,
                signature
            );

            if (!isValid) {
                auditLog("login_failed_invalid_signature", {
                    walletAddress,
                    ip: req.ip,
                });

                return res.status(403).json({
                    message: "Invalid signature: Could not verify wallet ownership"
                });
            }

            // Create session
            req.session.walletAddress = walletAddress;
            req.session.authenticatedAt = now;

            auditLog("login_success", {
                walletAddress,
                ip: req.ip,
            });

            res.json({
                success: true,
                walletAddress,
                message: "Authentication successful"
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
            authenticatedAt: req.session.authenticatedAt
        });
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
