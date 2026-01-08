/**
 * Tax Export Routes
 * 
 * API endpoints for tax data export (CSV, PDF, summary)
 * Users self-file taxes using exported data
 */

import type { Express, Request, Response } from "express";
import { requireWalletOwnership } from "./security";
import { asyncHandler } from "./error-handler";
import {
    getAnnualTaxSummary,
    getTransactionExport,
    type TransactionExport
} from "./tax-export-service";
import { logger } from "./logger";
import { Parser } from "json2csv";

interface AuthenticatedRequest extends Request {
    authenticatedWallet?: string;
}

export function registerTaxRoutes(app: Express) {
    /**
     * Get annual tax summary
     * GET /api/tax/summary/:year
     */
    app.get("/api/tax/summary/:year", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { year } = req.params;
        const walletAddress = req.authenticatedWallet!;
        const taxYear = parseInt(year);

        if (isNaN(taxYear) || taxYear < 2020 || taxYear > 2030) {
            return res.status(400).json({ error: "Invalid tax year" });
        }

        const summary = await getAnnualTaxSummary(walletAddress, taxYear);

        res.json({
            success: true,
            data: summary
        });
    }));

    /**
     * Export transactions as CSV
     * GET /api/tax/export/:year/csv
     */
    app.get("/api/tax/export/:year/csv", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { year } = req.params;
        const walletAddress = req.authenticatedWallet!;
        const taxYear = parseInt(year);

        if (isNaN(taxYear)) {
            return res.status(400).json({ error: "Invalid tax year" });
        }

        const transactions = await getTransactionExport(walletAddress, taxYear);

        // Convert to CSV
        const fields = [
            { label: 'Date', value: 'date' },
            { label: 'Type', value: 'type' },
            { label: 'Invoice Number', value: 'invoiceNumber' },
            { label: 'Counterparty', value: 'counterparty' },
            { label: 'Description', value: 'description' },
            { label: 'Amount', value: 'amount' },
            { label: 'Currency', value: 'currency' },
            { label: 'Status', value: 'status' },
            { label: 'Payment Date', value: 'paymentDate' },
            { label: 'Payment Method', value: 'paymentMethod' }
        ];

        const parser = new Parser({ fields });
        const csv = parser.parse(transactions);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="invoix-tax-${taxYear}.csv"`);
        res.send(csv);

        logger.info(`CSV export downloaded for year ${taxYear}`, "tax", {
            wallet: walletAddress.slice(0, 8),
            transactions: transactions.length
        });
    }));

    /**
     * Get available tax years for user
     * GET /api/tax/years
     */
    app.get("/api/tax/years", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const walletAddress = req.authenticatedWallet!;

        // Get years user has activity (invoices created)
        const { db, schema } = await import("./db");
        const { sql } = await import("drizzle-orm");

        const years = await db.selectDistinct({
            year: sql`EXTRACT(YEAR FROM ${schema.invoices.createdAt})::integer`
        })
            .from(schema.invoices)
            .where(
                sql`${schema.invoices.invoicerWalletAddress} = ${walletAddress} OR ${schema.invoices.invoiceeWalletAddress} = ${walletAddress}`
            )
            .orderBy(sql`year DESC`);

        const availableYears = years.map(y => y.year);

        // Always include current year even if no activity yet
        const currentYear = new Date().getFullYear();
        if (!availableYears.includes(currentYear)) {
            availableYears.unshift(currentYear);
        }

        res.json({
            success: true,
            years: availableYears
        });
    }));

    /**
     * Get tax threshold status ($600 warning)
     * GET /api/tax/threshold/:year
     */
    app.get("/api/tax/threshold/:year", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { year } = req.params;
        const walletAddress = req.authenticatedWallet!;
        const taxYear = parseInt(year);

        const summary = await getAnnualTaxSummary(walletAddress, taxYear);
        const totalReceived = parseFloat(summary.summary.totalReceived);
        const threshold = 600; // IRS 1099-K threshold (2024+)

        const exceedsThreshold = totalReceived >= threshold;
        const percentOfThreshold = (totalReceived / threshold) * 100;

        res.json({
            success: true,
            data: {
                totalReceived: summary.summary.totalReceived,
                threshold,
                exceedsThreshold,
                percentOfThreshold: Math.round(percentOfThreshold),
                requiresReporting: exceedsThreshold,
                message: exceedsThreshold
                    ? "You may need to report this income on your tax return. Consult a tax professional."
                    : "You are below the $600 reporting threshold for this year."
            }
        });
    }));
}
