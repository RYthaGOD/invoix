/**
 * Multi-Stablecoin Payment Verification Service
 * Handles payment verification for USDC, USDT, PYUSD, EURC
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { getStablecoinByMint, getStablecoinConfig, isValidStablecoin } from "@shared/stablecoin-config";

export interface PaymentVerificationResult {
    verified: boolean;
    amount: number;
    currency: string;
    fromAddress: string;
    toAddress: string;
    txSignature: string;
    timestamp: Date;
    error?: string;
}

/**
 * Verify a stablecoin payment transaction on Solana
 */
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
    expectedAmount: number,
    expectedRecipient: string,
    expectedCurrency: string,
    expectedFeeAmount?: number, // Optional: Check for fee split
    treasuryWallet?: string     // Optional: Treasury wallet address
): Promise<PaymentVerificationResult> {
    try {
        // Get stablecoin configuration
        const stablecoinConfig = getStablecoinConfig(expectedCurrency);
        if (!stablecoinConfig) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: `Unsupported currency: ${expectedCurrency}`,
            };
        }

        // Fetch transaction from blockchain
        const tx = await connection.getTransaction(txSignature, {
            maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: "Transaction not found",
            };
        }

        if (tx.meta?.err) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
            };
        }

        // Parse token transfers
        const transfers = parseAllTokenTransfers(tx, stablecoinConfig.mint);
        if (transfers.length === 0) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: "No token transfers found for this currency",
            };
        }

        // 1. Verify Payment to Recipient
        const paymentTransfer = transfers.find(t => t.destination.toLowerCase() === expectedRecipient.toLowerCase());

        if (!paymentTransfer) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: transfers[0]?.source || "", // Best guess
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: "Recipient did not receive any funds",
            };
        }

        // 2. Verify Amount (allow 0.1% tolerance)
        const amountMatch = Math.abs(paymentTransfer.amount - expectedAmount) < (expectedAmount * 0.001);
        if (!amountMatch) {
            return {
                verified: false,
                amount: paymentTransfer.amount,
                currency: expectedCurrency,
                fromAddress: paymentTransfer.source,
                toAddress: paymentTransfer.destination,
                txSignature,
                timestamp: new Date(),
                error: `Amount mismatch: expected ${expectedAmount}, got ${paymentTransfer.amount}`,
            };
        }

        // 3. Verify Fee (if applicable)
        if (expectedFeeAmount && treasuryWallet) {
            const feeTransfer = transfers.find(t => t.destination.toLowerCase() === treasuryWallet.toLowerCase());

            if (!feeTransfer) {
                // Fee missing!
                return {
                    verified: false,
                    amount: paymentTransfer.amount,
                    currency: expectedCurrency,
                    fromAddress: paymentTransfer.source,
                    toAddress: paymentTransfer.destination,
                    txSignature,
                    timestamp: new Date(),
                    error: "Platform fee not paid to treasury",
                };
            }

            const feeMatch = Math.abs(feeTransfer.amount - expectedFeeAmount) < (expectedFeeAmount * 0.05); // 5% tolerance on fee?
            if (!feeMatch) {
                return {
                    verified: false,
                    amount: paymentTransfer.amount,
                    currency: expectedCurrency,
                    fromAddress: paymentTransfer.source,
                    toAddress: paymentTransfer.destination,
                    txSignature,
                    timestamp: new Date(),
                    error: `Fee amount mismatch: expected ${expectedFeeAmount}, got ${feeTransfer.amount}`,
                };
            }
        }

        // Success!
        return {
            verified: true,
            amount: paymentTransfer.amount,
            currency: expectedCurrency,
            fromAddress: paymentTransfer.source,
            toAddress: paymentTransfer.destination,
            txSignature,
            timestamp: tx.blockTime ? new Date(tx.blockTime * 1000) : new Date(),
        };

    } catch (error) {
        console.error("Error verifying payment:", error);
        return {
            verified: false,
            amount: 0,
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
 */
function parseAllTokenTransfers(tx: any, expectedMint: string) {
    const transfers = [];
    try {
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];

        // Map account index to owner for easier lookup
        const accountOwners = new Map<number, string>();

        // Populate from post balances (usually sufficient)
        postTokenBalances.forEach((p: any) => {
            if (p.owner) accountOwners.set(p.accountIndex, p.owner);
        });

        // Fallback to static account keys if available and not in balance info (rare for token accounts)
        // implementation detail: relying on balance info is safer for detailed owner lookup

        for (let i = 0; i < postTokenBalances.length; i++) {
            const post = postTokenBalances[i];

            // Only care about our stablecoin mint
            if (post.mint !== expectedMint) continue;

            const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);

            // Calculate delta
            const preAmount = pre ? parseInt(pre.uiTokenAmount.amount) : 0;
            const postAmount = parseInt(post.uiTokenAmount.amount);
            const delta = postAmount - preAmount;

            if (delta > 0) {
                // Determine decimals from the balance info itself if possible, or assume 6 (risky, but we handle scaling in main function?)
                // Actually, verifyStablecoinPayment uses stablecoinConfig.decimals.
                // Here we return raw token units / 10^decimals in the main loop, or raw here?
                // Let's return Scaled Amounts here to match main function expectations.
                const decimals = post.uiTokenAmount.decimals;

                transfers.push({
                    amount: delta / Math.pow(10, decimals),
                    destination: post.owner, // Recipient
                    // Source is hard to pin down in multi-party tx without Instruction parsing, 
                    // but usually the fee payer or the one with negative delta.
                    // For now we leave source generic or find the negative delta.
                    mint: post.mint
                });
            }
        }

        // Find source (account with negative delta)
        let source = "";
        for (let i = 0; i < postTokenBalances.length; i++) {
            const post = postTokenBalances[i];
            if (post.mint !== expectedMint) continue;
            const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);
            const preAmount = pre ? parseInt(pre.uiTokenAmount.amount) : 0;
            const postAmount = parseInt(post.uiTokenAmount.amount);
            if (postAmount < preAmount) {
                source = post.owner;
                break; // Assume single payer for simplicity
            }
        }

        // Attach source to all transfers (simplification)
        return transfers.map(t => ({ ...t, source }));

    } catch (error) {
        console.error("Error parsing all token transfers:", error);
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
    } catch (error) {
        console.error("Error checking token account:", error);
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
    } catch (error) {
        console.error("Error getting token balance:", error);
        return 0;
    }
}
