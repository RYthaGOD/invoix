/**
 * Arcium MXE Client Integration
 * 
 * Client-side utilities for interacting with Arcium MXE on-chain program
 * Handles PDA derivation, transaction building, and wallet signing
 */

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useState, useCallback } from 'react';

export interface CreateInvoiceOnChainParams {
    invoiceId: string;
    amount: number;
    dueDate: Date;
    currency: string;
    buyerWallet: string;
    description?: string;
}

export interface ArciumStatus {
    available: boolean;
    mode: string;
    programId: string;
    encryptionEnabled: boolean;
    network: string;
}

/**
 * Hook for Arcium MXE client operations
 */
export function useArciumClient() {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Get Arcium service status
     */
    const getStatus = useCallback(async (): Promise<ArciumStatus | null> => {
        try {
            const response = await fetch('/api/arcium/status');
            if (!response.ok) throw new Error('Failed to get Arcium status');
            return await response.json();
        } catch (err: any) {
            console.error('Failed to get Arcium status:', err);
            return null;
        }
    }, []);

    /**
     * Derive Invoice PDA (client-side verification)
     */
    const getInvoicePda = useCallback(
        async (invoiceId: string): Promise<string | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            try {
                const response = await fetch(
                    `/api/arcium/invoice-pda/${invoiceId}?authority=${publicKey.toString()}`
                );

                if (!response.ok) throw new Error('Failed to derive PDA');

                const data = await response.json();
                return data.pda;
            } catch (err: any) {
                setError(err.message);
                return null;
            }
        },
        [publicKey]
    );

    /**
     * Create on-chain invoice account
     * Returns transaction signature
     */
    const createInvoiceOnChain = useCallback(
        async (params: CreateInvoiceOnChainParams): Promise<string | null> => {
            if (!publicKey || !signTransaction) {
                setError('Wallet not connected');
                return null;
            }

            setLoading(true);
            setError(null);

            try {
                // 1. Request transaction from server
                const response = await fetch('/api/arcium/create-invoice-tx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        ...params,
                        authorityPublicKey: publicKey.toString(),
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create transaction');
                }

                const { transaction: txBase64, invoicePda, message } = await response.json();

                // If no transaction (PDA already exists), return early
                if (!txBase64) {
                    console.log('Invoice PDA already exists:', invoicePda);
                    return null;
                }

                // 2. Deserialize transaction
                const txBuffer = Buffer.from(txBase64, 'base64');
                const transaction = Transaction.from(txBuffer);

                // 3. Sign transaction
                const signedTx = await signTransaction(transaction);

                // 4. Send transaction
                const signature = await connection.sendRawTransaction(
                    signedTx.serialize()
                );

                // 5. Confirm transaction
                console.log('Confirming transaction:', signature);
                await connection.confirmTransaction(signature, 'confirmed');

                console.log('✅ Invoice created on-chain:', {
                    signature,
                    pda: invoicePda,
                });

                return signature;
            } catch (err: any) {
                console.error('Failed to create invoice on-chain:', err);
                setError(err.message);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [publicKey, signTransaction, connection]
    );

    /**
     * Update invoice with PDA and transaction signature
     */
    const updateInvoicePda = useCallback(
        async (invoiceId: string, pda: string, txSignature: string): Promise<boolean> => {
            try {
                const response = await fetch('/api/arcium/update-pda', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        invoiceId,
                        pda,
                        txSignature,
                    }),
                });

                if (!response.ok) throw new Error('Failed to update invoice PDA');

                console.log('✅ Invoice updated with PDA:', pda);
                return true;
            } catch (err: any) {
                console.error('Failed to update invoice PDA:', err);
                setError(err.message);
                return false;
            }
        },
        []
    );

    /**
     * Decrypt invoice data (authorized users only)
     */
    const decryptInvoice = useCallback(
        async (invoiceId: string): Promise<any | null> => {
            if (!publicKey) {
                setError('Wallet not connected');
                return null;
            }

            try {
                const response = await fetch('/api/arcium/decrypt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        invoiceId,
                        requestorPublicKey: publicKey.toString(),
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Decryption failed');
                }

                const result = await response.json();
                return result.data;
            } catch (err: any) {
                console.error('Failed to decrypt invoice:', err);
                setError(err.message);
                return null;
            }
        },
        [publicKey]
    );

    return {
        getStatus,
        getInvoicePda,
        createInvoiceOnChain,
        updateInvoicePda,
        decryptInvoice,
        loading,
        error,
        isConnected: !!publicKey,
    };
}

/**
 * Hook for creating invoices with optional on-chain integration
 */
export function useCreateInvoiceWithArcium() {
    const arciumClient = useArciumClient();
    const [creating, setCreating] = useState(false);

    const createInvoice = async (
        invoiceData: any,
        options: { createOnChain?: boolean } = {}
    ) => {
        setCreating(true);

        try {
            // 1. Create invoice in database
            const response = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(invoiceData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create invoice');
            }

            const invoice = await response.json();

            // 2. Create on-chain invoice account if requested
            if (options.createOnChain && arciumClient.isConnected) {
                const signature = await arciumClient.createInvoiceOnChain({
                    invoiceId: invoice.id,
                    amount: parseFloat(invoice.totalAmount),
                    dueDate: new Date(invoice.dueDate),
                    currency: invoice.currency,
                    buyerWallet: invoice.invoiceeWalletAddress,
                    description: invoice.description,
                });

                // 3. Update invoice with PDA and signature if successful
                if (signature) {
                    const pda = await arciumClient.getInvoicePda(invoice.id);
                    if (pda) {
                        await arciumClient.updateInvoicePda(invoice.id, pda, signature);
                    }
                }
            }

            return invoice;
        } finally {
            setCreating(false);
        }
    };

    return {
        createInvoice,
        creating,
        ...arciumClient,
    };
}
