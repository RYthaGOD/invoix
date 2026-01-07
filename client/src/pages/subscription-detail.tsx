import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useSubscription } from '@/hooks/use-subscriptions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubscriptionStatusBadge } from '@/components/subscription-status-badge';
import { CancelSubscriptionModal } from '@/components/cancel-subscription-modal';
import { MintInvoiceModal } from '@/components/mint-invoice-modal';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/loading-spinner';
import {
    Calendar,
    DollarSign,
    User,
    ArrowLeft,
    Ban,
    FileText,
    ExternalLink,
    Clock,
} from 'lucide-react';

export default function SubscriptionDetail() {
    const params = useParams<{ id: string }>();
    const id = params.id!;
    const [, setLocation] = useLocation();

    const { subscription, isLoading, prepareCancel, confirmCancel, mintInvoice, confirmInvoiceMint } =
        useSubscription(id);

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [mintModalOpen, setMintModalOpen] = useState(false);

    if (isLoading) {
        return <LoadingSpinner size="lg" message="Loading subscription..." className="min-h-[400px]" />;
    }

    if (!subscription) {
        return (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">Subscription not found</h3>
                <p className="text-muted-foreground mb-6">
                    This subscription doesn't exist or you don't have permission to view it.
                </p>
                <Button onClick={() => setLocation('/subscriptions')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Subscriptions
                </Button>
            </div>
        );
    }

    const isActive = subscription.status === 'active';
    const nextBillingDate = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;
    const daysUntilBilling = nextBillingDate
        ? Math.max(0, Math.ceil((nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Breadcrumbs */}
            <Breadcrumbs
                items={[
                    { label: 'Subscriptions', href: '/subscriptions' },
                    { label: subscription.plan?.name || 'Subscription Details' },
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
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Subscription Details</h1>
                    <p className="text-muted-foreground mt-1">
                        {subscription.plan?.name || 'Subscription'} subscription
                    </p>
                </div>
                <SubscriptionStatusBadge status={subscription.status} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Overview Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Overview</CardTitle>
                            <CardDescription>Subscription details and billing information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <DollarSign className="h-4 w-4" />
                                        <span>Plan</span>
                                    </div>
                                    <p className="text-lg font-semibold">
                                        {subscription.plan?.name || 'Unknown Plan'}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <DollarSign className="h-4 w-4" />
                                        <span>Amount</span>
                                    </div>
                                    <p className="text-lg font-semibold">
                                        ${subscription.plan?.amount || '0.00'}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">
                                            / {subscription.plan?.interval || 'month'}
                                        </span>
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span>Customer</span>
                                    </div>
                                    <p className="text-sm font-mono">
                                        {subscription.customerWalletAddress.slice(0, 8)}...
                                        {subscription.customerWalletAddress.slice(-6)}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span>Merchant</span>
                                    </div>
                                    <p className="text-sm font-mono">
                                        {subscription.invoicerWalletAddress.slice(0, 8)}...
                                        {subscription.invoicerWalletAddress.slice(-6)}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Start Date</p>
                                    <p className="font-medium">
                                        {new Date(subscription.startDate).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Current Period</p>
                                    <p className="font-medium">
                                        {new Date(subscription.currentPeriodStart).toLocaleDateString()} -{' '}
                                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                    </p>
                                </div>

                                {subscription.cancelledAt && (
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Cancelled Date</p>
                                        <p className="font-medium text-red-600">
                                            {new Date(subscription.cancelledAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment History Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                            <CardDescription>Invoices minted from this subscription</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No invoices minted yet</p>
                                <p className="text-sm">
                                    Invoices will appear here when they are minted from this subscription
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions Sidebar */}
                <div className="space-y-6">
                    {/* Next Billing */}
                    {isActive && nextBillingDate && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Next Billing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center py-4">
                                    <div className="text-4xl font-bold">{daysUntilBilling}</div>
                                    <p className="text-sm text-muted-foreground">days remaining</p>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        Due Date
                                    </span>
                                    <span className="font-medium">
                                        {nextBillingDate.toLocaleDateString()}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {isActive && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => setMintModalOpen(true)}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Mint Invoice Now
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-red-600 hover:text-red-600"
                                        onClick={() => setCancelModalOpen(true)}
                                    >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Cancel Subscription
                                    </Button>
                                </>
                            )}

                            {!isActive && (
                                <div className="text-center py-4 text-muted-foreground">
                                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No actions available</p>
                                    <p className="text-xs">Subscription is not active</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Metadata */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">ID</span>
                                <span className="font-mono text-xs">{id.slice(0, 12)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Version</span>
                                <Badge variant="outline">{subscription.version}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{new Date(subscription.createdAt).toLocaleDateString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <CancelSubscriptionModal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                subscription={subscription}
                onPrepareCancel={() => prepareCancel.mutateAsync()}
                onConfirmCancel={(data) => confirmCancel.mutateAsync(data)}
            />

            <MintInvoiceModal
                isOpen={mintModalOpen}
                onClose={() => setMintModalOpen(false)}
                subscription={subscription}
                onPrepareMint={() => mintInvoice.mutateAsync()}
                onConfirmMint={(data) => confirmInvoiceMint.mutateAsync(data)}
            />
        </div>
    );
}
