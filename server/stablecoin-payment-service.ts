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
export async function verifyStablecoinPayment(
    connection: Connection,
    txSignature: string,
    expectedAmount: number,
    expectedRecipient: string,
    expectedCurrency: string
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

        // Check if transaction was successful
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

        // Parse token transfer from transaction
        const tokenTransfer = parseTokenTransfer(tx, stablecoinConfig.mint);

        if (!tokenTransfer) {
            return {
                verified: false,
                amount: 0,
                currency: expectedCurrency,
                fromAddress: "",
                toAddress: "",
                txSignature,
                timestamp: new Date(),
                error: "No token transfer found in transaction",
            };
        }

        // Convert amount from token decimals
        const actualAmount = tokenTransfer.amount / Math.pow(10, stablecoinConfig.decimals);

        // Verify recipient
        const recipientMatch = tokenTransfer.destination.toLowerCase() === expectedRecipient.toLowerCase();

        // Verify amount (allow 0.1% tolerance for rounding)
        const amountMatch = Math.abs(actualAmount - expectedAmount) < expectedAmount * 0.001;

        const verified = recipientMatch && amountMatch;

        return {
            verified,
            amount: actualAmount,
            currency: expectedCurrency,
            fromAddress: tokenTransfer.source,
            toAddress: tokenTransfer.destination,
            txSignature,
            timestamp: tx.blockTime ? new Date(tx.blockTime * 1000) : new Date(),
            error: verified ? undefined : `Verification failed: ${!recipientMatch ? 'recipient mismatch' : 'amount mismatch'}`,
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
 * Parse token transfer from transaction
 */
function parseTokenTransfer(tx: any, expectedMint: string) {
    try {
        // Look for SPL token transfer in pre/post token balances
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];

        // Find the token transfer for our mint
        for (let i = 0; i < postTokenBalances.length; i++) {
            const post = postTokenBalances[i];
            const pre = preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);

            if (post.mint === expectedMint && pre) {
                const preAmount = parseInt(pre.uiTokenAmount.amount);
                const postAmount = parseInt(post.uiTokenAmount.amount);
                const transferAmount = postAmount - preAmount;

                if (transferAmount > 0) {
                    // This account received tokens
                    return {
                        amount: transferAmount,
                        source: tx.transaction.message.accountKeys[pre.accountIndex].toString(),
                        destination: post.owner,
                        mint: post.mint,
                    };
                }
            }
        }

        return null;
    } catch (error) {
        console.error("Error parsing token transfer:", error);
        return null;
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
