
import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { strictRateLimit, globalRateLimit, requireWalletOwnership } from "./security";
import { InsertCustomerProfile, customerProfiles } from "@shared/invoice-schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Zod validation schema for customer creation/update
const customerSchema = z.object({
    customerWalletAddress: z.string().min(32).max(44),
    customerName: z.string().min(1).max(200),
    customerEmail: z.string().email().optional().nullable(),
    customerPhone: z.string().max(50).optional().nullable(),
    customerAddress: z.string().max(500).optional().nullable(),
    customerNotes: z.string().max(2000).optional().nullable(),
    paymentTerms: z.string().max(100).optional().nullable(),
});

export function registerCustomerRoutes(app: Express): void {

    // GET /api/customers?wallet=...
    app.get("/api/customers", requireWalletOwnership, globalRateLimit, async (req, res) => {
        try {
            const walletAddress = req.query.wallet as string;
            const customers = await invoiceStorage.getCustomerProfiles(walletAddress);
            res.json({ success: true, customers });
        } catch (error: any) {
            console.error("Error fetching customers:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // POST /api/customers
    app.post("/api/customers", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            // Zod validation
            const parseResult = customerSchema.safeParse(req.body);
            if (!parseResult.success) {
                return res.status(400).json({
                    success: false,
                    message: "Validation error",
                    errors: parseResult.error.errors
                });
            }

            // FIX R3-11: Force businessWalletAddress from authenticated session
            // Prevents users from creating customers under someone else's wallet
            const customerData: InsertCustomerProfile = {
                ...parseResult.data,
                businessWalletAddress: req.session.walletAddress!,
            };

            const newCustomer = await invoiceStorage.createCustomerProfile(customerData);
            res.json({ success: true, customer: newCustomer });
        } catch (error: any) {
            console.error("Error creating customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // PATCH /api/customers/:id
    app.patch("/api/customers/:id", requireWalletOwnership, globalRateLimit, async (req, res) => {
        try {
            const { id } = req.params;
            const sessionWallet = req.session.walletAddress!;

            // FIX R3-3: Verify session wallet owns this customer before updating
            const customer = await db.query.customerProfiles.findFirst({
                where: eq(customerProfiles.id, id)
            });

            if (!customer) {
                return res.status(404).json({ success: false, message: "Customer not found" });
            }

            if (customer.businessWalletAddress !== sessionWallet) {
                return res.status(403).json({ success: false, message: "Not authorized to update this customer" });
            }

            const updates = req.body;
            // Prevent updating wallet ownership via this route
            delete updates.id;
            delete updates.businessWalletAddress;

            const updatedCustomer = await invoiceStorage.updateCustomerProfile(id, updates);
            res.json({ success: true, customer: updatedCustomer });
        } catch (error: any) {
            console.error("Error updating customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // DELETE /api/customers/:id
    app.delete("/api/customers/:id", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const { id } = req.params;
            const sessionWallet = req.session.walletAddress!;

            // FIX R3-3: Verify session wallet owns this customer before deleting
            const customer = await db.query.customerProfiles.findFirst({
                where: eq(customerProfiles.id, id)
            });

            if (!customer) {
                return res.status(404).json({ success: false, message: "Customer not found" });
            }

            if (customer.businessWalletAddress !== sessionWallet) {
                return res.status(403).json({ success: false, message: "Not authorized to delete this customer" });
            }

            const success = await invoiceStorage.deleteCustomerProfile(id);
            res.json({ success: true, message: "Customer deleted" });
        } catch (error: any) {
            console.error("Error deleting customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}
