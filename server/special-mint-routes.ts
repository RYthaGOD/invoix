
import type { Express, Request, Response } from "express";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getInvoiceNFTService } from "./nft-service";
import { z } from "zod";
import { strictRateLimit, requireWalletOwnership } from "./security";
import { logger } from "./logger";

// Session type is extended in auth-routes.ts


const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Configuration
const GATEKEEPER_TOKEN_MINT = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";
const DISCOUNTED_PRICE_USD = 0.50;
const STANDARD_PRICE_USD = 5.00;

// FIX #11: Require treasury wallet
const TREASURY_WALLET = process.env.PLATFORM_TREASURY_WALLET;
if (!TREASURY_WALLET) {
    logger.error("PLATFORM_TREASURY_WALLET environment variable is required for special mints", "special-mint");
}

// Admin wallet for reserved NFT minting (set in .env for privacy)
const ADMIN_WALLET = process.env.ADMIN_WALLET;

// Validation Schemas
const quoteSchema = z.object({
    walletAddress: z.string().min(1, "Wallet Address is required"),
});

const mintSchema = z.object({
    walletAddress: z.string().min(1, "Wallet Address is required"),
});

// FIX #7: Cache SOL price to avoid CoinGecko rate limits
let solPriceCache: { price: number; timestamp: number } | null = null;
const SOL_PRICE_CACHE_TTL = 60000; // 1 minute

/**
 * Fetch current SOL Price in USD with caching
 */
async function getSolPrice(): Promise<number> {
    // Return cached price if still valid
    if (solPriceCache && Date.now() - solPriceCache.timestamp < SOL_PRICE_CACHE_TTL) {
        return solPriceCache.price;
    }

    try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = await response.json();
        const price = data.solana.usd;

        // Update cache
        solPriceCache = { price, timestamp: Date.now() };

        return price;
    } catch (error) {
        // Use cached value, then env fallback, then conservative $100 default
        const fallbackPrice = parseFloat(process.env.SOL_PRICE_FALLBACK || "100");
        logger.error("Error fetching SOL price, using fallback", "special-mint", { error, fallback: solPriceCache?.price || fallbackPrice });
        return solPriceCache?.price || fallbackPrice;
    }
}

// FIX #9: Custom function to get token balance for arbitrary mints
async function getCustomTokenBalance(
    connection: Connection,
    walletAddress: string,
    mintAddress: string
): Promise<number> {
    try {
        const walletPubkey = new PublicKey(walletAddress);
        const mintPubkey = new PublicKey(mintAddress);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPubkey,
            { mint: mintPubkey }
        );

        if (tokenAccounts.value.length === 0) {
            return 0;
        }

        let totalBalance = 0;
        for (const account of tokenAccounts.value) {
            const parsedInfo = (account.account.data as any).parsed.info; // Cast as any because parsed type is standard json
            totalBalance += parsedInfo.tokenAmount.uiAmount || 0;
        }

        return totalBalance;
    } catch (error) {
        logger.error("Error getting custom token balance", "special-mint", { error });
        return 0;
    }
}

export function registerSpecialMintRoutes(app: Express) {

    /**
     * Get Pricing Quote
     * Checks token balance and returns the applicable price in USD and SOL
     * POST /api/special/quote
     */
    // FIX #6: Added rate limiting
    app.post("/api/special/quote", strictRateLimit, async (req: Request, res: Response) => {
        try {
            // Validate Input
            const parsed = quoteSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }
            const { walletAddress } = parsed.data;

            const connection = new Connection(SOLANA_RPC_URL);

            // Check Balance
            // FIX #9: Use correct token balance function
            const balance = await getCustomTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
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
            logger.error("Error generating quote", "special-mint", { error });
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
    // FIX #6: Added rate limiting and wallet ownership
    app.post("/api/special/mint", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
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

            const profiles = await db.select().from(businessProfiles).where(eq(businessProfiles.ownerWalletAddress, walletAddress));
            if (profiles.length === 0) {
                return res.status(404).json({ success: false, message: "No business profile found. Please create one first." });
            }
            const businessProfile = profiles[0];

            const connection = new Connection(SOLANA_RPC_URL);

            // 1. Re-Verify Logic (Trusted Pricing)
            // FIX #9: Use correct token balance function
            const balance = await getCustomTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9));
            const lamports = Math.ceil(priceSol * LAMPORTS_PER_SOL);

            // FIX #11: Require treasury wallet
            if (!TREASURY_WALLET) {
                return res.status(503).json({
                    success: false,
                    message: "Special mints are temporarily unavailable."
                });
            }
            const treasuryPubkey = new PublicKey(TREASURY_WALLET);

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
                message: `Mint Transaction Created.Price: $${priceUsd} (${priceSol} SOL)`,
                priceUsd,
                priceSol,
                mint
            });

        } catch (error: any) {
            logger.error("Error creating mint transaction", "special-mint", { error });
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
                    message: `NFT not found: ${nftId}.Available: ${NFT_COLLECTION.map(n => n.id).join(', ')} `
                });
            }

            logger.info(`Admin minting reserved ${selectedNFT.name} (${selectedNFT.rarity}) to ${recipientAddress}`, "special-mint");

            // Initialize NFT service

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
            logger.error("Admin mint error", "special-mint", { error });
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

            logger.info("Admin batch minting 6 reserved NFTs", "special-mint", { adminWallet: ADMIN_WALLET });

            // Import collection config

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
                    logger.info(`Minting ${nftVariant!.name}...`, "special-mint");
                    const result = await nftService.mintSpecificNFT(ADMIN_WALLET, nftVariant as any);

                    // Record to DB
                    const { db } = await import("./db");
                    const { specialNFTMints } = await import("@shared/invoice-schema");

                    // Use a unique identifier to bypass the unique wallet constraint for admin
                    try {
                        await db.insert(specialNFTMints).values({
                            walletAddress: `${ADMIN_WALLET} -reserve - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
                            nftId: nftVariant!.id,
                            nftName: nftVariant!.name,
                            nftRarity: nftVariant!.rarity,
                            nftMint: result.mint,
                            txSignature: result.signature,
                            invoiceId: "admin-batch-reserve",
                        });
                    } catch (dbError) {
                        logger.warn("DB insert warning", "special-mint", { error: dbError });
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
            logger.error("Batch mint error", "special-mint", { error });
            res.status(500).json({ success: false, message: error.message || "Failed to batch mint" });
        }
    });
}
