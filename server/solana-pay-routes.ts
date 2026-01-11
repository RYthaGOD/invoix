
import type { Express } from "express";
import { PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { invoiceStorage } from "./invoice-storage";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { logger } from "./logger";
import { getStablecoinConfig } from "@shared/stablecoin-config";

/**
 * Register Solana Pay Transaction Request Routes
 * 
 * SECURITY FIX: User pays their own gas, no server signing required.
 * The server only builds the transaction, user signs and broadcasts.
 */
export function registerSolanaPayRoutes(app: Express) {
    const BASE_URL = process.env.API_URL || process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "https://invoix.railway.app";

    logger.info("Solana Pay Transaction Request routes enabled (Secure Mode)", "solana-pay");

    /**
     * GET /api/solana-pay/:id
     * Wallet fetches this to display Label/Icon before payment
     */
    app.get("/api/solana-pay/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const invoice = await invoiceStorage.getInvoice(id);

            if (!invoice) {
                return res.status(404).json({ error: "Invoice not found" });
            }

            if (invoice.status === 'paid') {
                return res.status(400).json({ error: "Invoice already paid" });
            }

            // Return Solana Pay compliant response
            res.status(200).json({
                label: `Invoix Payment`,
                icon: `${BASE_URL}/logo.png`,
            });

        } catch (error: any) {
            logger.error("Solana Pay GET Error", "solana-pay", { error: error.message || error });
            res.status(500).json({ error: error.message });
        }
    });


    /**
     * POST /api/solana-pay/:id
     * Wallet POSTs account info here to get the built transaction
     * 
     * SECURITY: Transaction is built but NOT signed by server.
     * User pays their own gas fees.
     */
    app.post("/api/solana-pay/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { account } = req.body; // User's public key (from Wallet)

            if (!account) {
                return res.status(400).json({ error: "Missing 'account' field" });
            }

            const invoice = await invoiceStorage.getInvoice(id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });

            if (invoice.status === 'paid') {
                return res.status(400).json({ error: "Invoice already paid" });
            }

            // --- SECURITY FIX: Payer Authorization ---
            if (account !== invoice.invoiceeWalletAddress) {
                logger.warn("Unauthorized Solana Pay attempt", "solana-pay", {
                    invoiceId: id,
                    attemptedBy: account,
                    authorizedPayer: invoice.invoiceeWalletAddress
                });
                return res.status(403).json({
                    error: "Unauthorized: Only the designated recipient can pay this invoice",
                });
            }

            const userPubkey = new PublicKey(account);
            const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

            // --- 1. Calculate Amounts ---
            const amountToPay = parseFloat(invoice.remainingAmount);
            const feeRate = 0.01; // 1% Platform Fee
            const feeAmount = amountToPay * feeRate;
            const recipientAmount = amountToPay - feeAmount;

            const isNativeSOL = invoice.currency === "SOL";
            const decimals = isNativeSOL ? 9 : (invoice.tokenDecimals || 6);

            const feeLamports = Math.floor(feeAmount * Math.pow(10, decimals));
            const recipientLamports = Math.floor(recipientAmount * Math.pow(10, decimals));

            // --- 2. Build Transaction ---
            const transaction = new Transaction();
            // --- SECURITY FIX: Dynamic Payee Routing (Marketplace Support) ---
            const recipientPubkey = new PublicKey(invoice.nftTransferredTo || invoice.invoicerWalletAddress);
            const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

            if (isNativeSOL) {
                // SOL Transfer Logic - USER PAYS GAS
                if (recipientLamports > 0) {
                    transaction.add(SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: recipientPubkey,
                        lamports: recipientLamports,
                    }));
                }
                if (feeLamports > 0) {
                    transaction.add(SystemProgram.transfer({
                        fromPubkey: userPubkey,
                        toPubkey: treasuryPubkey,
                        lamports: feeLamports
                    }));
                }
            } else {
                // SPL Token Logic
                if (!invoice.tokenMint) throw new Error("Token Mint missing");
                const mintPubkey = new PublicKey(invoice.tokenMint);

                const senderTokenAccount = await getAssociatedTokenAddress(mintPubkey, userPubkey);
                const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
                const treasuryTokenAccount = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);

                // Check if ATAs exist - USER pays for creation if needed
                const recipientInfo = await connection.getAccountInfo(recipientTokenAccount);
                if (!recipientInfo) {
                    logger.info("Creating Recipient ATA (User Pays)", "solana-pay");
                    transaction.add(createAssociatedTokenAccountInstruction(
                        userPubkey, // USER Pays Rent
                        recipientTokenAccount,
                        recipientPubkey,
                        mintPubkey
                    ));
                }

                const treasuryInfo = await connection.getAccountInfo(treasuryTokenAccount);
                if (!treasuryInfo) {
                    logger.info("Creating Treasury ATA (User Pays)", "solana-pay");
                    transaction.add(createAssociatedTokenAccountInstruction(
                        userPubkey, // USER Pays Rent
                        treasuryTokenAccount,
                        treasuryPubkey,
                        mintPubkey
                    ));
                }

                // Transfers
                if (recipientLamports > 0) {
                    transaction.add(createTransferInstruction(
                        senderTokenAccount,
                        recipientTokenAccount,
                        userPubkey,
                        recipientLamports
                    ));
                }
                if (feeLamports > 0) {
                    transaction.add(createTransferInstruction(
                        senderTokenAccount,
                        treasuryTokenAccount,
                        userPubkey,
                        feeLamports
                    ));
                }
            }

            // --- 3. Finalize (USER is fee payer) ---
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userPubkey; // USER pays gas

            // Serialize (no server signature needed)
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            const base64Transaction = serializedTransaction.toString("base64");

            logger.info("Solana Pay transaction built", "solana-pay", {
                invoiceId: id,
                userWallet: account.slice(0, 8) + "...",
                amount: amountToPay,
                currency: invoice.currency
            });

            res.status(200).json({
                transaction: base64Transaction,
                message: `Pay ${amountToPay} ${invoice.currency} for Invoice #${invoice.invoiceNumber}`,
            });

        } catch (error: any) {
            logger.error("Solana Pay POST Error", "solana-pay", { error: error.message || error });
            res.status(500).json({ error: error.message });
        }
    });
}
