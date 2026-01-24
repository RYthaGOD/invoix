/**
 * Privacy Controls Component
 * 
 * UI component for toggling Arcium MXE encryption on invoices
 * Shows encryption status and authorized parties
 */

import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, Info } from 'lucide-react';
import { useArciumClient } from '@/lib/arcium-client';

interface PrivacyControlsProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    className?: string;
}

export function PrivacyControls({ enabled, onChange, className = '' }: PrivacyControlsProps) {
    const { getStatus } = useArciumClient();
    const [arciumAvailable, setArciumAvailable] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkArciumStatus();
    }, []);

    const checkArciumStatus = async () => {
        setLoading(true);
        const status = await getStatus();
        setArciumAvailable(status?.available || false);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className={`border rounded-lg p-4 ${className}`}>
                <div className="flex items-center gap-2 text-gray-500">
                    <Shield className="w-5 h-5 animate-pulse" />
                    <span>Checking encryption availability...</span>
                </div>
            </div>
        );
    }

    if (!arciumAvailable) {
        return (
            <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
                <div className="flex items-center gap-2 text-gray-500">
                    <Info className="w-5 h-5" />
                    <span className="text-sm">Arcium encryption is currently unavailable</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`border rounded-lg p-4 space-y-4 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-500" />
                    <label htmlFor="encryption" className="text-base font-medium cursor-pointer">
                        Enable On-Chain Confidential Computing
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => onChange(!enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {enabled && (
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-md p-3 space-y-3">
                    <div className="flex items-start gap-2">
                        <Lock className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-purple-900 dark:text-purple-100">
                            <p className="font-medium">On-Chain Encryption Enabled</p>
                            <p className="text-purple-700 dark:text-purple-300 mt-1">
                                Invoice will be created on Solana using Arcium MXE. Only you and the customer can access the encrypted details.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-purple-900 dark:text-purple-100">
                            <p className="font-medium">Authorized Parties</p>
                            <ul className="list-disc list-inside text-purple-700 dark:text-purple-300 mt-1">
                                <li>You (Invoice Creator)</li>
                                <li>Customer (Invoice Recipient)</li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                            <strong>Note:</strong> Creating an on-chain invoice requires a wallet signature and a small transaction fee (~0.001 SOL).
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
