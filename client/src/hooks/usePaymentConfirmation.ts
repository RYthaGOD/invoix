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

            // 1. Check On-Chain Status
            const result = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
            const confirmationStatus = result.value?.confirmationStatus;

            if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
                // 2. If on-chain confirmed, verify with Backend (which updates DB)
                if (invoiceId) {
                    // Poll backend record
                    const res = await fetch(`/api/invoices/${invoiceId}`);
                    const data = await res.json();

                    if (data.invoice && data.invoice.status === 'paid') {
                        setStatus('verified');
                        return; // Stop polling
                    }
                } else {
                    // If no invoiceId provided, just rely on chain
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

    // Failsafe timeout - stop polling after 60 seconds
    useEffect(() => {
        if (status === 'confirming') {
            const timeoutId = setTimeout(() => {
                // Set status to failed so the polling interval gets cleared
                setStatus('failed');
                setError("Confirmation timed out. Please check your wallet or Explorer.");
            }, 60000); // 1 minute timeout
            return () => clearTimeout(timeoutId);
        }
    }, [status]);

    return { status, error };
}
