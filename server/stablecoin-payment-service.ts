/**
 * Multi-Stablecoin Payment Verification Service
 * Handles payment verification for USDC, USDT, PYUSD, EURC
 */

import { Connection, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { getStablecoinByMint, getStablecoinConfig, isValidStablecoin } from "@shared/stablecoin-config";
import { logger } from "./logger";

export interface PaymentVerificationResult {
    verified: boolean;
    amount: string; // Changed to string for strict precision
    currency: string;
    fromAddress: string;
    toAddress: string;
    txSignature: string;
    timestamp: Date;
    error?: string;
}

/**
 * Verify a stablecoin payment transaction on Solana
 * Checks:
 * 1. Correct Recipient (Invoicee)
 * 2. Correct Amount
 * 3. Correct Currency (Token Mint)
 * 4. OPTIONAL: Correct Platform Fee (if expected)
 */
export async function verifyStablecoinPayment(
    connection: Connection,
    txSignature: string,
    expectedAmount: string, // Changed to string for precision
    expectedRecipient: string,
    expectedCurrency: string,
    expectedFeeAmount?: string, // Changed to string
    treasuryWallet?: string     // Optional: Treasury wallet address
): Promise<PaymentVerificationResult> {
    try {
        let decimals = 6; // Default for most stablecoins
        let mint = "";

        // Handle specific currencies
        if (expectedCurrency === "SOL") {
            decimals = 9;
            mint = "SOL";
        } else {
            // Get stablecoin configuration
            const stablecoinConfig = getStablecoinConfig(expectedCurrency);
            if (!stablecoinConfig) {
                return {
                    verified: false,
                    amount: "0",
                    currency: expectedCurrency,
                    fromAddress: "",
                    toAddress: "",
                    txSignature,
                    timestamp: new Date(),
                    error: `Unsupported currency: ${expectedCurrency}`,
                };
            }
            decimals = stablecoinConfig.decimals;
            mint = stablecoinConfig.mint;
        }

        // Fetch transaction from blockchain with retries (RPC may not have indexed immediately)
        // Enhanced retry logic with getSignatureStatus polling and exponential backoff
        let tx = null;
        const maxRetries = 10; // Increased from 5 to handle network congestion
        const baseDelay = 2000; // Start at 2 seconds

        // STEP 1: Quick signature status check (lightweight, faster than getTransaction)
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Check signature status first (cheaper RPC call)
            const statusResponse = await connection.getSignatureStatus(txSignature, {
                searchTransactionHistory: true // Check beyond recent cache
            });

            const status = statusResponse?.value;

            // If transaction failed on-chain, stop immediately
            if (status?.err) {
                logger.error(`Transaction failed on-chain: ${txSignature}`, "payment", { error: status.err });
                return {
                    verified: false,
                    amount: "0",
                    currency: expectedCurrency,
                    fromAddress: "",
                    toAddress: "",
                    txSignature,
                    timestamp: new Date(),
                    error: `Transaction failed on-chain: ${JSON.stringify(status.err)}`,
                };
            }

            // If confirmed or finalized, proceed to get full transaction
            if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
                tx = await connection.getTransaction(txSignature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                });
                if (tx) {
                    logger.info(`Transaction confirmed after ${attempt + 1} attempts`, "payment", { signature: txSignature });
                    break;
                }
            }

            // Exponential backoff: 2s, 4s, 6s, 8s, 10s, 12s, 14s, 16s, 18s, 20s (total: 110s)
            const delay = baseDelay * (attempt + 1);
            logger.debug(
                `Transaction not confirmed yet (attempt ${attempt + 1}/${maxRetries}), waiting ${delay}ms...`,
                "payment",
                { signature: txSignature, status: status?.confirmationStatus || 'not found' }
            );
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (!tx) {
            // After 110 seconds, still not found - likely invalid signature or extreme network issues
            const errorMessage = `Transaction not indexed after ${maxRetries} retries (110 seconds). This may indicate:\n` +
                `1. Network congestion - please wait 2-3 minutes and check Solana Explorer\n` +
                `2. Invalid transaction signature\n` +
                `3. RPC node issues\n\n` +
                `Signature: ${txSignature}\n` +
                `Check status: https://orb.helius.dev/tx/${txSignature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`;

            logger.error("Payment verification timeout", "payment", { signature: txSignature, error: errorMessage });

            return {
                verified: false,
                amount: "0",
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: errorMessage,
            };
        }

        if (tx.meta?.err) {
            return {
                verified: false,
                amount: "0",
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
            };
        }

        // Parse token transfers
        const transfers = parseAllTokenTransfers(tx, mint);
        if (transfers.length === 0) {
            return {
                verified: false,
                amount: "0",
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: "No token transfers found for this currency",
            };
        }

        // 1. Verify Payment to Recipient
        logger.debug("Payment Verification Debug", "payment", {
            transfers: transfers.map(t => ({ dest: t.destination, amount: t.amount })),
            expectedRecipient,
            mint
        });

        const paymentTransfer = transfers.find(t => t.destination.toLowerCase() === expectedRecipient.toLowerCase());

        if (!paymentTransfer) {
            logger.warn(`No transfer found to recipient`, "payment", {
                expected: expectedRecipient,
                transfersTo: transfers.map(t => t.destination)
            });
            return {
                verified: false,
                amount: "0",
                currency: expectedCurrency,
                fromAddress: transfers[0]?.source || "", // Best guess
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: `Recipient did not receive any funds. Expected: ${expectedRecipient.slice(0, 8)}..., Got payments to: ${transfers.map(t => t.destination.slice(0, 8) + '...').join(', ') || 'none'}`,
            };
        }

        // --- SECURITY FIX: Spoofing Protection ---
        // Ensure the sender is NOT the recipient (self-transfer attack)
        if (paymentTransfer.source.toLowerCase() === paymentTransfer.destination.toLowerCase()) {
            return {
                verified: false,
                amount: "0",
                currency: expectedCurrency,
                fromAddress: paymentTransfer.source,
                toAddress: paymentTransfer.destination,
                txSignature,
                timestamp: new Date(),
                error: "Security Alert: Self-transfer detected. Payment rejected.",
            };
        }

        // Verify Amounts using BigInt for precision
        // We receive human-readable strings (e.g. "10.50"), need to convert to atomic based on decimals
        const scaleFactor = BigInt(10) ** BigInt(decimals);
        // Helper to convert decimal string to BigInt atomic units
        const toAtomic = (amountStr: string): bigint => {
            const parts = amountStr.split(".");
            const whole = BigInt(parts[0]);
            let fraction = BigInt(0);
            if (parts.length > 1) {
                const fractionStr = parts[1].padEnd(decimals, "0").slice(0, decimals);
                fraction = BigInt(fractionStr);
            }
            return whole * scaleFactor + fraction;
        };

        const receivedAmount = BigInt(paymentTransfer.amount);
        const expectedAmountBigInt = toAtomic(expectedAmount);

        // Exact match check
        const diff = receivedAmount > expectedAmountBigInt ? receivedAmount - expectedAmountBigInt : expectedAmountBigInt - receivedAmount;

        // FIX R3-3: Precision Formatting
        // Helper to convert atomic BigInt back to human string
        const toHuman = (atomic: bigint): string => {
            const s = atomic.toString().padStart(decimals + 1, "0");
            const whole = s.slice(0, -decimals);
            const frac = s.slice(-decimals);
            // Remove trailing zeros
            const cleanFrac = frac.replace(/0+$/, "");
            return cleanFrac ? `${whole}.${cleanFrac}` : whole;
        };

        // R2-6: TOLERANCE
        // Allow max 100 atomic units difference (~0.0001 USDC or ~0.0000001 SOL)
        if (diff > BigInt(100)) {
            return {
                verified: false,
                amount: toHuman(receivedAmount),
                currency: expectedCurrency,
                fromAddress: paymentTransfer.source,
                toAddress: paymentTransfer.destination,
                txSignature,
                timestamp: new Date(),
                error: `Amount mismatch: expected ${expectedAmountBigInt}, got ${receivedAmount} (Atomic Units)`,
            };
        }

        // 3. Verify Fee (if applicable)
        if (expectedFeeAmount && treasuryWallet) {
            const expectedFeeBigInt = toAtomic(expectedFeeAmount);
            const feeTransfer = transfers.find(t => t.destination.toLowerCase() === treasuryWallet.toLowerCase());

            if (!feeTransfer) {
                return {
                    verified: false,
                    amount: toHuman(receivedAmount),
                    currency: expectedCurrency,
                    fromAddress: paymentTransfer.source,
                    toAddress: paymentTransfer.destination,
                    txSignature,
                    timestamp: new Date(),
                    error: "Platform fee not paid to treasury",
                };
            }

            const receivedFee = BigInt(feeTransfer.amount);
            const feeDiff = receivedFee > expectedFeeBigInt ? receivedFee - expectedFeeBigInt : expectedFeeBigInt - receivedFee;

            if (feeDiff > BigInt(100)) {
                return {
                    verified: false,
                    amount: toHuman(receivedAmount),
                    currency: expectedCurrency,
                    fromAddress: paymentTransfer.source,
                    toAddress: paymentTransfer.destination,
                    txSignature,
                    timestamp: new Date(),
                    error: `Fee amount mismatch: expected ${expectedFeeBigInt}, got ${receivedFee} (Atomic Units)`,
                };
            }
        }

        // Success!
        return {
            verified: true,
            amount: toHuman(receivedAmount),
            currency: expectedCurrency,
            fromAddress: paymentTransfer.source,
            toAddress: paymentTransfer.destination,
            txSignature,
            timestamp: tx.blockTime ? new Date(tx.blockTime * 1000) : new Date(),
        };

    } catch (error: any) {
        logger.error("Error verifying payment", "payment", { error });
        return {
            verified: false,
            amount: "0",
            currency: expectedCurrency,
            fromAddress: "",
            toAddress: "",
            txSignature,
            timestamp: new Date(),
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Helper: Parse ALL token transfers for a specific mint in a transaction
 * Supports SPL Tokens and Native SOL (if mint === "SOL")
 */
function parseAllTokenTransfers(tx: VersionedTransactionResponse, expectedMint: string): Array<{ amount: string, destination: string, source: string, mint: string }> {
    const transfers: Array<{ amount: string, destination: string, source: string, mint: string }> = [];

    try {
        const preBalances = tx.meta?.preBalances || [];
        const postBalances = tx.meta?.postBalances || [];

        // Handle both VersionedMessage and Message types safely
        const message = tx.transaction.message;
        const accountKeys = message.getAccountKeys
            ? message.getAccountKeys().staticAccountKeys.map(k => k.toString()) // Versioned
            : (message as any).accountKeys.map((k: any) => k.toString());       // Legacy fallback just in case

        // --- NATIVE SOL LOGIC ---
        if (expectedMint === "SOL") {
            // Check native lamport changes
            for (let i = 0; i < accountKeys.length; i++) {
                const pre = preBalances[i] || 0;
                const post = postBalances[i] || 0;
                const delta = post - pre;
                const address = accountKeys[i];

                if (delta > 0) {
                    // Credit (Received SOL)
                    transfers.push({
                        amount: delta.toString(), // Keep as string for BigInt
                        destination: address,
                        source: "unknown", // Hard to determine exact source without instruction parsing
                        mint: "SOL"
                    });
                }
            }
            // Attempt to find source (largest negative delta?) - Simplification
            let source = "";
            let maxDebit = 0;
            for (let i = 0; i < accountKeys.length; i++) {
                const diff = (preBalances[i] || 0) - (postBalances[i] || 0);
                if (diff > maxDebit) {
                    maxDebit = diff;
                    source = accountKeys[i];
                }
            }
            return transfers.map(t => ({ ...t, source }));
        }

        // --- SPL TOKEN LOGIC ---
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];

        // Populate from post balances
        for (let i = 0; i < postTokenBalances.length; i++) {
            const post = postTokenBalances[i];

            // Only care about our stablecoin mint
            if (post.mint !== expectedMint) continue;

            const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);

            // Calculate delta in raw atomic units
            const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : BigInt(0);
            const postAmount = BigInt(post.uiTokenAmount.amount);
            const delta = postAmount - preAmount;

            if (delta > BigInt(0)) {
                transfers.push({
                    amount: delta.toString(),
                    destination: post.owner || "unknown",
                    source: "unknown",
                    mint: post.mint
                });
            }
        }

        // Find source for Token Transfers
        let source = "";
        for (let i = 0; i < postTokenBalances.length; i++) {
            const post = postTokenBalances[i];
            if (post.mint !== expectedMint) continue;

            const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);
            const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : BigInt(0);
            const postAmount = BigInt(post.uiTokenAmount.amount);

            if (postAmount < preAmount) {
                source = post.owner || "unknown";
                break;
            }
        }

        return transfers.map(t => ({ ...t, source }));

    } catch (error: any) {
        logger.error("Error parsing transfers", "payment", { error });
        return [];
    }
}

/**
 * Check if a wallet has a token account for a specific stablecoin
 */
export async function hasTokenAccount(
    connection: Connection,
    walletAddress: string,
    currency: string
): Promise<boolean> {
    try {
        const stablecoinConfig = getStablecoinConfig(currency);
        if (!stablecoinConfig) return false;

        const walletPubkey = new PublicKey(walletAddress);
        const mintPubkey = new PublicKey(stablecoinConfig.mint);

        const tokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            walletPubkey
        );

        const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
        return accountInfo !== null;
    } catch (error: any) {
        logger.error("Error checking token account", "payment", { error });
        return false;
    }
}

/**
 * Get token account balance for a specific stablecoin
 */
export async function getTokenBalance(
    connection: Connection,
    walletAddress: string,
    currency: string
): Promise<number> {
    try {
        const stablecoinConfig = getStablecoinConfig(currency);
        if (!stablecoinConfig) return 0;

        const walletPubkey = new PublicKey(walletAddress);
        const mintPubkey = new PublicKey(stablecoinConfig.mint);

        const tokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            walletPubkey
        );

        const tokenAccount = await getAccount(connection, tokenAccountAddress);
        return Number(tokenAccount.amount) / Math.pow(10, stablecoinConfig.decimals);
    } catch (error: any) {
        logger.error("Error getting token balance", "payment", { error });
        return 0;
    }
}
