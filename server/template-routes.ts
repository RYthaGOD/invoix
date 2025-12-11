
import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { strictRateLimit, requireWalletOwnership } from "./security";

export function registerTemplateRoutes(app: Express): void {

    // GET /api/templates?wallet=...
    app.get("/api/templates", requireWalletOwnership, async (req, res) => {
        try {
            const walletAddress = req.query.wallet as string;
            const templates = await invoiceStorage.getInvoiceTemplates(walletAddress);
            res.json({ success: true, templates });
        } catch (error: any) {
            console.error("Error fetching templates:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // POST /api/templates
    app.post("/api/templates", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const templateData = req.body;

            // Basic validation
            if (!templateData.ownerWalletAddress || !templateData.name) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            const newTemplate = await invoiceStorage.createInvoiceTemplate(templateData);
            res.json({ success: true, template: newTemplate });
        } catch (error: any) {
            console.error("Error creating template:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // PATCH /api/templates/:id
    app.patch("/api/templates/:id", requireWalletOwnership, async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            delete updates.id;
            delete updates.ownerWalletAddress; // Cannot change owner

            const updatedTemplate = await invoiceStorage.updateInvoiceTemplate(id, updates);

            if (!updatedTemplate) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            res.json({ success: true, template: updatedTemplate });
        } catch (error: any) {
            console.error("Error updating template:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // DELETE /api/templates/:id
    app.delete("/api/templates/:id", requireWalletOwnership, async (req, res) => {
        try {
            const { id } = req.params;
            const success = await invoiceStorage.deleteInvoiceTemplate(id);

            if (!success) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            res.json({ success: true, message: "Template deleted" });
        } catch (error: any) {
            console.error("Error deleting template:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}
