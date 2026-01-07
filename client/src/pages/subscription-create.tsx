import { useState, useEffect } from 'react';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { Breadcrumbs } from '@/components/breadcrumbs';

interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    amount: string;
    interval: 'weekly' | 'monthly' | 'yearly';
    intervalCount: number;
    features: string[];
}

export default function SubscriptionCreate() {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { createSubscription, confirmSubscription } = useSubscriptions();
    const { toast } = useToast();
    const [, setLocation] = useLocation();

    // Form state
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [customerWalletAddress, setCustomerWalletAddress] = useState('');
    const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
    const [isValidAddress, setIsValidAddress] = useState(false);

    // Flow state
    const [step, setStep] = useState<'form' | 'signing' | 'confirming' | 'success'>('form');
    const [pendingSubscription, setPendingSubscription] = useState<any>(null);

    // Mock plans (in production, fetch from API)
    const plans: SubscriptionPlan[] = [
        {
            id: 'plan-basic',
            name: 'Basic',
            description: 'Perfect for small businesses',
            amount: '10.00',
            interval: 'monthly',
            intervalCount: 1,
            features: ['Unlimited invoices', 'Email support', 'Basic analytics'],
        },
        {
            id: 'plan-pro',
            name: 'Professional',
            description: 'For growing businesses',
            amount: '25.00',
            interval: 'monthly',
            intervalCount: 1,
            features: ['Everything in Basic', 'Priority support', 'Advanced analytics', 'Custom branding'],
        },
        {
            id: 'plan-enterprise',
            name: 'Enterprise',
            description: 'For large organizations',
            amount: '100.00',
            interval: 'monthly',
            intervalCount: 1,
            features: ['Everything in Pro', '24/7 support', 'Dedicated account manager', 'API access'],
        },
    ];

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);

    // Validate Solana address
    useEffect(() => {
        if (!customerWalletAddress) {
            setIsValidAddress(false);
            return;
        }

        try {
            new PublicKey(customerWalletAddress);
            setIsValidAddress(true);
        } catch {
            setIsValidAddress(false);
        }
    }, [customerWalletAddress]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!publicKey || !signTransaction) {
            toast({
                title: 'Wallet not connected',
                description: 'Please connect your wallet to create a subscription',
                variant: 'destructive',
            });
            return;
        }

        if (!isValidAddress) {
            toast({
                title: 'Invalid address',
                description: 'Please enter a valid Solana wallet address',
                variant: 'destructive',
            });
            return;
        }

        try {
            setStep('signing');

            // Step 1: Prepare subscription (returns instruction)
            const result = await createSubscription.mutateAsync({
                planId: selectedPlanId,
                customerWalletAddress,
            });

            setPendingSubscription(result);

            // Step 2: Build and sign transaction
            // Note: In production, deserialize result.instruction from backend and add to transaction
            // For demo purposes, the signing step is simulated below
            const transaction = new Transaction();

            toast({
                title: 'Transaction ready',
                description: 'Please sign the transaction in your wallet',
            });

            // In production, you'd sign the actual transaction here
            // const signedTx = await signTransaction(transaction);
            // const signature = await connection.sendRawTransaction(signedTx.serialize());

            // Simulated signature for demo
            const mockSignature = 'simulated_signature_' + Date.now();
            const mockPda = result.subscriptionPda;

            setStep('confirming');

            // Step 3: Confirm on backend
            await confirmSubscription.mutateAsync({
                id: result.subscription.id,
                data: {
                    signature: mockSignature,
                    subscriptionPda: mockPda,
                },
            });

            setStep('success');

            // Redirect after 2 seconds
            setTimeout(() => {
                setLocation(`/subscriptions/${result.subscription.id}`);
            }, 2000);
        } catch (error: any) {
            console.error('Subscription creation error:', error);
            setStep('form');
            toast({
                title: 'Error',
                description: error.message || 'Failed to create subscription',
                variant: 'destructive',
            });
        }
    };

    // Success state
    if (step === 'success') {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                        </div>
                        <CardTitle className="text-center">Subscription Created!</CardTitle>
                        <CardDescription className="text-center">
                            Your subscription has been created successfully. Redirecting to details...
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <Breadcrumbs
                items={[
                    { label: 'Subscriptions', href: '/subscriptions' },
                    { label: 'Create New' },
                ]}
            />

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation('/subscriptions')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create Subscription</h1>
                    <p className="text-muted-foreground mt-1">
                        Set up a new recurring billing subscription
                    </p>
                </div>
            </div>

            {/* Progress indicator */}
            {step !== 'form' && (
                <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                        {step === 'signing' && 'Preparing transaction...'}
                        {step === 'confirming' && 'Confirming on-chain...'}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Plan Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Plan</CardTitle>
                            <CardDescription>Choose a subscription plan for your customer</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                <div className="space-y-3">
                                    {plans.map((plan) => (
                                        <div key={plan.id} className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value={plan.id} id={plan.id} />
                                            <Label
                                                htmlFor={plan.id}
                                                className="flex flex-1 flex-col cursor-pointer rounded-lg border p-4 hover:bg-accent"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-semibold">{plan.name}</div>
                                                        <div className="text-sm text-muted-foreground">{plan.description}</div>
                                                    </div>
                                                    <div className="text-lg font-bold">
                                                        ${plan.amount}
                                                        <span className="text-sm font-normal text-muted-foreground">
                                                            /{plan.interval}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </RadioGroup>
                        </CardContent>
                    </Card>

                    {/* Customer Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Details</CardTitle>
                            <CardDescription>Enter the customer's wallet address</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="customerWallet">Customer Wallet Address</Label>
                                <div className="relative">
                                    <Input
                                        id="customerWallet"
                                        placeholder="Enter Solana wallet address"
                                        value={customerWalletAddress}
                                        onChange={(e) => setCustomerWalletAddress(e.target.value)}
                                        className={`pr-10 transition-all ${customerWalletAddress && !isValidAddress
                                                ? 'border-red-500 focus-visible:ring-red-500'
                                                : isValidAddress
                                                    ? 'border-green-500 focus-visible:ring-green-500'
                                                    : ''
                                            }`}
                                    />
                                    {customerWalletAddress && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {isValidAddress ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in duration-200" />
                                            ) : (
                                                <AlertCircle className="h-5 w-5 text-red-500 animate-in zoom-in duration-200" />
                                            )}
                                        </div>
                                    )}
                                </div>
                                {customerWalletAddress && !isValidAddress && (
                                    <p className="text-sm text-red-500 flex items-center gap-1 animate-in slide-in-from-top-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Invalid Solana address
                                    </p>
                                )}
                                {isValidAddress && (
                                    <p className="text-sm text-green-500 flex items-center gap-1 animate-in slide-in-from-top-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Valid address
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Summary Section */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-6">
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedPlan ? (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Plan</span>
                                            <span className="font-medium">{selectedPlan.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Amount</span>
                                            <span className="font-medium">${selectedPlan.amount}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Frequency</span>
                                            <span className="font-medium capitalize">{selectedPlan.interval}</span>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4">
                                        <div className="space-y-1 text-sm">
                                            <p className="font-medium">Features:</p>
                                            <ul className="space-y-1 text-muted-foreground">
                                                {selectedPlan.features.map((feature, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={!selectedPlanId || !isValidAddress || step !== 'form'}
                                    >
                                        {step === 'form' && 'Create Subscription'}
                                        {step === 'signing' && (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Preparing...
                                            </>
                                        )}
                                        {step === 'confirming' && (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Confirming...
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Select a plan to continue
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </form>
        </div>
    );
}
