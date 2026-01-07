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
import { Calendar, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';

interface MintInvoiceModalProps {
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
    onPrepareMint: () => Promise<any>;
    onConfirmMint: (data: { signature: string; invoicePda: string }) => Promise<any>;
}

export function MintInvoiceModal({
    isOpen,
    onClose,
    subscription,
    onPrepareMint,
    onConfirmMint,
}: MintInvoiceModalProps) {
    const { signTransaction } = useWallet();
    const { toast } = useToast();
    const [step, setStep] = useState<'preview' | 'signing' | 'processing' | 'success'>('preview');
    const [mintedInvoice, setMintedInvoice] = useState<any>(null);

    const handleMint = async () => {
        if (!signTransaction) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to mint an invoice',
                variant: 'destructive',
            });
            return;
        }

        try {
            setStep('signing');

            // Step 1: Prepare mint
            const prepareResult = await onPrepareMint();

            toast({
                title: 'Transaction ready',
                description: 'Please sign the invoice mint transaction in your wallet',
            });

            // Step 2: Sign transaction (simulated)
            const mockSignature = 'mint_sig_' + Date.now();
            const mockPda = prepareResult.invoicePda || 'mock_invoice_pda';

            setStep('processing');

            // Step 3: Confirm mint
            const result = await onConfirmMint({
                signature: mockSignature,
                invoicePda: mockPda,
            });

            setMintedInvoice(result);
            setStep('success');

            toast({
                title: 'Invoice minted',
                description: 'The invoice has been created successfully',
            });
        } catch (error: any) {
            console.error('Mint error:', error);
            toast({
                title: 'Minting failed',
                description: error.message || 'Failed to mint invoice',
                variant: 'destructive',
            });
            setStep('preview');
        }
    };

    const handleClose = () => {
        setStep('preview');
        setMintedInvoice(null);
        onClose();
    };

    if (step === 'success' && mintedInvoice) {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex justify-center mb-2">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <DialogTitle className="text-center">Invoice Minted!</DialogTitle>
                        <DialogDescription className="text-center">
                            The invoice has been created and sent to the blockchain.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Invoice ID</span>
                            <span className="font-mono text-xs">
                                {mintedInvoice.id?.slice(0, 12)}...
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-semibold">${mintedInvoice.amount || subscription.plan?.amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <span className="text-green-600">Minted</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button className="w-full" onClick={handleClose}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mint Invoice Now</DialogTitle>
                    <DialogDescription>
                        Create an invoice for this subscription immediately. The invoice will be sent on-chain.
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertDescription>
                        This will mint an invoice ahead of the regular billing cycle. The subscription's next
                        billing date will be updated automatically.
                    </AlertDescription>
                </Alert>

                {subscription.plan && (
                    <div className="space-y-3 border rounded-lg p-4">
                        <h4 className="font-semibold text-sm">Invoice Preview</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <DollarSign className="h-4 w-4" />
                                    Amount
                                </span>
                                <span className="font-semibold">${subscription.plan.amount}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    Due Date
                                </span>
                                <span>{dueDate.toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Billing Period</span>
                                <span className="capitalize">{subscription.plan.interval}</span>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={step !== 'preview'}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleMint}
                        disabled={step !== 'preview'}
                    >
                        {step === 'preview' && 'Mint Invoice'}
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
