import type { Express, Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "./db";
import { invoices, invoiceLineItems, specialNFTMints } from "@shared/invoice-schema";
import { getInvoiceNFTService } from "./nft-service";
import { z } from "zod";
import crypto from "crypto";
import { requireWalletOwnership, strictRateLimit } from "./security";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Configuration
const GATEKEEPER_TOKEN_MINT = process.env.GATEKEEPER_TOKEN_MINT || "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";
const DISCOUNTED_PRICE_USD = 0.50;
const STANDARD_PRICE_USD = 5.00;
const MAX_SUPPLY = 1000;

// FIX #11: Require treasury wallet env var
const TREASURY_WALLET = process.env.PLATFORM_TREASURY_WALLET;
if (!TREASURY_WALLET) {
    console.error("❌ PLATFORM_TREASURY_WALLET environment variable is required for community drops");
}

// Validation Schemas
const createInvoiceSchema = z.object({
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
        const fallbackPrice = parseFloat(process.env.SOL_PRICE_FALLBACK || "180");
        console.error(`Error fetching SOL price, using fallback $${solPriceCache?.price || fallbackPrice}`, error);
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

        // Sum up all token account balances
        let totalBalance = 0;
        for (const account of tokenAccounts.value) {
            const parsedInfo = account.account.data.parsed.info;
            totalBalance += parsedInfo.tokenAmount.uiAmount || 0;
        }

        return totalBalance;
    } catch (error) {
        console.error("Error getting custom token balance:", error);
        return 0;
    }
}

export function registerCommunityDropRoutes(app: Express) {

    /**
     * Create Invoice for Community NFT Drop
     * POST /api/community-drop/create-invoice
     * 
     * FIX #1: Added requireWalletOwnership to verify wallet ownership
     * FIX #6: Added strictRateLimit
     */
    app.post("/api/community-drop/create-invoice", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
        try {
            // FIX #11: Require treasury wallet
            if (!TREASURY_WALLET) {
                return res.status(503).json({
                    success: false,
                    message: "Community drops are temporarily unavailable. Please try again later."
                });
            }

            // FIX #1: Use authenticated wallet from session instead of user-supplied
            const authenticatedWallet = (req as any).authenticatedWallet;

            const connection = new Connection(SOLANA_RPC_URL);

            // 2. CHECK MAX SUPPLY
            const paidInvoices = await db.query.invoices.findMany({
                where: (invoices, { eq, and }) => and(
                    eq(invoices.description, "Exclusive Community NFT Mint"),
                    eq(invoices.status, "paid")
                )
            });

            const currentSupply = paidInvoices.length;
            if (currentSupply >= MAX_SUPPLY) {
                return res.status(400).json({ success: false, message: "Sold Out! The exclusive drop has reached its limit." });
            }

            // 3. Check Eligibility (Price) - FIX #9: Use correct token balance function
            const balance = await getCustomTokenBalance(connection, authenticatedWallet, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            // 4. Calculate SOL Amount (FIX #7: Uses cached price)
            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9));

            // 5. Create Invoice
            const invoiceId = crypto.randomUUID();
            const invoiceNumber = `NFT-${Date.now().toString().slice(-8)}`;

            await db.transaction(async (tx) => {
                await tx.insert(invoices).values({
                    id: invoiceId,
                    invoiceNumber: invoiceNumber,
                    invoicerWalletAddress: TREASURY_WALLET,
                    invoiceeWalletAddress: authenticatedWallet, // FIX #1: Use authenticated wallet
                    description: "Exclusive Community NFT Mint",
                    currency: "SOL",
                    tokenMint: "SOL",
                    tokenDecimals: 9,
                    subtotal: priceSol.toString(),
                    totalAmount: priceSol.toString(),
                    remainingAmount: priceSol.toString(),
                    status: "draft",
                    dueDate: new Date(),
                    isPrivate: false,
                    isArciumEncrypted: false,
                });

                await tx.insert(invoiceLineItems).values({
                    invoiceId: invoiceId,
                    lineNumber: 1,
                    description: isHolder ? "INVOIX Exclusive NFT (Community Member Price)" : "INVOIX Exclusive NFT (Standard Price)",
                    quantity: "1",
                    unitPrice: priceSol.toString(),
                    lineTotal: priceSol.toString()
                });
            });

            res.json({
                success: true,
                invoiceId,
                message: "Invoice created successfully",
                priceUsd,
                priceSol
            });

        } catch (error: any) {
            console.error("Error creating community drop invoice:", error);
            res.status(500).json({ success: false, message: "Failed to create invoice" });
        }
    });

    /**
     * Create Claim Transaction (Invoice Gated)
     * POST /api/community-drop/claim-transaction
     * 
     * FIX #2: Added invoice ownership verification
     * FIX #6: Added strictRateLimit
     */
    app.post("/api/community-drop/claim-transaction", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
        try {
            const { invoiceId } = req.body;
            const authenticatedWallet = (req as any).authenticatedWallet;

            if (!invoiceId) {
                return res.status(400).json({ success: false, message: "Missing invoiceId" });
            }

            // 1. Verify Invoice
            const invoice = await db.query.invoices.findFirst({
                where: (invoices, { eq, and }) => and(
                    eq(invoices.id, invoiceId),
                    eq(invoices.status, "paid"),
                    eq(invoices.description, "Exclusive Community NFT Mint")
                )
            });

            if (!invoice) {
                return res.status(400).json({ success: false, message: "Invoice not found or not paid." });
            }

            // FIX #2: Verify claimer is the invoice buyer
            if (invoice.invoiceeWalletAddress !== authenticatedWallet) {
                return res.status(403).json({
                    success: false,
                    message: "Only the invoice buyer can claim this NFT."
                });
            }

            // 2. Check if already claimed
            const existingMint = await db.query.specialNFTMints.findFirst({
                where: (mints, { eq }) => eq(mints.invoiceId, invoiceId)
            });

            if (existingMint) {
                return res.status(400).json({ success: false, message: "NFT already claimed for this invoice." });
            }

            // 3. Create Transaction
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) await nftService.initialize();

            const { transaction, mint, nftVariant } = await nftService.createClaimTransaction(authenticatedWallet);

            res.json({
                success: true,
                transaction,
                mint,
                nftVariant,
                message: "Claim Transaction Ready"
            });

        } catch (error: any) {
            console.error("Error creating claim transaction:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    /**
     * Confirm Claim (Save to DB)
     * POST /api/community-drop/confirm-claim
     * 
     * FIX #8: Verify transaction on-chain before recording
     */
    app.post("/api/community-drop/confirm-claim", requireWalletOwnership, strictRateLimit, async (req: Request, res: Response) => {
        try {
            const { invoiceId, mint, signature, nftVariant } = req.body;
            const authenticatedWallet = (req as any).authenticatedWallet;

            if (!invoiceId || !mint || !signature || !nftVariant) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: invoiceId, mint, signature, nftVariant"
                });
            }

            // FIX #8: Verify transaction on-chain
            const connection = new Connection(SOLANA_RPC_URL);

            // Wait a moment for transaction to propagate
            await new Promise(r => setTimeout(r, 2000));

            const tx = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx) {
                return res.status(400).json({
                    success: false,
                    message: "Transaction not found on chain. Please wait and try again."
                });
            }

            if (tx.meta?.err) {
                return res.status(400).json({
                    success: false,
                    message: "Transaction failed on chain."
                });
            }

            // Verify invoice ownership again
            const invoice = await db.query.invoices.findFirst({
                where: (invoices, { eq }) => eq(invoices.id, invoiceId)
            });

            if (!invoice || invoice.invoiceeWalletAddress !== authenticatedWallet) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized to confirm this claim."
                });
            }

            // Check if already claimed (prevent double-insert)
            const existingMint = await db.query.specialNFTMints.findFirst({
                where: (mints, { eq }) => eq(mints.invoiceId, invoiceId)
            });

            if (existingMint) {
                return res.status(400).json({
                    success: false,
                    message: "NFT already claimed for this invoice."
                });
            }

            // Record the claim
            await db.insert(specialNFTMints).values({
                walletAddress: authenticatedWallet, // Use authenticated wallet
                nftId: nftVariant.id,
                nftName: nftVariant.name,
                nftRarity: nftVariant.rarity,
                nftMint: mint,
                txSignature: signature,
                invoiceId: invoiceId,
            });

            res.json({ success: true, message: "NFT claim confirmed!" });
        } catch (error: any) {
            console.error("Error confirming claim:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
}
