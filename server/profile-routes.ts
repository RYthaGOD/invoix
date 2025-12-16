
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { businessProfiles } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { requireWalletOwnership } from "./security";
import { z } from "zod";

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

            if (!profile) {
                return res.json({ success: true, profile: null });
            }

            res.json({ success: true, profile });
        } catch (error: any) {
            console.error("Error fetching profile:", error);
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
            const parsed = profileSchema.safeParse(req.body);
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
                [updatedProfile] = await db.update(businessProfiles)
                    .set({
                        businessName: data.businessName,
                        businessEmail: data.businessEmail || null,
                        businessPhone: data.businessPhone || null,
                        businessAddress: data.businessAddress || null,
                        businessWebsite: data.businessWebsite || null,
                        taxId: data.taxId || null,
                        taxRegistrationNumber: data.taxRegistrationNumber || null,
                        // Fix: Save logoUrl
                        logoUrl: data.logoUrl || existing.logoUrl,
                        defaultPaymentTerms: data.defaultPaymentTerms || "Net 30",
                        defaultInvoicePrefix: data.defaultInvoicePrefix || "INV",
                        updatedAt: new Date(),
                    })
                    .where(eq(businessProfiles.ownerWalletAddress, walletAddress))
                    .returning();
            } else {
                // Insert
                [updatedProfile] = await db.insert(businessProfiles)
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
                    })
                    .returning();
            }

            res.json({ success: true, profile: updatedProfile, message: "Profile updated successfully" });

        } catch (error: any) {
            console.error("Error updating profile:", error);
            res.status(500).json({ success: false, message: "Failed to update profile" });
        }
    });

    /**
     * Mint Verified Business Identity NFT
     * POST /api/business/mint-identity-nft
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

            // 2. Sybil Protection: Check if already minted
            // Prevents draining server funds by minting infinite badges
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
                // Try to init
                const initialized = await nftService.initialize();
                if (!initialized) {
                    return res.status(503).json({ success: false, message: "NFT Service unavailable" });
                }
            }

            // 4. Mint Identity NFT
            // This is a server-paid transaction (our gift to the user for verifying)
            console.log(`Creating Identity NFT for ${profile.businessName}...`);
            const { mint, signature } = await nftService.mintBusinessIdentityNFT(profile, "basic");

            // 5. Save to DB
            await db.insert(businessIdentityNFTs).values({
                businessProfileId: profile.id,
                nftMint: mint,
                nftOwner: walletAddress,
                nftMetadataUri: "https://api.solanainvoice.com/nft-metadata/business/" + profile.id, // Placeholder, actual comes from service but not returned in basic struct
                verificationLevel: "basic",
                nftMintSignature: signature,
            });

            res.json({ success: true, message: "Identity Badge Minted successfully!", mint, signature });

        } catch (error: any) {
            console.error("Mint Identity Error:", error);
            res.status(500).json({ success: false, message: error.message || "Failed to mint identity NFT" });
        }
    });
}
