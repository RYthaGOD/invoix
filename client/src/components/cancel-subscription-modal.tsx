import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscription: {
        id: string;
        plan?: {
            name: string;
            amount: string;
            interval: string;
        };
    };
    onPrepareCancel: () => Promise<any>;
    onConfirmCancel: (data: { signature: string; subscriptionPda: string }) => Promise<void>;
}

export function CancelSubscriptionModal({
    isOpen,
    onClose,
    subscription,
    onPrepareCancel,
    onConfirmCancel,
}: CancelSubscriptionModalProps) {
    const { signTransaction } = useWallet();
    const { toast } = useToast();
    const [step, setStep] = useState<'confirm' | 'signing' | 'processing'>('confirm');

    const handleCancel = async () => {
        if (!signTransaction) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to cancel the subscription',
                variant: 'destructive',
            });
            return;
        }

        try {
            setStep('signing');

            // Step 1: Prepare cancellation
            const prepareResult = await onPrepareCancel();

            toast({
                title: 'Transaction ready',
                description: 'Please sign the cancellation transaction in your wallet',
            });

            // Step 2: Sign transaction (simulated for now)
            // In production, you'd deserialize and sign the actual instruction
            const mockSignature = 'cancel_sig_' + Date.now();
            const mockPda = prepareResult.subscriptionPda;

            setStep('processing');

            // Step 3: Confirm cancellation
            await onConfirmCancel({
                signature: mockSignature,
                subscriptionPda: mockPda,
            });

            toast({
                title: 'Subscription cancelled',
                description: 'Your subscription has been cancelled successfully',
            });

            onClose();
            setStep('confirm');
        } catch (error: any) {
            console.error('Cancellation error:', error);
            toast({
                title: 'Cancellation failed',
                description: error.message || 'Failed to cancel subscription',
                variant: 'destructive',
            });
            setStep('confirm');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to cancel this subscription? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <div className="space-y-2">
                            <p className="font-semibold">This will immediately:</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li>Stop all future billing</li>
                                <li>Prevent new invoice minting</li>
                                <li>Mark subscription as cancelled on-chain</li>
                            </ul>
                        </div>
                    </AlertDescription>
                </Alert>

                {subscription.plan && (
                    <div className="space-y-2 text-sm border-l-2 border-muted pl-4">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-medium">{subscription.plan.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">
                                ${subscription.plan.amount}/{subscription.plan.interval}
                            </span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={step !== 'confirm'}
                    >
                        Keep Subscription
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={step !== 'confirm'}
                    >
                        {step === 'confirm' && 'Cancel Subscription'}
                        {step === 'signing' && (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Preparing...
                            </>
                        )}
                        {step === 'processing' && (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
