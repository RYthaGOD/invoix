
import { Router } from "express";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { db } from "./db";
import { invoices } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getStablecoinConfig } from "@shared/stablecoin-config";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import { loadKeypairFromPrivateKey } from "./arcium-service"; // Reuse this helper
import { invoiceStorage } from "./invoice-storage";

import { strictRateLimit } from "./security";

const router = Router();

// Configuration
const GAS_FEE_USDC = 0.15; // 0.15 USDC Fee
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

/**
 * GET /api/config/fee-payer
 * Returns the protocol's fee payer public key and current fee configuration.
 */
router.get("/config/fee-payer", async (req, res) => {
    try {
        if (!process.env.PAYER_PRIVATE_KEY) {
            return res.status(503).json({ success: false, message: "Gasless payments not configured (Missing Key)" });
        }

        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);

        res.json({
            success: true,
            feePayer: payerKeypair.publicKey.toString(),
            feeAmount: GAS_FEE_USDC,
            treasuryAddress: TREASURY_WALLET_ADDRESS
        });
    } catch (error) {
        console.error("Error getting fee payer config:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * POST /api/payments/relay
 * Relays a gasless transaction. Signs as fee payer if validations pass.
 */
router.post("/payments/relay", strictRateLimit, async (req, res) => {
    try {
        const { transaction: txBase64, invoiceId } = req.body;

        if (!txBase64 || !invoiceId) {
            return res.status(400).json({ success: false, message: "Missing transaction or invoiceId" });
        }

        if (!process.env.PAYER_PRIVATE_KEY) {
            return res.status(503).json({ success: false, message: "Gasless payments not configured" });
        }

        // 1. Fetch Invoice
        const invoiceData = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
        if (!invoiceData.length) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }
        const invoice = invoiceData[0];

        if (invoice.status === 'paid' || invoice.status === 'void') {
            return res.status(400).json({ success: false, message: `Invoice is already ${invoice.status}` });
        }

        // 2. Decode Transaction
        const txBuffer = Buffer.from(txBase64, "base64");
        const transaction = Transaction.from(txBuffer);

        // 3. Validation: Check Fee Payer matches Protocol
        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
        if (!transaction.feePayer?.equals(payerKeypair.publicKey)) {
            return res.status(400).json({ success: false, message: "Transaction fee payer must be the protocol" });
        }

        // 4. Detect if this is a native SOL payment
        const isNativeSOL = invoice.currency === "SOL" ||
            invoice.tokenMint === "So11111111111111111111111111111111111111112";

        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);
        const sellerPubkey = new PublicKey(invoice.invoicerWalletAddress);

        // Amounts - use pre-calculated values from invoice, fallback for old invoices
        const invoiceTotal = parseFloat(invoice.remainingAmount);

        // NEW INVOICES: Use pre-calculated platformFee and subtotal
        // OLD INVOICES: Calculate 1% fee from total (backwards compatibility)
        const platformFee = invoice.platformFee ? parseFloat(invoice.platformFee) : invoiceTotal * 0.01;
        const sellerAmount = invoice.subtotal ? parseFloat(invoice.subtotal) : invoiceTotal - platformFee;

        let treasuryPaidAmount = BigInt(0);
        let sellerPaidAmount = BigInt(0);

        if (isNativeSOL) {
            // ==================== NATIVE SOL VALIDATION ====================
            const LAMPORTS_PER_SOL = 1_000_000_000;
            const requiredSellerLamports = BigInt(Math.floor(sellerAmount * LAMPORTS_PER_SOL));
            const requiredTreasuryLamports = BigInt(Math.floor(platformFee * LAMPORTS_PER_SOL));

            const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

            // Iterate over instructions to sum up SOL transfers
            for (const ix of transaction.instructions) {
                if (ix.programId.toString() === SYSTEM_PROGRAM_ID) {
                    // Check instruction type (Transfer is type 2)
                    if (ix.data.length >= 12 && ix.data.readUInt32LE(0) === 2) {
                        const lamports = ix.data.readBigUInt64LE(4);
                        const dest = ix.keys[1].pubkey;

                        if (dest.equals(treasuryPubkey)) {
                            treasuryPaidAmount += lamports;
                        } else if (dest.equals(sellerPubkey)) {
                            sellerPaidAmount += lamports;
                        }
                    }
                }
            }

            if (sellerPaidAmount < requiredSellerLamports) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient SOL to Seller. Expected ${sellerAmount.toFixed(6)} SOL. Got ${Number(sellerPaidAmount) / LAMPORTS_PER_SOL}`
                });
            }

            if (treasuryPaidAmount < requiredTreasuryLamports) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient SOL Platform Fee. Expected ${platformFee.toFixed(6)} SOL. Got ${Number(treasuryPaidAmount) / LAMPORTS_PER_SOL}`
                });
            }
        } else {
            // ==================== SPL TOKEN VALIDATION ====================
            const feeConfig = getStablecoinConfig(invoice.currency);
            if (!feeConfig) {
                return res.status(400).json({ success: false, message: "Unsupported currency for gasless payment" });
            }

            const treasuryAta = await getAssociatedTokenAddress(new PublicKey(feeConfig.mint), treasuryPubkey);
            const sellerAta = await getAssociatedTokenAddress(new PublicKey(feeConfig.mint), sellerPubkey);

            const gasFee = GAS_FEE_USDC; // 0.15
            const decimals = feeConfig.decimals;
            const toAtomic = (amount: number) => Math.floor(amount * Math.pow(10, decimals));

            const requiredTreasuryAmount = toAtomic(platformFee + gasFee);
            const requiredSellerAmount = toAtomic(sellerAmount);

            // Iterate over instructions to sum up transfers
            for (const ix of transaction.instructions) {
                if (ix.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
                    if (ix.keys.length >= 2) {
                        const dest = ix.keys[1].pubkey;
                        let amount = BigInt(0);

                        if (ix.data.length >= 9) {
                            try {
                                const type = ix.data[0];
                                if (type === 3 || type === 12) {
                                    amount = ix.data.subarray(1, 9).readBigUInt64LE(0);
                                }
                            } catch (e) { console.error("Parse error", e); }
                        }

                        if (dest.equals(treasuryAta)) {
                            treasuryPaidAmount += amount;
                        } else if (dest.equals(sellerAta)) {
                            sellerPaidAmount += amount;
                        }
                    }
                }
            }

            const requiredTreasuryBigInt = BigInt(requiredTreasuryAmount);
            const requiredSellerBigInt = BigInt(requiredSellerAmount);

            if (treasuryPaidAmount < requiredTreasuryBigInt) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Treasury Payment. Expected ${platformFee + gasFee} (1% + 0.15 Gas). Got ${Number(treasuryPaidAmount) / Math.pow(10, decimals)}`
                });
            }

            if (sellerPaidAmount < requiredSellerBigInt) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Seller Payment. Expected ${sellerAmount}. Got ${Number(sellerPaidAmount) / Math.pow(10, decimals)}`
                });
            }
        }

        // SECURITY CHECK: PREVENT PROTOCOL WALLET DRAIN
        // The Protocol Keypair can ONLY sign instructions if it is paying rent (CreateAccount).
        // It MUST NOT sign Transfers (System or Token) or other interactions.

        const protocolPubkeyStr = payerKeypair.publicKey.toString();
        const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
        const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

        for (const ix of transaction.instructions) {
            const progId = ix.programId.toString();

            for (const key of ix.keys) {
                if (key.pubkey.toString() === protocolPubkeyStr) {
                    // Protocol is an account in this instruction.
                    if (key.isSigner) {
                        // Protocol is SIGNING this instruction. This is dangerous.
                        // WHITELIST: Only allow specific safe operations.

                        let isAllowed = false;

                        // Allow: Associated Token Account Creation (Idempotent)
                        if (progId === ASSOCIATED_TOKEN_PROGRAM_ID) {
                            isAllowed = true;
                        }

                        // Allow: System Program Create Account (Rent Payment)
                        if (progId === SYSTEM_PROGRAM_ID) {
                            // Check instruction type. CreateAccount is index 0.
                            if (ix.data.length >= 4) {
                                const instructionType = ix.data.readUInt32LE(0);
                                if (instructionType === 0) { // CreateAccount means OK
                                    isAllowed = true;
                                }
                            }
                        }

                        if (!isAllowed) {
                            console.warn(`[SECURITY] Blocked malicious instruction signed by protocol: Program ${progId}`);
                            return res.status(403).json({
                                success: false,
                                message: "Security Alert: Protocol wallet unauthorized signature detected. Transaction rejected."
                            });
                        }
                    }
                }
            }
        }


        // 5. Sign and Send
        transaction.partialSign(payerKeypair);

        // Serialize and send
        const rawTransaction = transaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed"
        });

        // 6. Record Payment in Database (Pending)
        // We record it first. A background job or webhook should confirm it.
        // For now, we assume it will confirm if simulation passed.

        // Detect the actual payer (User)
        // The transaction comes with the User's signature. 
        // The Fee Payer (Protocol) is added at index 0 or via partialSign later, but we can look for the other signer.
        let userPayer = transaction.feePayer?.toString();

        // Iterate signatures to find the one that is NOT the fee payer (Protocol)
        // The client signed it, so it must be in the signatures list
        for (const sigPair of transaction.signatures) {
            if (!sigPair.publicKey.equals(payerKeypair.publicKey) && sigPair.signature !== null) {
                userPayer = sigPair.publicKey.toString();
                break;
            }
        }

        // CRITICAL: Always record payment in database after successful relay
        // Previously this was gated behind MINT_RECEIPT_NFTS which caused payments to go unrecorded
        // CRITICAL: Always record payment in database after successful relay
        // Previously this was gated behind MINT_RECEIPT_NFTS which caused payments to go unrecorded
        if (invoiceId) {
            // IMMEDIATE: Update invoice status to 'paid' so client polling succeeds
            // This prevents timeout while waiting for async confirmation
            try {
                const paymentData = {
                    invoiceId: invoiceId,
                    amount: invoice.remainingAmount,
                    currency: invoice.currency,
                    txSignature: signature,
                    fromAddress: userPayer || "unknown",
                    toAddress: invoice.invoicerWalletAddress,
                    status: "confirmed",
                    confirmedAt: new Date(),
                };
                await invoiceStorage.createPayment(paymentData as any);
                console.log(`✅ [PAYMENT] Recorded payment ${signature} for invoice ${invoiceId}`);
            } catch (paymentErr: any) {
                console.error(`[PAYMENT] ERROR recording payment:`, paymentErr.message || paymentErr);
            }

            // ASYNC: Mint NFT receipt in background (non-blocking)
            import("./payment-confirmation-service").then(service => {
                service.confirmPaymentAndMintOutcome(signature, invoiceId, userPayer || "unknown");
            }).catch(err => console.error("Failed to start NFT minting:", err));
        }

        // 6. Return Signature
        console.log(`✅ [RELAY] Transaction sent: ${signature}`);
        res.json({ success: true, signature });

    } catch (error: any) {
        console.error("Payment relay error:", error);
        res.status(500).json({ success: false, message: error.message || "Relay processing failed" });
    }
});

export const paymentRouter = router;
