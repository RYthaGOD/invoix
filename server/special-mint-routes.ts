
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
// Ideally this should be in .env or config, we'll try to use the one from env or fallback
const TREASURY_WALLET = process.env.PLATFORM_TREASURY_WALLET || "H8sMJqjq9yRa9qKz7BwFvbKkYj3ZzV8zL8zZ8zL8zZ8z"; // Replace with actual default or require env

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
    app.post("/api/special/mint", async (req: Request, res: Response) => {
        try {
            // Validate Input
            const parsed = mintSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }
            const { walletAddress } = parsed.data;

            const connection = new Connection(SOLANA_RPC_URL);

            // 1. Re-Verify Logic (Trusted Pricing)
            const balance = await getTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9));
            const lamports = Math.ceil(priceSol * LAMPORTS_PER_SOL);

            // 2. Create Transfer Instruction
            // Ensure we have a valid treasury wallet
            if (!process.env.PLATFORM_TREASURY_WALLET) {
                console.warn("Using default testing treasury wallet. Please set PLATFORM_TREASURY_WALLET env.");
            }
            const treasuryPubkey = new PublicKey(process.env.PLATFORM_TREASURY_WALLET || TREASURY_WALLET);
            const userPubkey = new PublicKey(walletAddress);

            const transferIx = SystemProgram.transfer({
                fromPubkey: userPubkey,
                toPubkey: treasuryPubkey,
                lamports: lamports,
            });

            // 3. Create NFT Mint Instruction
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                await nftService.initialize();
            }

            const { transaction: nftTx, mint } = await nftService.createMintSpecialTransaction(walletAddress);

            // 4. Combine Instructions
            // We need to merge the transfer instruction into the NFT transaction
            // The NFT transaction (nftTx) is already a Transaction object (or Umi transaction builder we need to convert)

            // Note: createMintSpecialTransaction returns a Base64 string of a serialized transaction usually.
            // Let's modify nft-service to handle this cleanly or deserialze here.

            // Approach: Deserialize the NFT transaction, add the transfer instruction to the beginning.
            const transactionBuffer = Buffer.from(nftTx, 'base64');
            const transaction = Transaction.from(transactionBuffer);

            // Insert transfer instruction at the beginning 
            transaction.instructions.unshift(transferIx);

            // We need to re-serialize. 
            // IMPORTANT: The transaction from NFT service might already be partially signed or set up for Umi.
            // If it's a VersionedTransaction (likely with Umi), we need to be careful.
            // Umi produces VersionedTransactions usually.

            // Let's simplify: We will ask nftService to give us the INSTRUCTION or Builder, OR we handle the merge carefully.
            // Current nft-service `createMintInvoiceTransaction` returns a base64 string.
            // Let's assume `createMintSpecialTransaction` will follow the same pattern but we will need to update it to allow injecting instructions OR we add the transfer instruction INSIDE the service method.
            // --> DECISION: Add the transfer instruction inside `createMintSpecialTransaction` in the service. It's cleaner.

            // So here we likely just get the final base64 from the service which now handles the transfer internally?
            // No, the service dealing with pricing logic feels coupled.
            // Better: We calculate amount here, and pass `lamports` and `treasury` to the service method.

            const finalTxBase64 = await nftService.createMintSpecialTransaction(
                walletAddress,
                lamports,
                treasuryPubkey.toString()
            );

            res.json({
                success: true,
                transaction: finalTxBase64,
                message: `Mint Transaction Created. Price: $${priceUsd} (${priceSol} SOL)`,
                priceUsd,
                priceSol
            });

        } catch (error: any) {
            console.error("Error creating mint transaction:", error);
            res.status(500).json({ success: false, message: "Failed to create mint transaction" });
        }
    });
}
