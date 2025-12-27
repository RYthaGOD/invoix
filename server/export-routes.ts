import { Router, Request } from "express";
import { invoiceStorage } from "./invoice-storage";
// @ts-ignore
import { Parser } from "json2csv";
import type { Invoice } from "./invoice-storage";

const router = Router();

// Mounted at /api/invoices via routes.ts, so this becomes /api/invoices/export
router.get("/export", async (req, res) => {
    // 1. Auth Check - Use session-based auth (consistent with rest of app)
    if (!req.session?.walletAddress) {
        return res.status(401).json({ success: false, message: "Unauthorized - Please log in" });
    }

    const format = req.query.format as string || "csv";
    if (format !== "csv") {
        return res.status(400).json({ success: false, message: "Only CSV format is currently supported" });
    }

    try {
        // 2. Fetch Invoices (My Invoices)
        const userWallet = req.session.walletAddress;

        // Fetch All (no pagination)
        const invoices = await invoiceStorage.getInvoices(userWallet, {
            limit: 10000 // Hard safety limit
        });

        if (!invoices || invoices.length === 0) {
            return res.status(404).send("No invoices found to export");
        }

        // 3. Transform to CSV
        const fields = [
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

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(invoices);

        // 4. Send File
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);

    } catch (error) {
        console.error("Export failed:", error);
        res.status(500).send("Export failed");
    }
});

export default router;
