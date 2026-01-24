/**
 * Encrypted Invoice Display Component
 * 
 * Shows encrypted invoice data with decrypt button for authorized users
 */

import { useState } from 'react';
import { Lock, Unlock, Eye, AlertCircle } from 'lucide-react';
import { useArciumClient } from '@/lib/arcium-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EncryptedInvoiceDisplayProps {
    invoiceId: string;
    isEncrypted: boolean;
    className?: string;
}

export function EncryptedInvoiceDisplay({
    invoiceId,
    isEncrypted,
    className = '',
}: EncryptedInvoiceDisplayProps) {
    const [decrypted, setDecrypted] = useState(false);
    const [decryptedData, setDecryptedData] = useState<any>(null);
    const { decryptInvoice, loading, error } = useArciumClient();

    const handleDecrypt = async () => {
        const data = await decryptInvoice(invoiceId);
        if (data) {
            setDecryptedData(data);
            setDecrypted(true);
        }
    };

    if (!isEncrypted) {
        return null;
    }

    return (
        <div className={`border border-purple-200 dark:border-purple-800 rounded-lg p-4 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">Encrypted Invoice Data</span>
                </div>
                <Button
                    onClick={handleDecrypt}
                    disabled={loading || decrypted}
                    variant="outline"
                    size="sm"
                >
                    {loading ? (
                        'Decrypting...'
                    ) : decrypted ? (
                        <>
                            <Eye className="w-4 h-4 mr-2" />
                            Decrypted
                        </>
                    ) : (
                        <>
                            <Unlock className="w-4 h-4 mr-2" />
                            Decrypt
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {decrypted && decryptedData && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                                Amount
                            </span>
                            <span className="font-mono font-semibold">{decryptedData.amount}</span>
                        </div>
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                                Currency
                            </span>
                            <span className="font-mono">{decryptedData.currency || 'USDC'}</span>
                        </div>
                    </div>

                    {decryptedData.description && (
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                                Description
                            </span>
                            <p className="text-sm">{decryptedData.description}</p>
                        </div>
                    )}

                    {decryptedData.items && decryptedData.items.length > 0 && (
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                                Line Items
                            </span>
                            <div className="space-y-2">
                                {decryptedData.items.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded">
                                        <span>
                                            {item.quantity}x {item.description}
                                        </span>
                                        <span className="font-mono">${item.price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {decryptedData.notes && (
                        <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                                Notes
                            </span>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{decryptedData.notes}</p>
                        </div>
                    )}
                </div>
            )}

            {!decrypted && (
                <div className="text-center py-8 text-gray-500">
                    <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                        This invoice contains encrypted data.
                        <br />
                        Click "Decrypt" to view if you are authorized.
                    </p>
                </div>
            )}
        </div>
    );
}
