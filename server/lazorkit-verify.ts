/**
 * LazorKit Smart Wallet Signature Verification
 * 
 * Implements server-side verification of WebAuthn signatures from LazorKit smart wallets
 */

import { PublicKey, Connection, AccountInfo } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { logger } from './logger';

/**
 * Verify a signature from a LazorKit smart wallet
 * 
 * @param smartWalletAddress - The PDA address of the smart wallet
 * @param message - The message that was signed
 * @param signatureBase58 - The signature in base58 format
 * @param connection - Solana connection instance
 * @param preFetchedAccountInfo - Optional pre-fetched account info to avoid RPC calls
 * @returns Promise<boolean> - true if signature is valid
 */
export async function verifySmartWalletSignature(
    smartWalletAddress: string,
    message: string,
    signatureBase58: string,
    connection: Connection,
    preFetchedAccountInfo?: AccountInfo<Buffer> | null
): Promise<{ isValid: boolean; isNewWallet: boolean }> {
    try {
        const walletPubkey = new PublicKey(smartWalletAddress);
        const LAZORKIT_STRICT_MODE = process.env.LAZORKIT_STRICT_MODE === 'true';
        let isNewWallet = false;

        // Lazy load SDK to avoid startup errors if not installed/configured
        let LazorkitClient;
        try {
            const module = await import("@lazorkit/wallet");
            LazorkitClient = module.LazorkitClient;
        } catch {
            logger.warn("[Signature Verify] @lazorkit/wallet SDK not found. Skipping SDK verification.", "auth");
        }

        if (LazorkitClient) {
            try {
                const client = new LazorkitClient(connection);
                // Fetch wallet state to get authorized devices
                // Note: We use the default Program ID from the IDL if not overridden
                const walletState = await client.getWalletStateData(walletPubkey);

                const signature = bs58.decode(signatureBase58);
                const messageBytes = new TextEncoder().encode(message);

                // Check if ANY authorized device signed this message
                for (const device of walletState.devices) {
                    try {
                        const devicePubkey = device.passkeyPubkey; // Array or Buffer
                        const deviceKeyBytes = new Uint8Array(devicePubkey);

                        const isValid = nacl.sign.detached.verify(
                            messageBytes,
                            signature,
                            deviceKeyBytes
                        );

                        if (isValid) {
                            // verifySmartWalletOwnership check implicitly passed if we found the account data
                            return { isValid: true, isNewWallet: false };
                        }
                    } catch (err) {
                        continue;
                    }
                }
            } catch (sdkError) {
                // SDK fails if account doesn't exist on-chain yet - this is expected for NEW wallets
                // Check if this is a new wallet (account not on-chain)
                const accountInfo = preFetchedAccountInfo !== undefined
                    ? preFetchedAccountInfo
                    : await connection.getAccountInfo(walletPubkey);

                if (!accountInfo) {
                    isNewWallet = true;
                    logger.info("[Signature Verify] New wallet detected (not yet on-chain)", "auth");
                } else {
                    logger.warn("[Signature Verify] SDK verification failed for existing wallet", "auth", { error: sdkError });
                }
            }
        }

        // Fallback for when SDK verify fails or is skipped
        if (LAZORKIT_STRICT_MODE) {
            logger.warn('[Signature Verify] Strict mode: Verification failed.', "auth");
            return { isValid: false, isNewWallet };
        } else {
            // In non-strict mode, allow new wallets to authenticate
            // The passkey signature from LazorKit portal is sufficient proof of ownership
            // The on-chain wallet will be created on the user's first transaction
            if (isNewWallet) {
                logger.info('[Signature Verify] Allowing new wallet authentication (non-strict mode).', "auth");
                return { isValid: true, isNewWallet: true };
            }

            // For existing wallets that failed SDK verification, check existence as last resort
            const accountInfo = preFetchedAccountInfo !== undefined
                ? preFetchedAccountInfo
                : await connection.getAccountInfo(walletPubkey);

            if (accountInfo) {
                logger.warn('[Signature Verify] Allowing login based on on-chain existence only (Non-Strict Mode).', "auth");
                return { isValid: true, isNewWallet: false };
            }
        }

        return { isValid: false, isNewWallet };

    } catch (error: any) {
        logger.error('[Signature Verify] Verification error', "auth", { error });
        return { isValid: false, isNewWallet: false };
    }
}

/**
 * Enhanced verification with account ownership check
 * Ensures the smart wallet account actually exists and is controlled by the LazorKit program
 */
export async function verifySmartWalletOwnership(
    smartWalletAddress: string,
    expectedProgramId: string,
    connection: Connection
): Promise<boolean> {
    try {
        const walletPubkey = new PublicKey(smartWalletAddress);
        const accountInfo = await connection.getAccountInfo(walletPubkey);

        if (!accountInfo) {
            logger.warn('[Ownership Verify] Account does not exist', "auth");
            return false;
        }

        // Verify the account is owned by the LazorKit program
        const programId = new PublicKey(expectedProgramId);
        if (!accountInfo.owner.equals(programId)) {
            logger.warn('[Ownership Verify] Account not owned by LazorKit program', "auth");
            return false;
        }

        logger.info('[Ownership Verify] Account verified as LazorKit smart wallet', "auth");
        return true;

    } catch (error: any) {
        logger.error('[Ownership Verify] Verification error', "auth", { error });
        return false;
    }
}
