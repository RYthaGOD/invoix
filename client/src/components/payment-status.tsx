import React from "react";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface PaymentStatusProps {
    status: 'idle' | 'confirming' | 'verified' | 'failed';
    txSignature?: string | null;
    error?: string | null;
    elapsedSeconds?: number;
    onViewExplorer?: () => void;
}

export function PaymentStatus({ status, txSignature, error, elapsedSeconds = 0 }: PaymentStatusProps) {
    if (status === 'idle') return null;

    if (status === 'confirming') {
        const progressPercentage = Math.min((elapsedSeconds / 120) * 100, 100);

        return (
            <div className="glass-card border border-purple-500/30 bg-purple-500/10 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                        <h3 className="text-lg font-semibold text-white">Verifying Payment...</h3>
                    </div>
                    <span className="text-sm text-gray-400">
                        {elapsedSeconds}s / 120s
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-700/50 rounded-full h-2 mb-3">
                    <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                <p className="text-gray-400 text-sm mb-2">
                    Waiting for Solana blockchain confirmation. This may take up to 2 minutes during network congestion.
                </p>

                {txSignature && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <a
                            href={`https://orb.helius.dev/tx/${txSignature}?cluster=${import.meta.env.VITE_SOLANA_NETWORK || 'devnet'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-xs flex items-center justify-center gap-1"
                        >
                            View on Orb Explorer <ExternalLink className="w-3 h-3" />
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
                            href={`https://orb.helius.dev/tx/${txSignature}?cluster=${import.meta.env.VITE_SOLANA_NETWORK || 'devnet'}`}
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
                <h3 className="text-lg font-semibold text-white mb-2">Payment Verification Failed</h3>
                <p className="text-red-300 text-sm mb-4 whitespace-pre-line text-left">
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
