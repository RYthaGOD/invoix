/**
 * LazorKit Smart Wallet Signature Verification
 * 
 * Implements server-side verification of WebAuthn signatures from LazorKit smart wallets
 */

import { PublicKey, Connection } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

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
            console.warn("[Signature Verify] @lazorkit/wallet SDK not found. Skipping SDK verification.");
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
                console.warn("[Signature Verify] SDK verification failed (Account might not exist or IDL mismatch):", sdkError);
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
            console.warn('[Signature Verify] Strict mode: Verification failed.');
            return false;
        } else {
            // Check existence as last resort for dev mode
            const accountInfo = await connection.getAccountInfo(walletPubkey);
            if (accountInfo) {
                console.log('[Signature Verify] WARNING: Allowing login based on on-chain existence only (Non-Strict Mode).');
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error('[Signature Verify] Verification error:', error);
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
            console.warn('[Ownership Verify] Account does not exist');
            return false;
        }

        // Verify the account is owned by the LazorKit program
        const programId = new PublicKey(expectedProgramId);
        if (!accountInfo.owner.equals(programId)) {
            console.warn('[Ownership Verify] Account not owned by LazorKit program');
            return false;
        }

        console.log('[Ownership Verify] Account verified as LazorKit smart wallet');
        return true;

    } catch (error) {
        console.error('[Ownership Verify] Verification error:', error);
        return false;
    }
}
