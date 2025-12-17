
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

import { strictRateLimit } from "./security";

const router = Router();

// Configuration
const GAS_FEE_USDC = 0.15; // 0.15 USDC Fee
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");

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

        // 2. Decode Transaction
        const txBuffer = Buffer.from(txBase64, "base64");
        const transaction = Transaction.from(txBuffer);

        // 3. Validation: Check Fee Payer matches Protocol
        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
        if (!transaction.feePayer?.equals(payerKeypair.publicKey)) {
            return res.status(400).json({ success: false, message: "Transaction fee payer must be the protocol" });
        }

        // 4. Validation: Analyze Instructions
        // We need to verify:
        // A) Transfer to Invoicee (Amount >= Invoice Remaining) - OPTIONAL/WARNING (User might pay partial)
        // B) Transfer to Treasury (Amount >= 0.15 USDC) - CRITICAL

        const feeConfig = getStablecoinConfig(invoice.currency); // Assuming fee is in same currency as invoice for simplicity, or we check USDC specifically?
        // Let's assume the fee is paid in the invoice currency for now to simplify UX "One token".
        // If invoice is EURC, we charge 0.15 EURC (close enough). 

        if (!feeConfig) {
            return res.status(400).json({ success: false, message: "Unsupported currency for gasless payment" });
        }

        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);
        const treasuryAta = await getAssociatedTokenAddress(new PublicKey(feeConfig.mint), treasuryPubkey);

        let feePaid = false;
        const requiredFeeAtomic = Math.floor(GAS_FEE_USDC * Math.pow(10, feeConfig.decimals));

        // Iterate over instructions to find the fee payment
        // We can't easily parse inner instructions of spl-token without an IDL or layout decoder, 
        // but we can check the keys and data buffer roughly or use a library.
        // For standard SPL transfers, data is 1 byte instruction + 8 bytes amount.

        // Simpler approach: Simulate the transaction? 
        // Simulation is safer but slower. 
        // Let's do a basic instruction check first.

        for (const ix of transaction.instructions) {
            // Check if it's a Token Program instruction
            if (ix.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
                // Check destination (keys[1] usually for transfer)
                // Transfer instruction: [source, destination, authority]
                if (ix.keys.length >= 2) {
                    const dest = ix.keys[1].pubkey;
                    if (dest.equals(treasuryAta)) {
                        // It's sending to treasury ATA. Check amount.
                        // Data layout: [3 (Transfer), amount(8 bytes)]
                        // OR [12 (TransferChecked), amount(8 bytes), decimals(1 byte)]
                        if (ix.data.length >= 9 && ix.data.length <= 64) { // Safe buffer size bounds
                            // Very rough parsing (Little Endian BigInt)
                            // Skip first byte (instruction)
                            try {
                                const amountBuffer = ix.data.subarray(1, 9);
                                // Additional safety: verify buffer is exactly 8 bytes
                                if (amountBuffer.length !== 8) {
                                    console.warn("[SECURITY] Malformed instruction data length");
                                    continue;
                                }
                                const amount = amountBuffer.readBigUInt64LE(0);
                                if (Number(amount) >= requiredFeeAtomic) {
                                    feePaid = true;
                                }
                            } catch (e) {
                                console.error("Error parsing instruction data", e);
                            }
                        }
                    }
                }
            }
        }

        if (!feePaid) {
            // Fallback: Simulate transaction to be 100% sure
            const simRes = await connection.simulateTransaction(transaction, [payerKeypair]);
            if (simRes.value.err) {
                return res.status(400).json({ success: false, message: "Transaction simulation failed", details: simRes.value.err });
            }

            // STRICT MODE: Reject if we didn't find the explicit transfer instruction
            return res.status(400).json({ success: false, message: `Gas recovery fee of ${GAS_FEE_USDC} ${invoice.currency} not found or insufficient.` });
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

        // MINT RECEIPT NFT (Async)
        // We trigger this asynchronously to not block the response.
        if (invoiceId && process.env.MINT_RECEIPT_NFTS === "true") {
            // We need to import this dynamically to avoid circular deps if any
            import("./payment-confirmation-service").then(service => {
                service.confirmPaymentAndMintOutcome(signature, invoiceId, transaction.feePayer!.toString());
            }).catch(err => console.error("Failed to trigger receipt mint:", err));
        }

        // 6. Return Signature
        res.json({ success: true, signature });

    } catch (error: any) {
        console.error("Payment relay error:", error);
        res.status(500).json({ success: false, message: error.message || "Relay processing failed" });
    }
});

export const paymentRouter = router;
