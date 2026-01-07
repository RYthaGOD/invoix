import { Card } from '@/components/ui/card';

export function SubscriptionCardSkeleton() {
    return (
        <Card className="animate-pulse">
            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <div className="h-5 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                    </div>
                    <div className="h-6 w-16 bg-muted rounded-full"></div>
                </div>

                {/* Content */}
                <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between">
                        <div className="h-4 bg-muted rounded w-20"></div>
                        <div className="h-4 bg-muted rounded w-24"></div>
                    </div>
                    <div className="flex justify-between">
                        <div className="h-4 bg-muted rounded w-24"></div>
                        <div className="h-4 bg-muted rounded w-20"></div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

export function SubscriptionListSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <SubscriptionCardSkeleton key={i} />
            ))}
        </div>
    );
}
