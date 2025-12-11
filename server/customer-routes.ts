
import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { strictRateLimit, requireWalletOwnership } from "./security";
import { InsertCustomerProfile } from "@shared/invoice-schema";

export function registerCustomerRoutes(app: Express): void {

    // GET /api/customers?wallet=...
    app.get("/api/customers", requireWalletOwnership, async (req, res) => {
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
            const customerData: InsertCustomerProfile = req.body;

            // Basic validation
            if (!customerData.businessWalletAddress || !customerData.customerWalletAddress || !customerData.customerName) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            const newCustomer = await invoiceStorage.createCustomerProfile(customerData);
            res.json({ success: true, customer: newCustomer });
        } catch (error: any) {
            console.error("Error creating customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // PATCH /api/customers/:id
    app.patch("/api/customers/:id", requireWalletOwnership, async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            // Prevent updating wallet ownership via this route effectively
            delete updates.id;
            delete updates.businessWalletAddress; // Cannot change owner

            const updatedCustomer = await invoiceStorage.updateCustomerProfile(id, updates);

            if (!updatedCustomer) {
                return res.status(404).json({ success: false, message: "Customer not found" });
            }

            res.json({ success: true, customer: updatedCustomer });
        } catch (error: any) {
            console.error("Error updating customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // DELETE /api/customers/:id
    app.delete("/api/customers/:id", requireWalletOwnership, async (req, res) => {
        try {
            const { id } = req.params;
            const success = await invoiceStorage.deleteCustomerProfile(id);

            if (!success) {
                return res.status(404).json({ success: false, message: "Customer not found" });
            }

            res.json({ success: true, message: "Customer deleted" });
        } catch (error: any) {
            console.error("Error deleting customer:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}
