
import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { strictRateLimit, requireWalletOwnership } from "./security";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

const { invoiceTemplates } = schema;

export function registerTemplateRoutes(app: Express): void {

    // GET /api/templates?wallet=...
    app.get("/api/templates", requireWalletOwnership, async (req, res) => {
        try {
            // FIX: Force wallet from session, not query param
            const walletAddress = req.session.walletAddress!;
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

            // FIX: Force ownerWalletAddress from session (security)
            templateData.ownerWalletAddress = req.session.walletAddress!;

            // Basic validation
            if (!templateData.name) {
                return res.status(400).json({ success: false, message: "Template name is required" });
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
            const sessionWallet = req.session.walletAddress!;

            // FIX: Verify session wallet owns this template before updating
            const template = await db.query.invoiceTemplates.findFirst({
                where: eq(invoiceTemplates.id, id)
            });

            if (!template) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            if (template.ownerWalletAddress !== sessionWallet) {
                return res.status(403).json({ success: false, message: "Not authorized to update this template" });
            }

            const updates = req.body;
            delete updates.id;
            delete updates.ownerWalletAddress; // Cannot change owner

            const updatedTemplate = await invoiceStorage.updateInvoiceTemplate(id, updates);
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
            const sessionWallet = req.session.walletAddress!;

            // FIX: Verify session wallet owns this template before deleting
            const template = await db.query.invoiceTemplates.findFirst({
                where: eq(invoiceTemplates.id, id)
            });

            if (!template) {
                return res.status(404).json({ success: false, message: "Template not found" });
            }

            if (template.ownerWalletAddress !== sessionWallet) {
                return res.status(403).json({ success: false, message: "Not authorized to delete this template" });
            }

            const success = await invoiceStorage.deleteInvoiceTemplate(id);
            res.json({ success: true, message: "Template deleted" });
        } catch (error: any) {
            console.error("Error deleting template:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}
