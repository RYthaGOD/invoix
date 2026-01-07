import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || '';

interface Subscription {
    id: string;
    planId: string;
    invoicerWalletAddress: string;
    customerWalletAddress: string;
    status: 'active' | 'cancelled' | 'pending_confirmation';
    startDate: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt?: string;
    createdAt: string;
    version: number;
    // Plan details (joined)
    plan?: {
        id: string;
        name: string;
        amount: string;
        interval: 'weekly' | 'monthly' | 'yearly';
        intervalCount: number;
    };
}

interface CreateSubscriptionData {
    planId: string;
    customerWalletAddress: string;
    startDate?: string;
}

interface ConfirmSubscriptionData {
    signature: string;
    subscriptionPda: string;
}

/**
 * Hook for managing multiple subscriptions
 */
export function useSubscriptions() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch all subscriptions
    const { data: subscriptions, isLoading, error } = useQuery<Subscription[]>({
        queryKey: ['subscriptions'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/subscriptions`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch subscriptions');
            return res.json();
        },
    });

    // Create subscription (Step 1: Prepare)
    const createSubscription = useMutation({
        mutationFn: async (data: CreateSubscriptionData) => {
            const res = await fetch(`${API_URL}/api/subscriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create subscription');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Confirm subscription creation (Step 2: Confirm)
    const confirmSubscription = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: ConfirmSubscriptionData }) => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to confirm subscription');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            toast({
                title: 'Success',
                description: 'Subscription created successfully!',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    return {
        subscriptions,
        isLoading,
        error,
        createSubscription,
        confirmSubscription,
    };
}

/**
 * Hook for managing a single subscription
 */
export function useSubscription(id: string) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch single subscription
    const { data: subscription, isLoading } = useQuery<Subscription>({
        queryKey: ['subscription', id],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch subscription');
            return res.json();
        },
        enabled: !!id,
    });

    // Prepare cancellation
    const prepareCancel = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}/prepare-cancel`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to prepare cancellation');
            }
            return res.json();
        },
    });

    // Confirm cancellation
    const confirmCancel = useMutation({
        mutationFn: async (data: ConfirmSubscriptionData) => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}/confirm-cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to confirm cancellation');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscription', id] });
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            toast({
                title: 'Cancelled',
                description: 'Subscription cancelled successfully',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Mint invoice (prepare)
    const mintInvoice = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}/mint-invoice`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to prepare invoice mint');
            }
            return res.json();
        },
    });

    // Confirm invoice mint
    const confirmInvoiceMint = useMutation({
        mutationFn: async (data: { signature: string; invoicePda: string }) => {
            const res = await fetch(`${API_URL}/api/subscriptions/${id}/confirm-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to confirm invoice mint');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscription', id] });
            toast({
                title: 'Success',
                description: 'Invoice minted successfully!',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    return {
        subscription,
        isLoading,
        prepareCancel,
        confirmCancel,
        mintInvoice,
        confirmInvoiceMint,
    };
}
