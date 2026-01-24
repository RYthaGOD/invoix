
import { type Express } from "express";
import { db } from "../db";
import { invoices, businessProfiles } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { generateInvoiceSvg, generatePrivateInvoiceSvg, generateTradingCardSvg } from "../utils/svg-generator";
import { NFT_COLLECTION } from "@shared/nft-collection";
import path from "path";
import fs from "fs";

export function registerDynamicImageRoutes(app: Express) {

    // GET /api/images/dynamic-nft/invoice-3d/:id.svg
    // Premium 8K Invoice Visuals
    app.get("/api/images/dynamic-nft/invoice-3d/:identifier.svg", async (req, res) => {
        try {
            const { identifier } = req.params;
            const invoiceId = identifier.replace("invoice-", "").replace(".svg", "");

            const invoice = await db.query.invoices.findFirst({
                where: eq(invoices.id, invoiceId)
            });

            if (!invoice) {
                return res.status(404).send("Invoice not found");
            }

            // VISUAL PRIVACY CHECK
            if (invoice.isPrivate) {
                const svg = generatePrivateInvoiceSvg();
                res.setHeader("Content-Type", "image/svg+xml");
                res.setHeader("Cache-Control", "public, max-age=604800");
                return res.send(svg);
            }

            // Fetch Business Profile for Logo/Color
            const business = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, invoice.invoicerWalletAddress)
            });

            // LOGO LOADING
            let logoData: string | undefined = undefined;
            if (business?.logoUrl) {
                if (business.logoUrl.startsWith("/uploads/") && !business.logoUrl.includes("..")) {
                    const normalizedUrl = path.normalize(business.logoUrl).replace(/^(\.\.(\/|\\|$))+/, '');
                    const localPath = path.join(process.cwd(), normalizedUrl);
                    if (fs.existsSync(localPath)) {
                        const fileBuffer = await fs.promises.readFile(localPath);
                        const ext = path.extname(localPath).replace(".", "");
                        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
                        logoData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
                    }
                }
            }

            const svg = generateInvoiceSvg(invoice, business, { logoData });

            res.setHeader("Content-Type", "image/svg+xml");
            res.setHeader("Cache-Control", "public, max-age=60");
            res.send(svg);

        } catch (error) {
            console.error("Error generating dynamic invoice image:", error);
            res.status(500).send("Error producing image");
        }
    });

    // GET /api/images/dynamic-nft/community-3d/:variantId.svg
    // Premium 8K Community Trading Cards
    app.get("/api/images/dynamic-nft/community-3d/:variantId.svg", async (req, res) => {
        try {
            const { variantId } = req.params;
            // Lookup NFT variant from shared config
            const nftVariant = NFT_COLLECTION.find(n => n.id === variantId.replace(".svg", ""));

            if (!nftVariant) {
                return res.status(404).send("NFT Variant not found");
            }

            // Load Character Image
            let imageData: string | undefined = undefined;
            if (nftVariant.image) {
                const localPath = path.join(process.cwd(), "uploads", nftVariant.image);
                if (fs.existsSync(localPath)) {
                    const fileBuffer = await fs.promises.readFile(localPath);
                    const ext = path.extname(localPath).replace(".", "");
                    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
                    imageData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
                }
            }

            const svg = generateTradingCardSvg(nftVariant, imageData);

            res.setHeader("Content-Type", "image/svg+xml");
            res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24h (pseudo-static)
            res.send(svg);

        } catch (error) {
            console.error("Error generating community card:", error);
            res.status(500).send("Error producing card");
        }
    });
}
