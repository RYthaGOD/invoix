
import { Router } from "express";
import { Connection, Keypair, Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
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
import { logger } from "./logger";

const router = Router();

// Configuration
import { getSolanaConnection } from "./solana-sdk"; // Use shared connection
const GAS_FEE_USDC = parseFloat(process.env.GAS_FEE_USDC || "0.15"); // Default: 0.15 USDC
const connection = getSolanaConnection();

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
        const err = error as any;
        logger.error("Error getting fee payer config", "payment", { error: err.message || err });
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

        // 2. Decode Transaction (Support Legacy & Versioned)
        const txBuffer = Buffer.from(txBase64, "base64");
        let transaction: Transaction | VersionedTransaction;
        let isVersioned = false;

        try {
            // Attempt Versioned first (modern standard)
            transaction = VersionedTransaction.deserialize(txBuffer);
            isVersioned = true;
        } catch (e) {
            try {
                // Fallback to Legacy
                transaction = Transaction.from(txBuffer);
                isVersioned = false;
            } catch (legacyErr) {
                return res.status(400).json({ success: false, message: "Invalid transaction format" });
            }
        }

        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
        const protocolPubkeyStr = payerKeypair.publicKey.toString();

        // 3. Validation: Check Fee Payer
        let txFeePayer: PublicKey | null | undefined;

        if (isVersioned) {
            const vTx = transaction as VersionedTransaction;
            // In V0, fee payer is the first static account key
            txFeePayer = vTx.message.staticAccountKeys[0];
        } else {
            const lTx = transaction as Transaction;
            txFeePayer = lTx.feePayer;
        }

        if (!txFeePayer || !txFeePayer.equals(payerKeypair.publicKey)) {
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
            if (isVersioned) {
                const vTx = transaction as VersionedTransaction;
                const accountKeys = vTx.message.staticAccountKeys;
                for (const ix of vTx.message.compiledInstructions) {
                    const progId = accountKeys[ix.programIdIndex].toString();
                    if (progId === SYSTEM_PROGRAM_ID) {
                        // System Program instruction data for Transfer (type 2)
                        const instructionData = Buffer.from(ix.data);
                        if (instructionData.length >= 12 && instructionData.readUInt32LE(0) === 2) {
                            const lamports = instructionData.readBigUInt64LE(4);
                            const dest = accountKeys[ix.accountKeyIndexes[1]]; // Destination is the second account in System Transfer

                            if (dest.equals(treasuryPubkey)) {
                                treasuryPaidAmount += lamports;
                            } else if (dest.equals(sellerPubkey)) {
                                sellerPaidAmount += lamports;
                            }
                        }
                    }
                }
            } else {
                const lTx = transaction as Transaction;
                for (const ix of lTx.instructions) {
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
            const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

            if (isVersioned) {
                const vTx = transaction as VersionedTransaction;
                const accountKeys = vTx.message.staticAccountKeys;
                for (const ix of vTx.message.compiledInstructions) {
                    const progId = accountKeys[ix.programIdIndex].toString();
                    if (progId === TOKEN_PROGRAM_ID) {
                        const instructionData = Buffer.from(ix.data);
                        if (instructionData.length >= 9) {
                            try {
                                const type = instructionData[0];
                                if (type === 3 || type === 12) { // Transfer or TransferChecked
                                    const amount = instructionData.subarray(1, 9).readBigUInt64LE(0);
                                    const dest = accountKeys[ix.accountKeyIndexes[1]]; // Destination is the second account in Token Transfer

                                    if (dest.equals(treasuryAta)) {
                                        treasuryPaidAmount += amount;
                                    } else if (dest.equals(sellerAta)) {
                                        sellerPaidAmount += amount;
                                    }
                                }
                            } catch (e) { console.error("Parse error", e); }
                        }
                    }
                }
            } else {
                const lTx = transaction as Transaction;
                for (const ix of lTx.instructions) {
                    if (ix.programId.toString() === TOKEN_PROGRAM_ID) {
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

        // 4. Security Check: Prevent Protocol Wallet Drain
        const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
        const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

        // Helper to check if protocol is signing a dangerous instruction
        const isDangerous = (programId: string, instructionData: Buffer) => {
            // Safe: ATA Creation
            if (programId === ASSOCIATED_TOKEN_PROGRAM_ID) return false;

            // Safe: System CreateAccount (Rent)
            if (programId === SYSTEM_PROGRAM_ID) {
                if (instructionData.length >= 4 && instructionData.readUInt32LE(0) === 0) return false;
            }
            return true; // Everything else (Transfer, etc) is dangerous if Protocol Signs
        };

        if (isVersioned) {
            // --- VERSIONED TRANSACTION SECURITY ---
            const vTx = transaction as VersionedTransaction;
            const accountKeys = vTx.message.staticAccountKeys;

            // Find protocol index in static keys (it should be 0, but check)
            const protocolIndex = accountKeys.findIndex(k => k.equals(payerKeypair.publicKey));

            if (protocolIndex !== -1) {
                // Iterate compiled instructions
                for (const ix of vTx.message.compiledInstructions) {
                    const progId = accountKeys[ix.programIdIndex].toString();

                    // Check if protocol is a signer in this instruction
                    // In V0 message, header defines signer counts.
                    // The first `numRequiredSignatures` accounts in staticAccountKeys are signers.
                    const isProtocolSigner = protocolIndex < vTx.message.header.numRequiredSignatures;

                    // We care if the protocol is USED in this instruction AND is a signer.
                    if (ix.accountKeyIndexes.includes(protocolIndex) && isProtocolSigner) {
                        // Protocol is involved and is a signer. Check if dangerous.
                        // Getting instruction data: ix.data is Uint8Array
                        if (isDangerous(progId, Buffer.from(ix.data))) {
                            logger.error("Blocked Versioned Instruction", "security", { program: progId });
                            return res.status(403).json({ success: false, message: "Security Alert: Unauthorized protocol signature." });
                        }
                    }
                }
            }

        } else {
            // --- LEGACY TRANSACTION SECURITY ---
            const lTx = transaction as Transaction;
            for (const ix of lTx.instructions) {
                // Check if protocol is a signer in this instruction
                const protocolSigner = ix.keys.find(k => k.pubkey.equals(payerKeypair.publicKey) && k.isSigner);
                if (protocolSigner) {
                    if (isDangerous(ix.programId.toString(), ix.data)) {
                        logger.error("Blocked Legacy Instruction", "security", { program: ix.programId.toString() });
                        return res.status(403).json({ success: false, message: "Security Alert: Unauthorized protocol signature." });
                    }
                }
            }
        }

        // 5. Sign and Send
        try {
            let signature: string;
            let rawTransaction: Buffer | Uint8Array;

            if (isVersioned) {
                const vTx = transaction as VersionedTransaction;
                vTx.sign([payerKeypair]);
                rawTransaction = vTx.serialize();
            } else {
                const lTx = transaction as Transaction;
                lTx.partialSign(payerKeypair);
                rawTransaction = lTx.serialize({ requireAllSignatures: false });
            }

            signature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });

            logger.info("Relay transaction sent", "payment", { signature, invoiceId, isVersioned });

            // 6. Record Payment (Immediate)
            if (invoiceId) {
                let userPayer = "unknown";
                try {
                    // Try to find user payer for record
                    if (isVersioned) {
                        const vTx = transaction as VersionedTransaction;
                        // The user is likely the 2nd signer (index 1) if fee payer is 0
                        if (vTx.message.header.numRequiredSignatures > 1) {
                            userPayer = vTx.message.staticAccountKeys[1].toString();
                        }
                    } else {
                        const lTx = transaction as Transaction;
                        // First signer that isn't protocol
                        // ... logic to find other signer ...
                        if (lTx.signatures) {
                            for (const sig of lTx.signatures) {
                                if (sig.publicKey && !sig.publicKey.equals(payerKeypair.publicKey)) {
                                    userPayer = sig.publicKey.toString();
                                    break;
                                }
                            }
                        }
                    }

                    const paymentData = {
                        invoiceId: invoiceId,
                        amount: invoice.remainingAmount,
                        currency: invoice.currency,
                        txSignature: signature,
                        fromAddress: userPayer,
                        toAddress: invoice.invoicerWalletAddress,
                        status: "confirmed",
                        confirmedAt: new Date(),
                    };
                    await invoiceStorage.createPayment(paymentData as any);
                    logger.info("Payment recorded locally", "payment", { signature, invoiceId });

                    // --- CREDIT SCORE UPDATE ---
                    // Update credit scores for payer and payee (non-blocking)
                    try {
                        const { creditScoringService } = await import("./credit-scoring-service");
                        creditScoringService.updateScoreOnPayment({
                            fromAddress: userPayer,
                            toAddress: invoice.invoicerWalletAddress,
                            amount: invoice.remainingAmount,
                            invoiceDueDate: new Date(invoice.dueDate),
                            paidAt: new Date(),
                        }).catch(err => logger.warn("Credit score update failed", "credit", { error: err.message }));
                    } catch (creditErr) {
                        logger.warn("Credit scoring service unavailable", "credit", { error: creditErr });
                    }
                    // ---------------------------
                } catch (paymentErr: any) {
                    logger.error("Error recording payment", "payment", { error: paymentErr.message || paymentErr });
                }

                import("./payment-confirmation-service").then(service => {
                    // Pass the determined userPayer to the confirmation service
                    service.confirmPaymentAndMintOutcome(signature, invoiceId, userPayer);
                }).catch(err => logger.error("Failed to start NFT minting", "nft", { error: err.message || err }));
            }

            res.json({ success: true, signature });

        } catch (sendErr: any) {
            logger.error("Transaction Send Failed", "payment", {
                error: sendErr.message || sendErr,
                logs: sendErr.logs
            });
            throw new Error(sendErr.message || "Relay processing failed");
        }

    } catch (error: any) {
        logger.error("Payment relay error", "payment", { error: error.message || error });
        res.status(500).json({ success: false, message: error.message || "Relay processing failed" });
    }
});

export const paymentRouter = router;
