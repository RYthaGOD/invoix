import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubscriptionStatusBadge } from './subscription-status-badge';
import { Calendar, DollarSign, User, MoreHorizontal } from 'lucide-react';
import { Link } from 'wouter';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Subscription {
    id: string;
    planId: string;
    invoicerWalletAddress: string;
    customerWalletAddress: string;
    status: 'active' | 'cancelled' | 'pending_confirmation';
    startDate: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    plan?: {
        id: string;
        name: string;
        amount: string;
        interval: 'weekly' | 'monthly' | 'yearly';
        intervalCount: number;
    };
}

interface SubscriptionCardProps {
    subscription: Subscription;
    viewType?: 'merchant' | 'customer';
    onCancel?: (id: string) => void;
}

export function SubscriptionCard({ subscription, viewType = 'merchant', onCancel }: SubscriptionCardProps) {
    const nextBillingDate = new Date(subscription.currentPeriodEnd).toLocaleDateString();
    const amount = subscription.plan?.amount || '0';
    const interval = subscription.plan?.interval || 'monthly';
    const planName = subscription.plan?.name || 'Unknown Plan';

    const walletAddress = viewType === 'merchant'
        ? subscription.customerWalletAddress
        : subscription.invoicerWalletAddress;
    const displayAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

    return (
        <Card className="hover:bg-accent/50 transition-colors">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">{planName}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {viewType === 'merchant' ? 'Customer' : 'Merchant'}: {displayAddress}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <SubscriptionStatusBadge status={subscription.status} />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/subscriptions/${subscription.id}`}>
                                        View Details
                                    </Link>
                                </DropdownMenuItem>
                                {subscription.status === 'active' && onCancel && (
                                    <DropdownMenuItem
                                        onClick={() => onCancel(subscription.id)}
                                        className="text-red-600"
                                    >
                                        Cancel Subscription
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>Amount</span>
                    </div>
                    <span className="font-semibold">
                        ${amount} / {interval}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Next Billing</span>
                    </div>
                    <span className="font-medium">
                        {subscription.status === 'active' ? nextBillingDate : 'N/A'}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
