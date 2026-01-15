/**
 * LazorKit Wallet Initialization Service
 * 
 * Sponsors on-chain wallet creation for new passkey users using the platform treasury.
 * This solves the "cold start" problem where new users cannot authenticate in strict mode
 * because their account does not exist on-chain.
 */

import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { logger } from './logger';
import { loadKeypairFromPrivateKey } from './arcium-service';

export interface InitWalletResult {
    success: boolean;
    transactionSignature?: string;
    smartWallet?: string;
    error?: string;
}

/**
 * Initialize a new LazorKit smart wallet on-chain using treasury sponsorship.
 * 
 * @param passkeyPublicKey - The 33-byte compressed secp256r1 public key from WebAuthn
 * @param credentialIdBase64 - The base64-encoded credential ID from WebAuthn
 * @param connection - Solana connection
 */
export async function initializeSmartWallet(
    passkeyPublicKey: number[],
    credentialIdBase64: string,
    connection: Connection
): Promise<InitWalletResult> {
    try {
        // 1. Load treasury keypair (Sponsor)
        const treasuryPrivateKey = process.env.PAYER_PRIVATE_KEY;
        if (!treasuryPrivateKey) {
            logger.error('[WalletInit] Treasury wallet not configured (PAYER_PRIVATE_KEY missing)', 'auth');
            return { success: false, error: 'Treasury wallet not configured' };
        }

        const treasuryKeypair = loadKeypairFromPrivateKey(treasuryPrivateKey);

        // 2. Validate inputs
        if (!passkeyPublicKey || !Array.isArray(passkeyPublicKey) || passkeyPublicKey.length !== 33) {
            return { success: false, error: 'Invalid passkey public key (must be 33 bytes)' };
        }

        if (!credentialIdBase64 || typeof credentialIdBase64 !== 'string') {
            return { success: false, error: 'Invalid credential ID' };
        }

        // 3. Import LazorKit SDK dynamically
        let LazorkitClient;
        let asPasskeyPublicKey;
        try {
            const module = await import("@lazorkit/wallet");
            LazorkitClient = module.LazorkitClient;
            asPasskeyPublicKey = module.asPasskeyPublicKey;
        } catch (e) {
            logger.error('[WalletInit] @lazorkit/wallet SDK not found', 'auth', { error: e });
            return { success: false, error: 'Wallet SDK not available' };
        }

        const client = new LazorkitClient(connection);

        logger.info(`[WalletInit] Initializing smart wallet for credential ${credentialIdBase64.substring(0, 10)}...`, 'auth');

        // 4. Build the wallet creation transaction
        // The SDK handles PDA derivation and instruction building
        const { transaction, smartWallet, smartWalletId } = await client.createSmartWalletTxn({
            payer: treasuryKeypair.publicKey,
            passkeyPublicKey: asPasskeyPublicKey(passkeyPublicKey),
            credentialIdBase64,
        });

        // 5. Sign with treasury
        if (transaction instanceof VersionedTransaction) {
            transaction.sign([treasuryKeypair]);
        } else {
            // Legacy Transaction
            (transaction as Transaction).sign(treasuryKeypair);
        }

        // 6. Send and confirm
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            { skipPreflight: false, preflightCommitment: 'confirmed' }
        );

        await connection.confirmTransaction(signature, 'confirmed');

        logger.info(`[WalletInit] Created smart wallet ${smartWallet.toBase58()} (ID: ${smartWalletId.toString()})`, 'auth', { signature });

        return {
            success: true,
            transactionSignature: signature,
            smartWallet: smartWallet.toBase58(),
        };

    } catch (error: any) {
        logger.error('[WalletInit] Failed to create wallet', 'auth', { error });
        return { success: false, error: error.message || 'Unknown initialization error' };
    }
}
