import { Router } from "express";
import { xeroService } from "../services/accounting/xero";
import { db } from "../db";
import { businessProfiles } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";

const router = Router();

// ==========================================
// XERO AUTHENTICATION
// ==========================================

/**
 * GET /api/integrations/auth/xero
 * Initiates the Xero OAuth 2.0 flow
 */
router.get("/auth/xero", async (req, res) => {
    try {
        // In a real app, we'd use the session user ID as state
        // For now, we'll just pass a placeholder state
        if (!req.session?.user?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const state = req.session.user.id.toString();
        const url = await xeroService.getAuthUrl(state);
        res.redirect(url);
    } catch (error) {
        console.error("Xero Auth Error:", error);
        res.status(500).json({ error: "Failed to initiate Xero authentication" });
    }
});

/**
 * GET /api/integrations/callback/xero
 * Handles the callback from Xero
 */
router.get("/callback/xero", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== "string") {
            return res.status(400).send("Missing authorization code");
        }

        // Verify state matches user session (simplified for now)
        // const userId = req.session?.user?.id;
        // if (state !== userId) { ... }

        // For this scaffold, we'll assume the state IS the user ID (passed from auth)
        // In production, use signed state or session checks
        const userId = state as string; // Warning: unsafe for prod, just for scaffold

        // Exchange code for token
        const token = await xeroService.handleCallback(code, 0); // 0 is placeholder ID

        // Render a simple success page or redirect back to app
        res.send(`
      <h1>Xero Connected!</h1>
      <p>You can now close this window and return to Invoix.</p>
      <script>
        setTimeout(() => window.close(), 3000);
      </script>
    `);
    } catch (error) {
        console.error("Xero Callback Error:", error);
        res.status(500).send("Authentication failed");
    }
});

// ==========================================
// QUICKBOOKS AUTHENTICATION
// ==========================================

/**
 * GET /api/integrations/auth/quickbooks
 * Initiates the QuickBooks OAuth 2.0 flow
 */
router.get("/auth/quickbooks", async (req, res) => {
    try {
        if (!req.session?.user?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { quickBooksService } = await import("../services/accounting/quickbooks");
        const state = req.session.user.id.toString();
        const url = await quickBooksService.getAuthUrl(state);
        res.redirect(url);
    } catch (error) {
        console.error("QuickBooks Auth Error:", error);
        res.status(500).json({ error: "Failed to initiate QuickBooks authentication" });
    }
});

/**
 * GET /api/integrations/callback/quickbooks
 * Handles the callback from QuickBooks
 */
router.get("/callback/quickbooks", async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || typeof code !== "string") {
            return res.status(400).send("Missing authorization code");
        }
        const { quickBooksService } = await import("../services/accounting/quickbooks");
        await quickBooksService.handleCallback(code, 0);

        res.send(`
      <h1>QuickBooks Connected!</h1>
      <p>You can now close this window and return to Invoix.</p>
      <script>
        setTimeout(() => window.close(), 3000);
      </script>
    `);
    } catch (error) {
        console.error("QuickBooks Callback Error:", error);
        res.status(500).send("Authentication failed");
    }
});

export default router;
