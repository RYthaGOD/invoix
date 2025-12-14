
import { type Express } from "express";
import { db } from "../db";
import { invoices, businessProfiles } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { generateInvoiceSvg, generatePrivateInvoiceSvg } from "../utils/svg-generator";
import path from "path";
import fs from "fs";

export function registerDynamicImageRoutes(app: Express) {

    // GET /api/images/dynamic-nft/invoice/:id.svg
    app.get("/api/images/dynamic-nft/invoice/:identifier.svg", async (req, res) => {
        try {
            const { identifier } = req.params;
            // Support "invoice-UUID" or just "UUID"
            const invoiceId = identifier.replace("invoice-", "").replace(".svg", "");

            const invoice = await db.query.invoices.findFirst({
                where: eq(invoices.id, invoiceId)
            });

            if (!invoice) {
                return res.status(404).send("Invoice not found");
            }

            // VISUAL PRIVACY CHECK
            if (invoice.isPrivate) {
                const svg = generatePrivateInvoiceSvg(invoice.id);
                res.setHeader("Content-Type", "image/svg+xml");
                res.setHeader("Cache-Control", "public, max-age=604800"); // Cache for 1 week (static)
                return res.send(svg);
            }

            // Fetch Business Profile for Logo/Color
            let business;
            // Invoice doesn't have businessId foreign key directly?
            // Wait, we query business profiles by wallet usually.
            // Let's check schema. `businessProfiles.ownerWalletAddress`. `invoices.invoicerWalletAddress`.

            business = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, invoice.invoicerWalletAddress)
            });

            // LOGO LOADING
            let logoData: string | undefined = undefined;
            if (business?.logoUrl) {
                // Determine if it is a local file or external
                // Our uploads are `/uploads/filename`.
                // Our uploads are `/uploads/filename`.
                // SECURITY: Prevent path traversal
                if (business.logoUrl.startsWith("/uploads/") && !business.logoUrl.includes("..")) {
                    const normalizedUrl = path.normalize(business.logoUrl).replace(/^(\.\.(\/|\\|$))+/, '');
                    const localPath = path.join(process.cwd(), normalizedUrl);

                    // Double check it resolves to uploads dir
                    const uploadsDir = path.join(process.cwd(), "uploads");
                    if (localPath.startsWith(uploadsDir) && fs.existsSync(localPath)) {
                        const fileBuffer = await fs.promises.readFile(localPath);
                        const ext = path.extname(localPath).replace(".", "");
                        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
                        logoData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
                    }
                } else {
                    // It might be an external URL. 
                    // To prevent breakage in wallet, we should technically download and embed it?
                    // For now, let's just pass the URL if we can't load it locally, but generator assumes data uri for best results.
                    // If simple URL passed to image href, it works in browser but maybe not phantom.
                    // Let's skip complex external fetching for now to avoid timeout risks.
                }
            }

            const svg = generateInvoiceSvg(invoice, business, { logoData });

            res.setHeader("Content-Type", "image/svg+xml");
            // Cache for 1 minute
            res.setHeader("Cache-Control", "public, max-age=60");
            res.send(svg);

        } catch (error) {
            console.error("Error generating dynamic invoice image:", error);
            res.status(500).send("Error producing image");
        }
    });

    // We can also add a route for Receipt if we want a live view, 
    // but Receipts are minted to Arweave, so we just use the generator internally for that.
}
