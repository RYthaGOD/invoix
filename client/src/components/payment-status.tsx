import React from "react";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface PaymentStatusProps {
    status: 'idle' | 'confirming' | 'verified' | 'failed';
    txSignature?: string | null;
    error?: string | null;
    onViewExplorer?: () => void;
}

export function PaymentStatus({ status, txSignature, error }: PaymentStatusProps) {
    if (status === 'idle') return null;

    if (status === 'confirming') {
        return (
            <div className="glass-card border border-purple-500/30 bg-purple-500/10 p-6 rounded-lg text-center animate-pulse">
                <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-3 animate-spin" />
                <h3 className="text-lg font-semibold text-white mb-1">Confirming Transaction...</h3>
                <p className="text-gray-400 text-sm">
                    Please wait while the Solana blockchain verifies your payment.
                </p>
                {txSignature && (
                    <div className="mt-4">
                        <a
                            href={`https://orb.helius.dev/tx/${txSignature}?cluster=${import.meta.env.VITE_SOLANA_NETWORK || 'mainnet-beta'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-xs flex items-center justify-center gap-1"
                        >
                            View on Orb <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                )}
            </div>
        );
    }

    if (status === 'verified') {
        return (
            <div className="glass-card border border-green-500/30 bg-green-500/10 p-6 rounded-lg text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                <p className="text-gray-300 mb-4">
                    Your invoice has been settled instantly.
                </p>
                <div className="flex justify-center gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                        View Receipt
                    </button>
                    {txSignature && (
                        <a
                            href={`https://orb.helius.dev/tx/${txSignature}?cluster=${import.meta.env.VITE_SOLANA_NETWORK || 'mainnet-beta'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                            Verify on Chain <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    if (status === 'failed' || error) {
        return (
            <div className="glass-card border border-red-500/30 bg-red-500/10 p-6 rounded-lg text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Payment Failed</h3>
                <p className="text-red-300 text-sm mb-4">
                    {error || "Something went wrong during the transaction."}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return null;
}
