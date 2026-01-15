
import { Router } from "express";
import { requireWalletOwnership } from "./security";
import {
    getAnnualTaxSummary,
    getTransactionExport
} from "./tax-export-service";
import { logger } from "./logger";

export function registerTaxRoutes(app: any) {
    const router = Router();

    /**
     * Get available tax years
     * Returns list of years where user has activity
     */
    router.get("/years", requireWalletOwnership, async (req, res) => {
        try {
            // For now, simple implementation: current year and last year
            // Real impl would query DB for min/max invoice dates
            const currentYear = new Date().getFullYear();
            res.json({
                success: true,
                years: [currentYear, currentYear - 1]
            });
        } catch (error: any) {
            logger.error("Error fetching tax years", "tax", { error });
            res.status(500).json({ error: "Failed to fetch tax years" });
        }
    });

    /**
     * Get annual summary for dashboard
     */
    router.get("/summary/:year", requireWalletOwnership, async (req, res) => {
        try {
            const year = parseInt(req.params.year);
            const wallet = (req as any).authenticatedWallet;

            if (isNaN(year)) {
                return res.status(400).json({ error: "Invalid year" });
            }

            const data = await getAnnualTaxSummary(wallet, year);
            res.json({ success: true, data });
        } catch (error: any) {
            logger.error(`Error fetching tax summary for ${req.params.year}`, "tax", { error });
            res.status(500).json({ error: "Failed to fetch tax summary" });
        }
    });

    /**
     * Get 1099-K Threshold Status
     */
    router.get("/threshold/:year", requireWalletOwnership, async (req, res) => {
        try {
            const year = parseInt(req.params.year);
            const wallet = (req as any).authenticatedWallet;

            // Get standard summary
            const data = await getAnnualTaxSummary(wallet, year);

            // 2024 Threshold: $5000 (Phased) - or $600 depending on state?
            // "For tax year 2024, the IRS is planning for a threshold of $5,000..."
            // We'll use $600 as the "warn" level just to be safe/educational.
            const THRESHOLD = 600;
            const totalReceived = parseFloat(data.summary.totalReceived);

            res.json({
                success: true,
                data: {
                    thresholdAmount: THRESHOLD,
                    totalReceived,
                    exceedsThreshold: totalReceived >= THRESHOLD,
                    percentOfThreshold: Math.min(100, Math.round((totalReceived / THRESHOLD) * 100))
                }
            });
        } catch (error: any) {
            logger.error("Error fetching threshold status", "tax", { error });
            res.status(500).json({ error: "Failed to fetch status" });
        }
    });

    /**
     * Export Transactions as CSV
     */
    router.get("/export/:year/csv", requireWalletOwnership, async (req, res) => {
        try {
            const year = parseInt(req.params.year);
            const wallet = (req as any).authenticatedWallet;

            const transactions = await getTransactionExport(wallet, year);

            // CSV Header
            let csv = "Date,Type,Invoice Number,Counterparty,Description,Amount,Currency,Status,Payment Date,Payment Method\n";

            // CSV Rows
            transactions.forEach(tx => {
                const row = [
                    tx.date,
                    tx.type,
                    tx.invoiceNumber,
                    tx.counterparty,
                    `"${(tx.description || "").replace(/"/g, '""')}"`, // Escape quotes
                    tx.amount,
                    tx.currency,
                    tx.status,
                    tx.paymentDate || "",
                    tx.paymentMethod || ""
                ];
                csv += row.join(",") + "\n";
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="invoix-tax-${year}.csv"`);
            res.send(csv);

        } catch (error: any) {
            logger.error("Error generating CSV export", "tax", { error });
            res.status(500).json({ error: "Failed to generate export" });
        }
    });


    // Mount router
    app.use("/api/tax", router);
}
