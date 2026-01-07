import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubscriptionStatusBadgeProps {
    status: 'active' | 'cancelled' | 'pending_confirmation';
    className?: string;
}

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
    const variants = {
        active: {
            label: 'Active',
            className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20',
        },
        cancelled: {
            label: 'Cancelled',
            className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20',
        },
        pending_confirmation: {
            label: 'Pending',
            className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20',
        },
    };

    const variant = variants[status];

    return (
        <Badge variant="outline" className={cn(variant.className, className)}>
            {variant.label}
        </Badge>
    );
}
