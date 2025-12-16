
import type { Express, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { getTokenBalance } from "./stablecoin-payment-service";
import { db } from "./db";
import { invoices, invoiceLineItems } from "@shared/invoice-schema";
import { z } from "zod";
import crypto from "crypto";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Configuration
const GATEKEEPER_TOKEN_MINT = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";
const DISCOUNTED_PRICE_USD = 0.50;
const STANDARD_PRICE_USD = 5.00;
const TREASURY_WALLET = process.env.PLATFORM_TREASURY_WALLET || "H8sMJqjq9yRa9qKz7BwFvbKkYj3ZzV8zL8zZ8zL8zZ8z";
const MAX_SUPPLY = 1000;

// Validation Schemas
const createInvoiceSchema = z.object({
    walletAddress: z.string().min(1, "Wallet Address is required"),
});

/**
 * Fetch current SOL Price in USD
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

export function registerCommunityDropRoutes(app: Express) {

    /**
     * Create Invoice for Community NFT Drop
     * POST /api/community-drop/create-invoice
     */
    app.post("/api/community-drop/create-invoice", async (req: Request, res: Response) => {
        try {
            // 1. Validate Input
            const parsed = createInvoiceSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            }
            const { walletAddress } = parsed.data;
            const connection = new Connection(SOLANA_RPC_URL);

            // 2. CHECK MAX SUPPLY
            // Count invoices with description "Exclusive Community NFT Mint" that are PAID.
            // Or roughly use "all non-cancelled invoices" to prevent over-invoicing?
            // Safer to check PAID count.
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

            // 3. Check Eligibility (Price)
            const balance = await getTokenBalance(connection, walletAddress, GATEKEEPER_TOKEN_MINT);
            const isHolder = balance > 0;
            const priceUsd = isHolder ? DISCOUNTED_PRICE_USD : STANDARD_PRICE_USD;

            // 4. Calculate SOL Amount
            const solPrice = await getSolPrice();
            const priceSol = Number((priceUsd / solPrice).toFixed(9)); // 9 decimals for SOL

            // 5. Create Invoice
            const invoiceId = crypto.randomUUID();
            const invoiceNumber = `NFT-${Date.now().toString().slice(-8)}`;

            // Determine Treasury (Invoicer) - Using a fixed or env wallet
            const invoicerAddress = process.env.PLATFORM_TREASURY_WALLET || TREASURY_WALLET;

            await db.transaction(async (tx) => {
                // Create Invoice Record
                await tx.insert(invoices).values({
                    id: invoiceId,
                    invoiceNumber: invoiceNumber,
                    invoicerWalletAddress: invoicerAddress,
                    invoiceeWalletAddress: walletAddress,
                    description: "Exclusive Community NFT Mint",
                    currency: "SOL",
                    tokenMint: "SOL", // Native SOL
                    tokenDecimals: 9,
                    subtotal: priceSol.toString(),
                    totalAmount: priceSol.toString(),
                    remainingAmount: priceSol.toString(),
                    status: "draft", // Will be "sent" immediately effectively
                    dueDate: new Date(), // Due now
                    isPrivate: false,
                    isArciumEncrypted: false,
                });

                // Create Line Item
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
}
