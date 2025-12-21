
import type { Express } from "express";
import { PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { invoiceStorage } from "./invoice-storage";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import bs58 from "bs58";

/**
 * Register Solana Pay standard routes
 * Implements the "Transaction Request" standard for mobile wallet payments
 */
export function registerSolanaPayRoutes(app: Express) {

    const BASE_URL = process.env.API_URL || "https://invoix.railway.app";

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
                // Some wallets might display this error nicely
                return res.status(400).json({ error: "Invoice already paid" });
            }

            res.status(200).json({
                label: `Invoix #${invoice.invoiceNumber}`,
                icon: `${BASE_URL}/logo.png`,
                description: `Payment for ${invoice.currency} Invoice #${invoice.invoiceNumber}`,
            });

        } catch (error: any) {
            console.error("Solana Pay GET Error:", error);
            res.status(500).json({ error: error.message });
        }
    });


    /**
     * POST /api/solana-pay/:id
     * Wallet POSTs account info here to get the built transaction
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

            // Load Server Keypair (Fee Payer)
            const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
            if (!payerPrivateKey) throw new Error("Server fee payer not configured");

            let payerKeypair: Keypair;
            if (payerPrivateKey.includes("[")) {
                payerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(payerPrivateKey)));
            } else {
                payerKeypair = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));
            }

            const userPubkey = new PublicKey(account);
            const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

            // --- 1. Calculate Amounts ---
            const amountToPay = parseFloat(invoice.remainingAmount);
            const feeRate = 0.01; // 1% Platform Fee
            const feeAmount = amountToPay * feeRate;
            const recipientAmount = amountToPay - feeAmount;

            const isNativeSOL = invoice.currency === "SOL";
            const decimals = isNativeSOL ? 9 : invoice.tokenDecimals;

            const feeLamports = Math.floor(feeAmount * Math.pow(10, decimals));
            const recipientLamports = Math.floor(recipientAmount * Math.pow(10, decimals));

            // --- 2. Build Transaction ---
            const transaction = new Transaction();
            const recipientPubkey = new PublicKey(invoice.invoicerWalletAddress);
            const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

            if (isNativeSOL) {
                // SOL Transfer Logic
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

                // Check if ATAs exist
                const recipientInfo = await connection.getAccountInfo(recipientTokenAccount);
                if (!recipientInfo) {
                    console.log("Creating Recipient ATA (Paid by Server)");
                    transaction.add(createAssociatedTokenAccountInstruction(
                        payerKeypair.publicKey, // Server Pays Rent
                        recipientTokenAccount,
                        recipientPubkey,
                        mintPubkey
                    ));
                }

                const treasuryInfo = await connection.getAccountInfo(treasuryTokenAccount);
                if (!treasuryInfo) {
                    console.log("Creating Treasury ATA (Paid by Server)");
                    transaction.add(createAssociatedTokenAccountInstruction(
                        payerKeypair.publicKey, // Server Pays Rent
                        treasuryTokenAccount,
                        treasuryPubkey,
                        mintPubkey
                    ));
                }

                transaction.add(createTransferInstruction(senderTokenAccount, recipientTokenAccount, userPubkey, recipientLamports));
                transaction.add(createTransferInstruction(senderTokenAccount, treasuryTokenAccount, userPubkey, feeLamports));
            }

            // --- 3. Finalize & Sign ---
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.feePayer = payerKeypair.publicKey; // Server Pays Gas

            // Partial Sign by Server
            transaction.partialSign(payerKeypair);

            // Serialize
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false, // User signature missing
                verifySignatures: false
            });

            const base64Transaction = serializedTransaction.toString("base64");

            res.status(200).json({
                transaction: base64Transaction,
                message: `Pay ${invoice.currency} Invoice #${invoice.invoiceNumber}`,
            });

        } catch (error: any) {
            console.error("Solana Pay POST Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
}
