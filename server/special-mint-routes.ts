
// @ts-nocheck

import type { Express, Request, Response } from "express";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getInvoiceNFTService } from "./nft-service";
import { getTokenBalance } from "./stablecoin-payment-service";
import { z } from "zod";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Configuration
const GATEKEEPER_TOKEN_MINT = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";
const DISCOUNTED_PRICE_USD = 0.50;
const STANDARD_PRICE_USD = 5.00;
// Treasury Wallet to receive the fee
const TREASURY_WALLET = process.env.PLATFORM_TREASURY_WALLET || "H8sMJqjq9yRa9qKz7BwFvbKkYj3ZzV8zL8zZ8zL8zZ8z";
// Admin wallet for reserved NFT minting (set in .env for privacy)
const ADMIN_WALLET = process.env.ADMIN_WALLET;

// Validation Schemas
const quoteSchema = z.object({
    walletAddress: z.string().min(1, "Wallet Address is required"),
});

const mintSchema = z.object({
    walletAddress: z.string().min(1, "Wallet Address is required"),
});

/**
 * Fetch current SOL Price in USD
 * Uses CoinGecko API with a fallback or simple cache in a real app.
 * For this implementation, we will fetch live.
 */
async function getSolPrice(): Promise<number> {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = await response.json();
        return data.solana.usd;
    } catch (error) {
        console.error("Error fetching SOL price, using fallback $150", error);
        return 150; // Safety fallback
    }
}

export function registerSpecialMintRoutes(app: Express) {

    /**
     * Get Pricing Quote
     * Checks token balance and returns the applicable price in USD and SOL
     * POST /api/special/quote
     */
    app.post("/api/special/quote", async (req: Request, res: Response) => {
        try {
            // Validate Input
            const parsed = quoteSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }
            const { walletAddress } = parsed.data;

            const connection = new Connection(SOLANA_RPC_URL);

            // Check Balance
            const balance = await getTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;

            // Determine Price
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            // Get SOL Price
            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9)); // 9 decimals for SOL

            res.json({
                success: true,
                isHolder,
                gatekeeperToken: GATEKEEPER_TOKEN_MINT,
                priceUsd,
                priceSol,
                solPrice
            });

        } catch (error: any) {
            console.error("Error generating quote:", error);
            res.status(500).json({ success: false, message: "Failed to generate quote" });
        }
    });

    /**
     * Create Mint Transaction
     * Generates a transaction that:
     * 1. Transfers Fee (SOL) to Treasury
     * 2. Mints the Special NFT
     * POST /api/special/mint
     */
    /**
     * Create Mint Transaction
     * Generates a transaction that:
     * 1. Transfers Fee (SOL) to Treasury
     * 2. Mints the Special NFT
     * POST /api/special/mint
     */
    app.post("/api/special/mint", async (req: Request, res: Response) => {
        try {
            // Validate Input
            const parsed = mintSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }
            const { walletAddress } = parsed.data;

            // 0. Ensure Business Profile Exists
            const { db } = await import("./db");
            const { businessProfiles } = await import("@shared/invoice-schema");
            const { eq } = await import("drizzle-orm");

            const profiles = await db.select().from(businessProfiles).where(eq(businessProfiles.wallet, walletAddress));
            if (profiles.length === 0) {
                return res.status(404).json({ success: false, message: "No business profile found. Please create one first." });
            }
            const businessProfile = profiles[0];

            const connection = new Connection(SOLANA_RPC_URL);

            // 1. Re-Verify Logic (Trusted Pricing)
            const balance = await getTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9));
            const lamports = Math.ceil(priceSol * LAMPORTS_PER_SOL);

            // 2. Identify Treasury
            if (!process.env.PLATFORM_TREASURY_WALLET) {
                console.warn("Using default testing treasury wallet. Please set PLATFORM_TREASURY_WALLET env.");
            }
            const treasuryPubkey = new PublicKey(process.env.PLATFORM_TREASURY_WALLET || TREASURY_WALLET);

            // 3. Create Mint Transaction
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                await nftService.initialize();
            }

            // Call the correct service method
            // Uses dynamic fee (lamports) calculated from USD price
            const { transaction: finalTxBase64, mint } = await nftService.createBusinessIdentityMintTransaction(
                businessProfile,
                walletAddress,
                treasuryPubkey.toString(),
                "verified", // Default to verified tier for this special mint
                lamports
            );

            res.json({
                success: true,
                transaction: finalTxBase64,
                message: `Mint Transaction Created. Price: $${priceUsd} (${priceSol} SOL)`,
                priceUsd,
                priceSol,
                mint
            });

        } catch (error: any) {
            console.error("Error creating mint transaction:", error);
            res.status(500).json({ success: false, message: "Failed to create mint transaction: " + error.message });
        }
    });

    /**
     * Admin: Mint Specific NFT (Reserved NFTs)
     * POST /api/special/admin-mint
     * Protected by ADMIN_SECRET_KEY
     */
    app.post("/api/special/admin-mint", async (req: Request, res: Response) => {
        try {
            const { adminKey, recipientAddress, nftId } = req.body;

            // Validate admin key
            const expectedKey = process.env.ADMIN_SECRET_KEY;
            if (!expectedKey || adminKey !== expectedKey) {
                return res.status(403).json({ success: false, message: "Unauthorized" });
            }

            if (!recipientAddress || !nftId) {
                return res.status(400).json({ success: false, message: "recipientAddress and nftId are required" });
            }

            // Import collection config
            const { NFT_COLLECTION } = await import("@shared/nft-collection");

            // Find the requested NFT
            const selectedNFT = NFT_COLLECTION.find(nft => nft.id === nftId);
            if (!selectedNFT) {
                return res.status(400).json({
                    success: false,
                    message: `NFT not found: ${nftId}. Available: ${NFT_COLLECTION.map(n => n.id).join(', ')}`
                });
            }

            console.log(`[ADMIN] Minting reserved ${selectedNFT.name} (${selectedNFT.rarity}) to ${recipientAddress}`);

            // Initialize NFT service
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                await nftService.initialize();
            }

            // Mint the specific NFT
            const result = await nftService.mintSpecificNFT(recipientAddress, selectedNFT);

            // Record to DB
            const { db } = await import("./db");
            const { specialNFTMints } = await import("@shared/invoice-schema");

            await db.insert(specialNFTMints).values({
                walletAddress: recipientAddress,
                nftId: selectedNFT.id,
                nftName: selectedNFT.name,
                nftRarity: selectedNFT.rarity,
                nftMint: result.mint,
                txSignature: result.signature,
                invoiceId: "admin-reserve",
            });

            res.json({
                success: true,
                message: `Minted ${selectedNFT.name} (${selectedNFT.rarity})`,
                mint: result.mint,
                signature: result.signature,
                nft: selectedNFT
            });

        } catch (error: any) {
            console.error("Admin mint error:", error);
            res.status(500).json({ success: false, message: error.message || "Failed to mint" });
        }
    });

    /**
     * Admin: Batch Mint All Reserved NFTs
     * POST /api/special/admin-batch-mint
     * Only works for authenticated admin wallet
     * Mints: 1 Common, 1 Uncommon, 3 Rare, 1 Epic = 6 total
     */
    app.post("/api/special/admin-batch-mint", async (req: Request, res: Response) => {
        try {
            // Admin endpoint is disabled if ADMIN_WALLET not set
            if (!ADMIN_WALLET) {
                return res.status(404).json({ success: false, message: "Not found" });
            }

            // Check session for admin wallet
            const sessionWallet = (req.session as any)?.walletAddress;

            if (!sessionWallet) {
                return res.status(401).json({
                    success: false,
                    message: "Not authenticated. Please connect your wallet first."
                });
            }

            if (sessionWallet !== ADMIN_WALLET) {
                // Don't reveal admin wallet info to non-admins
                return res.status(404).json({ success: false, message: "Not found" });
            }

            console.log(`[ADMIN] Batch minting 6 reserved NFTs to ${ADMIN_WALLET}`);

            // Import collection config
            const { NFT_COLLECTION } = await import("@shared/nft-collection");

            // Define reserved NFTs: 1 Common, 1 Uncommon, 3 Rare, 1 Epic
            const reservedNFTs = [
                NFT_COLLECTION.find(n => n.id === "invoix-exclusive"),  // Common
                NFT_COLLECTION.find(n => n.id === "king-cobra"),        // Uncommon
                NFT_COLLECTION.find(n => n.id === "invoix-koala"),      // Rare 1
                NFT_COLLECTION.find(n => n.id === "invoix-giraffe"),    // Rare 2
                NFT_COLLECTION.find(n => n.id === "invoix-koala"),      // Rare 3
                NFT_COLLECTION.find(n => n.id === "invoix-ant"),        // Epic
            ].filter(Boolean);

            if (reservedNFTs.length !== 6) {
                return res.status(500).json({ success: false, message: "Could not find all NFT variants" });
            }

            // Initialize NFT service
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                await nftService.initialize();
            }

            const results: any[] = [];

            // Mint each reserved NFT
            for (const nftVariant of reservedNFTs) {
                try {
                    console.log(`[ADMIN] Minting ${nftVariant!.name}...`);
                    const result = await nftService.mintSpecificNFT(ADMIN_WALLET, nftVariant as any);

                    // Record to DB
                    const { db } = await import("./db");
                    const { specialNFTMints } = await import("@shared/invoice-schema");

                    // Use a unique identifier to bypass the unique wallet constraint for admin
                    try {
                        await db.insert(specialNFTMints).values({
                            walletAddress: `${ADMIN_WALLET}-reserve-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            nftId: nftVariant!.id,
                            nftName: nftVariant!.name,
                            nftRarity: nftVariant!.rarity,
                            nftMint: result.mint,
                            txSignature: result.signature,
                            invoiceId: "admin-batch-reserve",
                        });
                    } catch (dbError) {
                        console.warn("DB insert warning:", dbError);
                    }

                    results.push({
                        success: true,
                        nft: nftVariant!.name,
                        rarity: nftVariant!.rarity,
                        mint: result.mint,
                        signature: result.signature
                    });

                    // Small delay between mints to avoid rate limiting
                    await new Promise(r => setTimeout(r, 1000));

                } catch (mintError: any) {
                    results.push({
                        success: false,
                        nft: nftVariant!.name,
                        error: mintError.message
                    });
                }
            }

            const successful = results.filter(r => r.success).length;

            res.json({
                success: successful === 6,
                message: `Minted ${successful}/6 reserved NFTs`,
                results
            });

        } catch (error: any) {
            console.error("Batch mint error:", error);
            res.status(500).json({ success: false, message: error.message || "Failed to batch mint" });
        }
    });
}
