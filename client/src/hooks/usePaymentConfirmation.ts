import { useState, useEffect, useCallback } from "react";
import { Connection } from "@solana/web3.js";

export type PaymentStatus = 'idle' | 'confirming' | 'verified' | 'failed';

interface UsePaymentConfirmationProps {
    connection: Connection;
    signature: string | null;
    invoiceId?: string;
}

export function usePaymentConfirmation({ connection, signature, invoiceId }: UsePaymentConfirmationProps) {
    const [status, setStatus] = useState<PaymentStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [confirmations, setConfirmations] = useState(0);

    const checkStatus = useCallback(async () => {
        if (!signature) return;

        try {
            setStatus('confirming');

            // 1. Check Backend Status FIRST (Faster)
            // The server records payment immediately after relay, so this should return 'paid' quickly
            if (invoiceId) {
                try {
                    const res = await fetch(`/api/invoices/${invoiceId}`);
                    const data = await res.json();

                    if (data.invoice && (data.invoice.status === 'paid' || data.invoice.status === 'processing')) {
                        setStatus('verified');
                        return; // Stop polling immediately if DB says paid
                    }
                } catch (apiErr) {
                    console.warn("Failed to fetch invoice status:", apiErr);
                }
            }

            // 2. Fallback: Check On-Chain Status
            // Only rely on this if backend hasn't updated yet
            const result = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
            const confirmationStatus = result.value?.confirmationStatus;

            if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
                // If chain is verified but DB isn't yet, we might be in a race condition
                // But we can trust the chain context if needed, or just keep polling for DB
                // For now, if we have an invoiceId, we prefer to wait for DB to match 'paid'
                if (!invoiceId) {
                    setStatus('verified');
                    return;
                }
            } else if (result.value?.err) {
                setStatus('failed');
                setError(`Transaction failed: ${JSON.stringify(result.value.err)}`);
                return;
            }

            // Retry if not yet verified
            setConfirmations(prev => prev + 1);

        } catch (err: any) {
            console.error("Confirmation check failed", err);
            // Don't fail immediately on network blip, just retry
        }
    }, [connection, signature, invoiceId]);

    useEffect(() => {
        if (!signature) {
            setStatus('idle');
            return;
        }

        // Don't poll if already in terminal state
        if (status === 'verified' || status === 'failed') {
            return;
        }

        const intervalId = setInterval(checkStatus, 2000); // Poll every 2s

        return () => clearInterval(intervalId);
    }, [signature, checkStatus, status]);

    // Failsafe timeout - stop polling after 120 seconds (increased for slow networks)
    useEffect(() => {
        if (status === 'confirming') {
            const timeoutId = setTimeout(() => {
                // Set status to failed so the polling interval gets cleared
                setStatus('failed');
                setError("Confirmation timed out. Please check your wallet or Explorer.");
            }, 120000); // 2 minute timeout (was 1 minute)
            return () => clearTimeout(timeoutId);
        }
    }, [status]);

    return { status, error };
}
