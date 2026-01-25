/**
 * Arcium MXE API Routes
 * 
 * Handles on-chain Arcium MXE operations for confidential invoicing:
 * - Invoice PDA creation
 * - Encryption/decryption
 * - Transaction building
 * - Service status
 */

import { Router } from 'express';
import { getArciumService } from './arcium-service';
import { getArciumOnChainService } from './arcium-onchain-service';
import { requireWalletOwnership } from './security';
import { requireAuth } from './middleware/auth-middleware';
import { db } from './db';
import { invoices } from '../shared/invoice-schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { Connection } from '@solana/web3.js';

const router = Router();

/**
 * GET /api/arcium/status
 * Check Arcium service availability and configuration
 */
router.get('/status', (req, res) => {
    try {
        const arciumService = getArciumService();
        const programId = process.env.ARCIUM_PROGRAM_ID;

        res.json({
            available: arciumService.isAvailable(),
            configured: !!programId,
            mode: process.env.ARCIUM_MODE || 'sdk-only',
            programId: programId || null,
            encryptionEnabled: process.env.ENABLE_ARCIUM_ENCRYPTION === 'true',
            network: process.env.SOLANA_NETWORK || 'devnet',
        });
    } catch (error: any) {
        logger.error('Failed to get Arcium status', 'arcium-routes', { error: error.message });
        res.status(500).json({ error: 'Failed to get service status' });
    }
});

/**
 * GET /api/arcium/invoice-pda/:invoiceId
 * Get PDA address for an invoice (client-side verification)
 */
router.get('/invoice-pda/:invoiceId', (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { authority } = req.query;

        if (!authority || typeof authority !== 'string') {
            return res.status(400).json({ error: 'Authority public key required' });
        }

        if (!process.env.ARCIUM_PROGRAM_ID) {
            return res.status(503).json({
                error: 'Arcium program not configured',
                message: 'ARCIUM_PROGRAM_ID environment variable is not set'
            });
        }

        const onChainService = getArciumOnChainService();
        const pda = onChainService.getInvoicePdaPreview(authority, invoiceId);

        res.json({
            pda,
            invoiceId,
            authority,
            programId: process.env.ARCIUM_PROGRAM_ID,
        });
    } catch (error: any) {
        logger.error('Failed to derive invoice PDA', 'arcium-routes', {
            error: error.message,
            invoiceId: req.params.invoiceId,
        });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/arcium/create-invoice-tx
 * Build transaction to create on-chain invoice account
 * 
 * Body: {
 *   invoiceId: string,
 *   amount: number,
 *   dueDate: string (ISO date),
 *   currency: string,
 *   buyerWallet: string,
 *   description?: string,
 *   authorityPublicKey: string
 * }
 */
router.post('/create-invoice-tx', requireAuth, async (req, res) => {
    try {
        const {
            invoiceId,
            amount,
            dueDate,
            currency,
            buyerWallet,
            description,
            authorityPublicKey,
        } = req.body;

        // Validate inputs
        if (!invoiceId || !amount || !dueDate || !authorityPublicKey || !buyerWallet) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['invoiceId', 'amount', 'dueDate', 'authorityPublicKey', 'buyerWallet'],
            });
        }

        const onChainService = getArciumOnChainService();

        const { transaction, invoicePda } =
            await onChainService.createInvoiceAccountTransaction(
                {
                    id: invoiceId,
                    totalAmount: amount.toString(),
                    dueDate: new Date(dueDate),
                    currency: currency || 'USDC',
                    description,
                    invoiceeWalletAddress: buyerWallet,
                },
                authorityPublicKey
            );

        logger.info('Created invoice transaction', 'arcium-routes', {
            invoiceId,
            pda: invoicePda,
            authority: authorityPublicKey,
        });

        res.json({
            transaction,
            invoicePda,
            message: transaction ? 'Transaction ready for signing' : 'Invoice PDA already exists',
        });
    } catch (error: any) {
        logger.error('Failed to create invoice transaction', 'arcium-routes', {
            error: error.message,
            invoiceId: req.body.invoiceId,
        });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/arcium/encrypt
 * Encrypt invoice data using Arcium MXE
 * 
 * Body: {
 *   data: ConfidentialTransactionData,
 *   allowedParties: string[] (public keys)
 * }
 */
router.post('/encrypt', requireAuth, async (req, res) => {
    try {
        const { data, allowedParties } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'Data required for encryption' });
        }

        const arciumService = getArciumService();
        if (!arciumService.isAvailable()) {
            return res.status(503).json({
                error: 'Arcium service unavailable',
                hint: 'Check ENABLE_ARCIUM_ENCRYPTION and service initialization',
            });
        }

        const result = await arciumService.encryptTransaction(
            data,
            allowedParties || []
        );

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        logger.info('Encrypted invoice data', 'arcium-routes', {
            parties: allowedParties?.length || 0,
        });

        res.json({
            encryptedData: result.encryptedData,
            encryptionKey: result.encryptionKey,
            success: true,
        });
    } catch (error: any) {
        logger.error('Encryption failed', 'arcium-routes', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/arcium/decrypt
 * Decrypt invoice data (authorized users only)
 * 
 * Body: {
 *   invoiceId: string,
 *   requestorPublicKey: string
 * }
 */
router.post('/decrypt', requireAuth, async (req, res) => {
    try {
        const { invoiceId, requestorPublicKey } = req.body;

        if (!invoiceId || !requestorPublicKey) {
            return res.status(400).json({ error: 'Invoice ID and requestor public key required' });
        }

        // 1. Fetch invoice from database
        const [invoice] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .limit(1);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // 2. Check if invoice has encrypted data
        if (!invoice.arciumEncryptedData || !invoice.arciumEncryptionKey) {
            return res.status(400).json({
                error: 'Invoice is not encrypted',
                hint: 'This invoice does not have encrypted data',
            });
        }

        // 3. Authorization check - only invoice parties can decrypt
        // SECURITY FIX: Include marketplace buyer (nftTransferredTo) in authorized list
        const isAuthorized =
            invoice.invoicerWalletAddress === requestorPublicKey ||
            invoice.invoiceeWalletAddress === requestorPublicKey ||
            (invoice as any).nftTransferredTo === requestorPublicKey ||
            ((invoice.arciumAllowedParties as string[]) || []).includes(requestorPublicKey);

        if (!isAuthorized) {
            logger.warn('Unauthorized decryption attempt', 'arcium-routes', {
                invoiceId,
                requestor: requestorPublicKey,
                invoicer: invoice.invoicerWalletAddress,
                invoicee: invoice.invoiceeWalletAddress,
                owner: (invoice as any).nftTransferredTo
            });
            return res.status(403).json({ error: 'Unauthorized - you are not a party to this invoice' });
        }

        // 4. Decrypt data
        const arciumService = getArciumService();
        const decryptedData = await arciumService.decryptTransaction(
            invoice.arciumEncryptedData,
            invoice.arciumEncryptionKey
        );

        if (!decryptedData) {
            return res.status(500).json({ error: 'Decryption failed' });
        }

        logger.info('Invoice decrypted successfully', 'arcium-routes', {
            invoiceId,
            requestor: requestorPublicKey,
        });

        res.json({
            success: true,
            data: decryptedData,
        });
    } catch (error: any) {
        logger.error('Decryption failed', 'arcium-routes', {
            error: error.message,
            invoiceId: req.body.invoiceId,
        });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/arcium/update-pda
 * Update invoice with on-chain PDA address and transaction signature
 * (Called after successful on-chain invoice creation)
 * 
 * Body: {
 *   invoiceId: string,
 *   pda: string,
 *   txSignature: string
 * }
 */
router.post('/update-pda', requireAuth, async (req, res) => {
    try {
        const { invoiceId, pda, txSignature } = req.body;

        if (!invoiceId || !pda) {
            return res.status(400).json({ error: 'Invoice ID and PDA required' });
        }

        // SECURITY: Verify the transaction actually happened on-chain
        if (txSignature) {
            try {
                const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
                const tx = await connection.getTransaction(txSignature, { maxSupportedTransactionVersion: 0 });

                if (!tx) {
                    return res.status(400).json({ error: 'Transaction not found on-chain' });
                }

                if (tx.meta?.err) {
                    return res.status(400).json({ error: 'Transaction failed on-chain' });
                }

                // Optional: Verify the transaction actually interacts with our program or the specific PDA
                // This prevents users from submitting random valid signatures
            } catch (txErr) {
                logger.warn('Failed to verify on-chain transaction', 'arcium-routes', { error: txErr });
                // We don't block here if RPC fails, but we log it. 
                // In strict mode, we might want to fail.
            }
        }

        // Update invoice with PDA and signature
        const [updated] = await db
            .update(invoices)
            .set({
                arciumInvoicePda: pda,
                arciumTxSignature: txSignature || null,
            })
            .where(eq(invoices.id, invoiceId))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        logger.info('Updated invoice with Arcium PDA', 'arcium-routes', {
            invoiceId,
            pda,
            txSignature,
        });

        res.json({
            success: true,
            invoice: updated,
        });
    } catch (error: any) {
        logger.error('Failed to update invoice PDA', 'arcium-routes', {
            error: error.message,
            invoiceId: req.body.invoiceId,
        });
        res.status(500).json({ error: error.message });
    }
});

export default router;
