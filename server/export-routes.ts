
import { Router } from "express";
import { db } from "./db";
import { invoices, payments, businessProfiles, customerProfiles } from "@shared/invoice-schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { requireWalletOwnership } from "./security";

const router = Router();

/**
 * Helper to convert array of objects to CSV string
 */
function toCSV(data: any[]): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + (row[header] ?? '')).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
}

/**
 * Export Invoices as CSV
 * GET /api/exports/invoices?wallet=xxx
 */
router.get("/invoices", requireWalletOwnership, async (req, res) => {
    try {
        const walletAddress = req.query.wallet as string;

        // Fetch all invoices for this wallet (sent or received)
        const results = await db.select({
            Date: invoices.createdAt,
            InvoiceNumber: invoices.invoiceNumber,
            Role: sql<string>`CASE WHEN ${invoices.invoicerWalletAddress} = ${walletAddress} THEN 'Sender' ELSE 'Receiver' END`,
            OtherParty: sql<string>`CASE WHEN ${invoices.invoicerWalletAddress} = ${walletAddress} THEN ${invoices.invoiceeWalletAddress} ELSE ${invoices.invoicerWalletAddress} END`,
            Amount: invoices.totalAmount,
            Currency: invoices.currency,
            Status: invoices.status,
            IsPrivate: invoices.isPrivate,
        })
            .from(invoices)
            .where(
                or(
                    eq(invoices.invoicerWalletAddress, walletAddress),
                    eq(invoices.invoiceeWalletAddress, walletAddress)
                )
            )
            .orderBy(desc(invoices.createdAt));

        // Format dates and amounts
        const formattedData = results.map(row => ({
            ...row,
            Date: row.Date ? new Date(row.Date).toISOString().split('T')[0] : '',
            Amount: row.Amount?.toString() || '0',
        }));

        const csv = toCSV(formattedData);

        res.header("Content-Type", "text/csv");
        res.header("Content-Disposition", `attachment; filename="invoices-${walletAddress.slice(0, 8)}.csv"`);
        res.send(csv);

    } catch (error: any) {
        console.error("Export Invoices Error:", error);
        res.status(500).json({ message: "Failed to export invoices" });
    }
});

/**
 * Export Payments as CSV
 * GET /api/exports/payments?wallet=xxx
 */
router.get("/payments", requireWalletOwnership, async (req, res) => {
    try {
        const walletAddress = req.query.wallet as string;

        // Fetch payments related to this wallet (payer or payee via invoice)
        // We join with invoices to check relationship
        const results = await db.select({
            Date: payments.createdAt,
            PaymentId: payments.id,
            InvoiceNumber: invoices.invoiceNumber,
            Direction: sql<string>`CASE WHEN ${payments.toAddress} = ${walletAddress} THEN 'Incoming' ELSE 'Outgoing' END`,
            Amount: payments.amount,
            Currency: payments.currency,
            USDValue: payments.usdValueAtPayment,
            IsExpense: payments.isBusinessExpense,
            TxSignature: payments.txSignature,
            From: payments.fromAddress,
            To: payments.toAddress,
        })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(
                or(
                    eq(payments.fromAddress, walletAddress),
                    eq(payments.toAddress, walletAddress),
                    // Also include payments if user is the invoicer (even if payment went to a different address? usually same)
                    eq(invoices.invoicerWalletAddress, walletAddress),
                    eq(invoices.invoiceeWalletAddress, walletAddress)
                )
            )
            .orderBy(desc(payments.createdAt));

        // Format
        const formattedData = results.map(row => ({
            ...row,
            Date: row.Date ? new Date(row.Date).toISOString().split('T')[0] : '',
            Amount: row.Amount?.toString() || '0',
            USDValue: row.USDValue?.toString() || '',
            IsExpense: row.IsExpense ? 'Yes' : 'No',
        }));

        const csv = toCSV(formattedData);

        res.header("Content-Type", "text/csv");
        res.header("Content-Disposition", `attachment; filename="payments-${walletAddress.slice(0, 8)}.csv"`);
        res.send(csv);

    } catch (error: any) {
        console.error("Export Payments Error:", error);
        res.status(500).json({ message: "Failed to export payments" });
    }
});

export default router;
