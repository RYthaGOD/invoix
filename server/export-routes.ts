import { Router, Request } from "express";
import { invoiceStorage } from "./invoice-storage";
// @ts-ignore
import { Parser } from "json2csv";
import type { Invoice } from "./invoice-storage";

const router = Router();

// Mounted at /api/exports via routes.ts
router.get("/:type", async (req, res) => {
    // 1. Auth Check - Use session-based auth
    if (!req.session?.walletAddress) {
        return res.status(401).json({ success: false, message: "Unauthorized - Please log in" });
    }

    const { type } = req.params;
    const format = req.query.format as string || "csv";

    if (format !== "csv") {
        return res.status(400).json({ success: false, message: "Only CSV format is currently supported" });
    }

    if (type !== 'invoices' && type !== 'payments') {
        return res.status(400).json({ success: false, message: "Invalid export type" });
    }

    try {
        const userWallet = req.session.walletAddress;
        let data: any[] = [];
        let fields: any[] = [];
        let filenamePrefix = "export";

        if (type === 'invoices') {
            // Fetch All Invoices
            data = await invoiceStorage.getInvoices(userWallet, { limit: 10000 });
            filenamePrefix = "invoices";
            fields = [
                { label: 'Invoice #', value: 'invoiceNumber' },
                { label: 'Date Issued', value: (row: any) => row.dateIssued ? new Date(row.dateIssued).toISOString().split('T')[0] : '' },
                { label: 'Due Date', value: (row: any) => row.dueDate ? new Date(row.dueDate).toISOString().split('T')[0] : '' },
                { label: 'Customer', value: 'customerName' },
                { label: 'Total Amount', value: 'totalAmount' },
                { label: 'Currency', value: 'currency' },
                { label: 'Status', value: 'status' },
                { label: 'Paid Amount', value: 'paidAmount' },
                { label: 'Date Paid', value: (row: any) => row.paidAt ? new Date(row.paidAt).toISOString().split('T')[0] : '' }
            ];
        } else if (type === 'payments') {
            // Fetch All Payments
            data = await invoiceStorage.getPaymentsByWallet(userWallet);
            filenamePrefix = "payments";
            fields = [
                { label: 'Date', value: (row: any) => row.createdAt ? new Date(row.createdAt).toISOString().split('T')[0] : '' },
                { label: 'Invoice ID', value: 'invoiceId' },
                { label: 'Amount', value: 'amount' },
                { label: 'Currency', value: 'currency' },
                { label: 'Transaction Hash', value: 'txSignature' },
                { label: 'From', value: 'fromAddress' },
                { label: 'To', value: 'toAddress' },
                { label: 'Status', value: 'status' }
            ];
        }

        if (!data || data.length === 0) {
            return res.status(404).send(`No ${type} found to export`);
        }

        // Transform to CSV
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        // Send File
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);

    } catch (error) {
        console.error("Export failed:", error);
        res.status(500).send("Export failed");
    }
});

export default router;
