
import type { Express, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { db, schema } from "./db";
const { businessProfiles, invoices } = schema;
import { eq, and } from "drizzle-orm";
import { requireWalletOwnership } from "./security";
import { z } from "zod";
import { logger } from "./logger";

// Validation Schema
const profileSchema = z.object({
    businessName: z.string().min(1, "Business Name is required"),
    businessEmail: z.string().email().optional().or(z.literal("")),
    businessPhone: z.string().optional(),
    businessAddress: z.string().optional(),
    businessWebsite: z.string().url().optional().or(z.literal("")),
    taxId: z.string().optional(),
    taxRegistrationNumber: z.string().optional(),
    defaultPaymentTerms: z.string().optional(),
    defaultInvoicePrefix: z.string().optional(),
    logoUrl: z.string().optional(), // Added logoUrl
});

export function registerProfileRoutes(app: Express) {

    /**
     * Get Business Profile
     * GET /api/business/profile
     */
    app.get("/api/business/profile", requireWalletOwnership, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress!; // Guaranteed by middleware

            const profile = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, walletAddress),
            });

            // Check for OG Status (Paid Community Drop Invoice)
            const ogPurchase = await db.query.invoices.findFirst({
                where: and(
                    eq(invoices.invoiceeWalletAddress, walletAddress),
                    eq(invoices.description, "Exclusive Community NFT Mint"),
                    eq(invoices.status, "paid")
                )
            });

            const isOG = !!ogPurchase;

            if (!profile) {
                return res.json({ success: true, profile: null, isOG });
            }

            res.json({ success: true, profile, isOG });
        } catch (error: any) {
            logger.error("Error fetching profile", "profile", { error });
            res.status(500).json({ success: false, message: "Failed to fetch profile" });
        }
    });

    /**
     * Update Business Profile (Upsert)
     * PUT /api/business/profile
     */
    app.put("/api/business/profile", requireWalletOwnership, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress!;

            // Validate Input
            const parsed = profileSchema.extend({
                brandColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color code").optional(),
                defaultPrivacySettings: z.boolean().optional(),
                nextInvoiceNumber: z.number().int().min(1).optional(),
            }).safeParse(req.body);

            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }

            const data = parsed.data;

            // Check if profile exists
            const existing = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, walletAddress),
            });

            let updatedProfile;

            if (existing) {
                // Update
                const updateResult = await db.update(businessProfiles as any)
                    .set({
                        businessName: data.businessName,
                        businessEmail: data.businessEmail || null,
                        businessPhone: data.businessPhone || null,
                        businessAddress: data.businessAddress || null,
                        businessWebsite: data.businessWebsite || null,
                        taxId: data.taxId || null,
                        taxRegistrationNumber: data.taxRegistrationNumber || null,
                        logoUrl: data.logoUrl || existing.logoUrl,
                        defaultPaymentTerms: data.defaultPaymentTerms || "Net 30",
                        defaultInvoicePrefix: data.defaultInvoicePrefix || "INV",
                        // New Fields
                        brandColor: data.brandColor || existing.brandColor || "#3b82f6",
                        defaultPrivacySettings: data.defaultPrivacySettings !== undefined ? data.defaultPrivacySettings : existing.defaultPrivacySettings,
                        nextInvoiceNumber: data.nextInvoiceNumber || undefined, // Only update if provided
                        updatedAt: new Date(),
                    })
                    .where(eq(businessProfiles.ownerWalletAddress, walletAddress))
                    .returning() as any[];
                updatedProfile = updateResult[0];
            } else {
                // Insert
                const insertResult = await db.insert(businessProfiles as any)
                    .values({
                        ownerWalletAddress: walletAddress,
                        businessName: data.businessName,
                        businessEmail: data.businessEmail || null,
                        businessPhone: data.businessPhone || null,
                        businessAddress: data.businessAddress || null,
                        businessWebsite: data.businessWebsite || null,
                        taxId: data.taxId || null,
                        taxRegistrationNumber: data.taxRegistrationNumber || null,
                        logoUrl: data.logoUrl || null,
                        defaultPaymentTerms: data.defaultPaymentTerms || "Net 30",
                        defaultInvoicePrefix: data.defaultInvoicePrefix || "INV",
                        // New Fields
                        brandColor: data.brandColor || "#3b82f6",
                        defaultPrivacySettings: data.defaultPrivacySettings !== undefined ? data.defaultPrivacySettings : true,
                        nextInvoiceNumber: data.nextInvoiceNumber || 1,
                    })
                    .returning() as any[];
                updatedProfile = insertResult[0];
            }

            res.json({ success: true, profile: updatedProfile, message: "Profile updated successfully" });

        } catch (error: any) {
            logger.error("Error updating profile", "profile", { error });
            res.status(500).json({ success: false, message: "Failed to update profile" });
        }
    });

    /**
     * Create Mint Transaction for Identity NFT
     * POST /api/business/mint-identity-nft
     * Returns: { transaction: base64, mint: string }
     */
    app.post("/api/business/mint-identity-nft", requireWalletOwnership, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress!;

            // 1. Get Profile
            const profile = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, walletAddress),
            });

            if (!profile) {
                return res.status(404).json({ success: false, message: "Business profile not found. Please save your profile first." });
            }

            // 2. Sybil Protection
            const { businessIdentityNFTs } = await import("@shared/invoice-schema");
            const existingNft = await db.query.businessIdentityNFTs.findFirst({
                where: eq(businessIdentityNFTs.businessProfileId, profile.id),
            });

            if (existingNft) {
                return res.status(400).json({ success: false, message: "You have already minted a Verified Business Badge." });
            }

            // 3. Get NFT Service
            const { getInvoiceNFTService } = await import("./nft-service");
            const nftService = getInvoiceNFTService();

            if (!nftService.isReady()) {
                const initialized = await nftService.initialize();
                if (!initialized) {
                    return res.status(503).json({ success: false, message: "NFT Service unavailable" });
                }
            }

            // 4. Generate Transaction (Server pays rent, User pays 0.008 fee + gas)
            logger.info(`Creating Identity NFT Tx for ${profile.businessName}...`, "profile");
            // FIX R3-5: Require treasury wallet from env, no hardcoded fallback
            const treasuryAddress = process.env.PLATFORM_TREASURY_WALLET;
            if (!treasuryAddress) {
                return res.status(503).json({ success: false, message: "Treasury wallet not configured" });
            }
            const { transaction, mint } = await nftService.createBusinessIdentityMintTransaction(
                profile,
                walletAddress,
                treasuryAddress,
                "basic"
            );

            // Return transaction for client to sign
            res.json({ success: true, transaction, mint });

        } catch (error: any) {
            logger.error("Mint Identity Error", "profile", { error });
            res.status(500).json({ success: false, message: error.message || "Failed to create mint transaction" });
        }
    });

    /**
     * Confirm Identity Mint
     * POST /api/business/confirm-identity-mint
     * Verifies on-chain and saves DB record
     */
    app.post("/api/business/confirm-identity-mint", requireWalletOwnership, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress!;
            const { signature, mint } = req.body;

            if (!signature || !mint) {
                return res.status(400).json({ success: false, message: "Signature and mint address required" });
            }

            // 1. Verify Transaction on Solana
            const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
            const status = await connection.getSignatureStatus(signature);

            // Allow "confirmed" or "finalized"
            if (!status || !status.value || status.value.err) {
                return res.status(400).json({ success: false, message: "Transaction failed or not found on-chain" });
            }

            // 2. Get Profile Again
            const profile = await db.query.businessProfiles.findFirst({
                where: eq(businessProfiles.ownerWalletAddress, walletAddress),
            });

            if (!profile) {
                return res.status(404).json({ success: false, message: "Profile not found" });
            }

            // 3. Save to DB
            const { businessIdentityNFTs } = await import("@shared/invoice-schema");

            // Check if already saved (idempotency)
            const existing = await db.query.businessIdentityNFTs.findFirst({
                where: eq(businessIdentityNFTs.nftMint, mint)
            });

            if (!existing) {
                await db.insert(businessIdentityNFTs).values({
                    businessProfileId: profile.id,
                    nftMint: mint,
                    nftOwner: walletAddress,
                    nftMetadataUri: `${process.env.API_URL || 'https://api.solanainvoice.com'}/nft-metadata/business/${profile.id}`,
                    verificationLevel: "basic",
                    nftMintSignature: signature,
                });
                logger.info(`Confirmed and Saved Identity NFT: ${mint}`, "profile");
            }

            res.json({ success: true, message: "Identity Badge Confirmed!" });

        } catch (error: any) {
            logger.error("Confirm Mint Error", "profile", { error });
            res.status(500).json({ success: false, message: "Failed to confirm mint" });
        }
    });
}
