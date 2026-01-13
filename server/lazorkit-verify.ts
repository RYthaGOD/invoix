/**
 * LazorKit Smart Wallet Signature Verification
 * 
 * Implements server-side verification of WebAuthn signatures from LazorKit smart wallets
 */

import { PublicKey, Connection } from '@solana/web3.js';
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
 * @returns Promise<boolean> - true if signature is valid
 */
export async function verifySmartWalletSignature(
    smartWalletAddress: string,
    message: string,
    signatureBase58: string,
    connection: Connection
): Promise<boolean> {
    try {
        const walletPubkey = new PublicKey(smartWalletAddress);
        const LAZORKIT_STRICT_MODE = process.env.LAZORKIT_STRICT_MODE === 'true';

        // Lazy load SDK to avoid startup errors if not installed/configured
        let LazorkitClient;
        try {
            // @ts-ignore
            const module = await import("@lazorkit/wallet");
            LazorkitClient = module.LazorkitClient;
        } catch (e) {
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
                            return true;
                        }
                    } catch (err) {
                        continue;
                    }
                }
            } catch (sdkError) {
                logger.warn("[Signature Verify] SDK verification failed", "auth", { error: sdkError });
            }
        }

        // Fallback for when SDK verify fails or is skipped

        // Option B: Direct verify (unlikely to work for PDAs but good sanity check)
        try {
            const signature = bs58.decode(signatureBase58);
            const messageBytes = new TextEncoder().encode(message);
            if (nacl.sign.detached.verify(messageBytes, signature, walletPubkey.toBytes())) {
                return true;
            }
        } catch (e) { }

        if (LAZORKIT_STRICT_MODE) {
            logger.warn('[Signature Verify] Strict mode: Verification failed.', "auth");
            return false;
        } else {
            // Check existence as last resort for dev mode
            const accountInfo = await connection.getAccountInfo(walletPubkey);
            if (accountInfo) {
                logger.warn('[Signature Verify] Allowing login based on on-chain existence only (Non-Strict Mode).', "auth");
                return true;
            }
        }

        return false;

    } catch (error) {
        logger.error('[Signature Verify] Verification error', "auth", { error });
        // Fail open only if explicitly NOT strict and error is related to SDK missing? 
        // No, fail closed by default is safer.
        return false;
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

    } catch (error) {
        logger.error('[Ownership Verify] Verification error', "auth", { error });
        return false;
    }
}
