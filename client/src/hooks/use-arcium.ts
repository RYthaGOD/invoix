import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { Buffer } from 'buffer';

interface CreateWithArciumParams {
    invoiceId: string;
    amount: string;
    dueDate: Date | string;
    currency: string;
    invoiceeWalletAddress: string;
}

export function useDecryptInvoice() {
    const { walletAddress } = useAuth();
    const [isDecrypting, setIsDecrypting] = useState(false);

    const decryptInvoice = async (invoiceId: string) => {
        if (!walletAddress) throw new Error("Authentication required");

        setIsDecrypting(true);
        try {
            const res = await fetch('/api/arcium/decrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId,
                    requestorPublicKey: walletAddress
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Decryption failed");
            }

            const { data } = await res.json();
            return data;
        } finally {
            setIsDecrypting(false);
        }
    };

    return { decryptInvoice, isDecrypting };
}

export function useCreateInvoiceWithArcium() {
    const { walletAddress } = useAuth();
    const wallet = useWallet();
    const { toast } = useToast();
    const [status, setStatus] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    const createOnChainInvoice = async (params: CreateWithArciumParams) => {
        if (!walletAddress || !wallet.publicKey) {
            throw new Error("Wallet not connected");
        }

        setIsProcessing(true);
        setStatus("Initializing Arcium Secure Environment...");

        try {
            // 1. Request Transaction from Server
            const res = await fetch('/api/arcium/create-invoice-tx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: params.invoiceId,
                    amount: parseFloat(params.amount),
                    dueDate: params.dueDate,
                    currency: params.currency,
                    buyerWallet: params.invoiceeWalletAddress,
                    authorityPublicKey: wallet.publicKey.toBase58()
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to build transaction");
            }

            const { transaction: txBase64, invoicePda } = await res.json();

            if (!txBase64) {
                // PDA might already exist (idempotent), just return success
                setStatus("Invoice Account Verified ✅");
                return { success: true, pda: invoicePda };
            }

            // 2. Deserialize Transaction
            setStatus("Please Sign Arcium Transaction...");
            const txBuffer = Buffer.from(txBase64, 'base64');

            // Try VersionedTransaction first (as backend usually returns v0 or serialized message)
            // But Arcium service uses `new Transaction()`, which is legacy.
            // Let's try legacy transaction deserialization first if it's not a versioned one.
            // Actually, backend does `tx.serialize(...)`.

            let transaction;
            try {
                transaction = Transaction.from(txBuffer);
            } catch (e) {
                // Fallback if it's versioned (unlikely given current backend code, but safe)
                transaction = VersionedTransaction.deserialize(txBuffer);
            }

            // 3. User Signs
            if (!wallet.signTransaction) {
                throw new Error("Wallet does not support signing");
            }

            // @ts-ignore - Handle both transaction types
            const signedTx = await wallet.signTransaction(transaction);

            // 4. Send Transaction
            setStatus("Broadcasting to Solana Devnet...");
            const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

            const rawTx = signedTx.serialize();
            const signature = await connection.sendRawTransaction(rawTx);

            setStatus("Confirming Secure Account... ⏳");
            const confirmation = await connection.confirmTransaction(signature, "confirmed");

            if (confirmation.value.err) {
                throw new Error(`On-chain transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            // 5. Update Backend with Success
            setStatus("Finalizing...");
            await fetch('/api/arcium/update-pda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: params.invoiceId,
                    pda: invoicePda,
                    txSignature: signature
                })
            });

            setStatus("Arcium Protected ✅");
            return { success: true, pda: invoicePda, signature };

        } catch (error: any) {
            console.error("Arcium creation failed:", error);
            setStatus("Failed");
            toast({
                variant: "destructive",
                title: "Arcium Setup Failed",
                description: error.message
            });
            // We verify client-side but don't block the invoice creation itself since the DB record exists.
            // The user just won't have the on-chain counterpart.
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        createOnChainInvoice,
        status,
        isProcessing
    };
}
