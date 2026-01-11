import { useState } from 'react';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useAuth } from '@/hooks/use-auth';
import { SubscriptionCard } from '@/components/subscription-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Filter } from 'lucide-react';
import { Link } from 'wouter';
import { LoadingSpinner } from '@/components/loading-spinner';
import { EmptyState } from '@/components/empty-state';
import { SubscriptionListSkeleton } from '@/components/skeleton-loaders';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function SubscriptionList() {
    const { walletAddress } = useAuth();
    const { subscriptions, isLoading } = useSubscriptions();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [viewType, setViewType] = useState<'merchant' | 'customer'>('merchant');

    // Filter subscriptions based on user role and status
    const filteredSubscriptions = subscriptions?.filter((sub) => {
        const matchesView = viewType === 'merchant'
            ? sub.invoicerWalletAddress === walletAddress
            : sub.customerWalletAddress === walletAddress;

        const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;

        return matchesView && matchesStatus;
    }) || [];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 bg-muted rounded w-1/3 animate-pulse"></div>
                <SubscriptionListSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your recurring billing subscriptions
                    </p>
                </div>
                <Link href="/subscriptions/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Subscription
                    </Button>
                </Link>
            </div>

            {/* View Toggle & Filters */}
            <div className="flex items-center gap-4">
                <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'merchant' | 'customer')}>
                    <TabsList>
                        <TabsTrigger value="merchant" id="tour-subscription-create">As Merchant</TabsTrigger>
                        <TabsTrigger value="customer">As Customer</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 ml-auto">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="pending_confirmation">Pending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Subscriptions Grid */}
            {filteredSubscriptions.length === 0 ? (
                <EmptyState
                    icon={Plus}
                    title="No subscriptions found"
                    description={
                        statusFilter !== 'all'
                            ? `No ${statusFilter} subscriptions in this view`
                            : viewType === 'merchant'
                                ? 'Create your first subscription to start recurring billing'
                                : "You don't have any active subscriptions as a customer"
                    }
                    actionLabel={viewType === 'merchant' ? 'Create Subscription' : undefined}
                    actionHref={viewType === 'merchant' ? '/subscriptions/create' : undefined}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSubscriptions.map((subscription, index) => (
                        <div
                            key={subscription.id}
                            className="animate-in fade-in slide-in-from-bottom-4"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            <SubscriptionCard
                                subscription={subscription}
                                viewType={viewType}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Summary Stats */}
            {filteredSubscriptions.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3 pt-6 border-t">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Total Subscriptions</p>
                        <p className="text-2xl font-bold">{filteredSubscriptions.length}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Active</p>
                        <p className="text-2xl font-bold text-green-600">
                            {filteredSubscriptions.filter((s) => s.status === 'active').length}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Cancelled</p>
                        <p className="text-2xl font-bold text-muted-foreground">
                            {filteredSubscriptions.filter((s) => s.status === 'cancelled').length}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
