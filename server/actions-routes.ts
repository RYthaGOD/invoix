
import { Router } from "express";

export const actionsRouter = Router();

/**
 * GET /actions.json
 * 
 * Root-level configuration for Solana Actions (Blinks).
 * This tells wallets (Phantom/Solflare) which URL patterns on this domain 
 * can be unfurled into Actions.
 * 
 * Spec: https://github.com/solana-developers/solana-actions/blob/main/spec.md
 */
actionsRouter.get("/actions.json", (req, res) => {
    res.json({
        rules: [
            {
                // Map regular invoice URLs (e.g., /i/123) to the API action (e.g., /api/solana-pay/123)
                pathPattern: "/i/**",
                apiPath: "/api/solana-pay/**",
            },
        ],
    });
});
