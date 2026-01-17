
import { Router } from "express";
import { Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { getStablecoinConfig } from "@shared/stablecoin-config";
import { TREASURY_WALLET_ADDRESS, PLATFORM_FEE_RATE } from "@shared/config";
import { loadKeypairFromPrivateKey } from "./arcium-service";

import { strictRateLimit } from "./security";
import { logger } from "./logger";
import Decimal from "decimal.js";
import { getSolanaConnection } from "./solana-sdk";


const router = Router();

const GAS_FEE_USDC = parseFloat(process.env.GAS_FEE_USDC || "0.15");
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
    } catch (error: any) {
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
        const invoiceData = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
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
        } catch {
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

        // --- SECURITY FIX: Payer Authorization ---
        let userPayer = "unknown";
        if (isVersioned) {
            const vTx = transaction as VersionedTransaction;
            // The user is likely the 2nd signer (index 1) if fee payer is 0
            if (vTx.message.header.numRequiredSignatures > 1) {
                userPayer = vTx.message.staticAccountKeys[1].toString();
            }
        } else {
            const lTx = transaction as Transaction;
            if (lTx.signatures) {
                for (const sig of lTx.signatures) {
                    if (sig.publicKey && !sig.publicKey.equals(payerKeypair.publicKey)) {
                        userPayer = sig.publicKey.toString();
                        break;
                    }
                }
            }
        }

        if (userPayer !== invoice.invoiceeWalletAddress) {
            logger.warn("Unauthorized Gasless Relay attempt", "security", {
                invoiceId,
                attemptedBy: userPayer,
                authorizedPayer: invoice.invoiceeWalletAddress
            });
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Only the designated recipient can pay this invoice"
            });
        }
        // ------------------------------------------

        // 4. Detect if this is a native SOL payment
        const isNativeSOL = invoice.currency === "SOL" ||
            invoice.tokenMint === "So11111111111111111111111111111111111111112";

        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

        // FIX: Check if invoice was sold (NFT transferred)
        // If so, payment goes to the new owner (investor), not the original invoicer.
        const payeeAddress = invoice.nftTransferredTo || invoice.invoicerWalletAddress;
        const sellerPubkey = new PublicKey(payeeAddress);

        // Amounts - use BigInt for everything to avoid float errors
        // invoice.remainingAmount is a string decimal (e.g. "100.50")

        let paymentAmountAtomic: bigint;
        let platformFeeAtomic: bigint;
        let sellerAmountAtomic: bigint;
        let decimals: number;

        if (isNativeSOL) {
            decimals = 9; // SOL has 9 decimals
            const LAMPORTS_PER_SOL = 1_000_000_000;

            // Parse strings to atomic units (lamports) safely using Decimal
            // We use safe arithmetic to avoid floating point errors

            const totalAmount = new Decimal(invoice.remainingAmount);
            // Fee logic: 1% 
            const feeRate = new Decimal(PLATFORM_FEE_RATE || "0.01");
            const feeAmount = invoice.platformFee ? new Decimal(invoice.platformFee) : totalAmount.mul(feeRate);
            const sellerAmt = invoice.subtotal ? new Decimal(invoice.subtotal) : totalAmount.sub(feeAmount);

            // Convert to Atomic Units (Lamports)
            platformFeeAtomic = BigInt(feeAmount.mul(LAMPORTS_PER_SOL).toFixed(0, Decimal.ROUND_HALF_UP));
            sellerAmountAtomic = BigInt(sellerAmt.mul(LAMPORTS_PER_SOL).toFixed(0, Decimal.ROUND_HALF_UP));
            paymentAmountAtomic = platformFeeAtomic + sellerAmountAtomic;

            let treasuryPaidAmount = BigInt(0);
            let sellerPaidAmount = BigInt(0);

            // ==================== NATIVE SOL VALIDATION ====================
            const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

            // Iterate instructions (Versioned/Legacy)
            const instructions = isVersioned
                ? (transaction as VersionedTransaction).message.compiledInstructions.map(ix => {
                    const accountKeys = (transaction as VersionedTransaction).message.staticAccountKeys;
                    return {
                        programId: accountKeys[ix.programIdIndex],
                        data: Buffer.from(ix.data),
                        keys: ix.accountKeyIndexes.map(idx => ({ pubkey: accountKeys[idx] }))
                    };
                })
                : (transaction as Transaction).instructions;

            for (const ix of instructions) {
                if (ix.programId.toString() === SYSTEM_PROGRAM_ID) {
                    // System Transfer Check (Type 2)
                    if (ix.data.length >= 12 && ix.data.readUInt32LE(0) === 2) {
                        const lamports = ix.data.readBigUInt64LE(4);
                        // For System Transfer: keys[0] = from, keys[1] = to
                        const dest = ix.keys[1].pubkey;

                        if (dest.equals(treasuryPubkey)) {
                            treasuryPaidAmount += lamports;
                        } else if (dest.equals(sellerPubkey)) {
                            sellerPaidAmount += lamports;
                        }
                    }
                }
            }

            if (sellerPaidAmount < sellerAmountAtomic) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient SOL to Seller. Expected ${Number(sellerAmountAtomic) / LAMPORTS_PER_SOL} SOL. Got ${Number(sellerPaidAmount) / LAMPORTS_PER_SOL}`
                });
            }
            if (treasuryPaidAmount < platformFeeAtomic) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient SOL Platform Fee. Expected ${Number(platformFeeAtomic) / LAMPORTS_PER_SOL} SOL. Got ${Number(treasuryPaidAmount) / LAMPORTS_PER_SOL}`
                });
            }

        } else {
            // ==================== SPL TOKEN VALIDATION ====================
            const feeConfig = getStablecoinConfig(invoice.currency);
            if (!feeConfig) {
                return res.status(400).json({ success: false, message: "Unsupported currency" });
            }
            decimals = feeConfig.decimals;

            const treasuryAta = await getAssociatedTokenAddress(new PublicKey(feeConfig.mint), treasuryPubkey);
            const sellerAta = await getAssociatedTokenAddress(new PublicKey(feeConfig.mint), sellerPubkey);

            const totalAmount = new Decimal(invoice.remainingAmount);
            // Fee logic: 1% + Gas (0.15 USDC)
            const feeRate = new Decimal(PLATFORM_FEE_RATE || "0.01");
            const feeInfo = invoice.platformFee ? new Decimal(invoice.platformFee) : totalAmount.mul(feeRate);
            const gasFee = new Decimal(GAS_FEE_USDC.toString()); // GAS_FEE_USDC is number, convert safely

            const sellerAmt = invoice.subtotal ? new Decimal(invoice.subtotal) : totalAmount.sub(feeInfo);
            const treasuryAmt = feeInfo.add(gasFee);

            // Convert to BigInt atomic units
            const multiplier = Math.pow(10, decimals);
            sellerAmountAtomic = BigInt(sellerAmt.mul(multiplier).toFixed(0, Decimal.ROUND_HALF_UP));
            platformFeeAtomic = BigInt(treasuryAmt.mul(multiplier).toFixed(0, Decimal.ROUND_HALF_UP));

            let treasuryPaidAmount = BigInt(0);
            let sellerPaidAmount = BigInt(0);

            const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

            // Normalize instructions for iteration
            const instructions = isVersioned
                ? (transaction as VersionedTransaction).message.compiledInstructions.map(ix => {
                    const accountKeys = (transaction as VersionedTransaction).message.staticAccountKeys;
                    return {
                        programId: accountKeys[ix.programIdIndex],
                        data: Buffer.from(ix.data),
                        keys: ix.accountKeyIndexes.map(idx => ({ pubkey: accountKeys[idx] }))
                    };
                })
                : (transaction as Transaction).instructions;

            for (const ix of instructions) {
                if (ix.programId.toString() === TOKEN_PROGRAM_ID) {
                    // Check Transfer (3) or TransferChecked (12)
                    if (ix.data.length >= 9) {
                        const type = ix.data[0];
                        if (type === 3 || type === 12) {
                            const amount = ix.data.subarray(1, 9).readBigUInt64LE(0);
                            // Token Transfer: keys[0]=source, keys[1]=dest (for Transfer), keys[2]=owner
                            // CAREFUL: keys for Transfer vs TransferChecked might differ in position of mint/decimals
                            // Standard Transfer: [source, dest, owner]
                            // Standard TransferChecked: [source, mint, dest, owner]

                            // Let's assume standard Transfer for now as that's what we build. 
                            // Robustness: CHECK destination index based on type? 
                            // simpler: just check if ANY key passed to instruction matches destination

                            // Actually, let's just use the destination key index which is usually 1 for Transfer
                            // For TransferChecked it is 2.

                            let destKeyIndex = 1;
                            if (type === 12) destKeyIndex = 2;

                            if (ix.keys.length > destKeyIndex) {
                                const dest = ix.keys[destKeyIndex].pubkey;
                                if (dest.equals(treasuryAta)) {
                                    treasuryPaidAmount += amount;
                                } else if (dest.equals(sellerAta)) {
                                    sellerPaidAmount += amount;
                                }
                            }
                        }
                    }
                }
            }

            if (sellerPaidAmount < sellerAmountAtomic) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Seller Payment. Expected ${sellerAmt}. Got ${Number(sellerPaidAmount) / multiplier}`
                });
            }
            if (treasuryPaidAmount < platformFeeAtomic) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Treasury Payment. Expected ${treasuryAmt}. Got ${Number(treasuryPaidAmount) / multiplier}`
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

            // Safe: Memo Program
            if (programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb") return false;

            // Safe: Compute Budget (usually no signers, but safe if present)
            if (programId === "ComputeBudget111111111111111111111111111111") return false;

            // Safe: Arcium Program (for encrypted invoices)
            if (programId === "GSu3xPJNeyG2sVbn9GbZg4CHfzzUwLbYLaxzN7cbS3x") return false;

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
                            logger.error("Blocked Versioned Instruction", "security", {
                                program: progId,
                                instructionData: Buffer.from(ix.data).toString('hex'),
                                protocolIndex
                            });
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
                        logger.error("Blocked Legacy Instruction", "security", {
                            program: ix.programId.toString(),
                            instructionData: ix.data.toString('hex')
                        });
                        return res.status(403).json({ success: false, message: "Security Alert: Unauthorized protocol signature." });
                    }
                }
            }
        }

        // 5. Sign and Send
        try {
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

            const signature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });

            logger.info("Relay transaction sent", "payment", { signature, invoiceId, isVersioned });

            if (invoiceId) {
                import("./payment-confirmation-service").then(service => {
                    // Pass the determined userPayer to the confirmation service
                    service.confirmPaymentAndMintOutcome(signature, invoiceId, userPayer);
                }).catch(err => logger.error("Failed to start confirmation service", "payment", { error: err.message || err }));
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
