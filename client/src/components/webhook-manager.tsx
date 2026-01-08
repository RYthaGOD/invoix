
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Trash2,
    RefreshCw,
    Eye,
    EyeOff,
    Copy,
    Terminal,
    Check,
    AlertTriangle,
    MoreHorizontal,
    Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    status: 'active' | 'disabled';
    consecutiveFailures: number;
    lastDeliveryAt: string | null;
    lastDeliveryStatus: number | null;
    createdAt: string;
}

export function WebhookManager() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
    const [showSecret, setShowSecret] = useState<string | null>(null);

    // Fetch Webhooks
    const { data: webhooks, isLoading } = useQuery({
        queryKey: ['/api/webhooks'],
        queryFn: async () => {
            const res = await fetch('/api/webhooks', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch webhooks');
            const data = await res.json();
            return data.webhooks as Webhook[];
        },
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: { name: string; url: string; events: string[] }) => {
            const res = await fetch('/api/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create webhook');
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
            setIsCreateOpen(false);
            setShowSecret(data.secret);
            toast({ title: 'Webhook Created', description: 'Make sure to copy your signing secret.' });
        },
        onError: (err: Error) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/webhooks/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete webhook');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
            toast({ title: 'Webhook Deleted' });
        },
    });

    // Test Mutation
    const testMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/webhooks/${id}/test`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to send test event');
            return res.json();
        },
        onSuccess: () => {
            toast({ title: 'Test Event Sent', description: 'Check your server logs for the delivery.' });
        },
        onError: (err: Error) => {
            toast({ title: 'Test Failed', description: err.message, variant: 'destructive' });
        },
    });

    const categories = {
        'Invoice Events': ['invoice.created', 'invoice.updated', 'invoice.paid'],
        'Payment Events': ['payment.received', 'payment.confirmed', 'payment.failed'],
        'Subscription Events': ['subscription.created', 'subscription.cancelled'],
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Webhooks</CardTitle>
                            <CardDescription>
                                Listen to real-time events from Invoix. Verified with HMAC signatures.
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Add Endpoint
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>
                    ) : webhooks?.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <Terminal className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium">No Webhooks Configured</h3>
                            <p className="text-muted-foreground mb-4">
                                Create an endpoint to start receiving events.
                            </p>
                            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
                                Create First Webhook
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Delivery</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {webhooks?.map((webhook) => (
                                    <TableRow key={webhook.id}>
                                        <TableCell className="font-medium">{webhook.name || 'Unnamed'}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                                            {webhook.url}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}
                                                className={webhook.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                                                {webhook.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {webhook.lastDeliveryAt ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={
                                                        webhook.lastDeliveryStatus && webhook.lastDeliveryStatus >= 200 && webhook.lastDeliveryStatus < 300
                                                            ? 'text-green-500'
                                                            : 'text-red-500'
                                                    }>
                                                        {webhook.lastDeliveryStatus}
                                                    </span>
                                                    <span>{new Date(webhook.lastDeliveryAt).toLocaleDateString()}</span>
                                                </div>
                                            ) : (
                                                'Never'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => testMutation.mutate(webhook.id)}>
                                                        <Play className="w-4 h-4 mr-2" /> Test Event
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => deleteMutation.mutate(webhook.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Secret Disclosure Dialog */}
            <Dialog open={!!showSecret} onOpenChange={(open) => !open && setShowSecret(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Webhook Signing Secret</DialogTitle>
                        <DialogDescription>
                            This secret is used to verify that events originated from Invoix.
                            Store it securely. It will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all relative group">
                        {showSecret}
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                                navigator.clipboard.writeText(showSecret || '');
                                toast({ title: "Copied to clipboard" });
                            }}
                        >
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowSecret(null)}>I have saved it</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Webhook Dialog */}
            <CreateWebhookDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={(data) => createMutation.mutate(data)}
                isLoading={createMutation.isPending}
                categories={categories}
            />
        </div>
    );
}

function CreateWebhookDialog({
    open,
    onOpenChange,
    onSubmit,
    isLoading,
    categories
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any) => void;
    isLoading: boolean;
    categories: Record<string, string[]>;
}) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, url, events: selectedEvents });
    };

    const toggleEvent = (event: string) => {
        setSelectedEvents(prev =>
            prev.includes(event)
                ? prev.filter(e => e !== event)
                : [...prev, event]
        );
    };

    // Reset form on open
    React.useEffect(() => {
        if (open) {
            setName('');
            setUrl('');
            setSelectedEvents([]);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                    <DialogDescription>
                        Receive HTTP POST requests when specific events occur.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Endpoint Name</Label>
                        <Input
                            placeholder="My Production App"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Endpoint URL</Label>
                        <Input
                            placeholder="https://api.myapp.com/webhooks/invoix"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            required
                            type="url"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Events to subscribe</Label>
                        <ScrollArea className="h-[200px] border rounded-md p-4">
                            <div className="space-y-4">
                                {Object.entries(categories).map(([category, events]) => (
                                    <div key={category}>
                                        <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">
                                            {category}
                                        </h4>
                                        <div className="space-y-2">
                                            {events.map(event => (
                                                <div key={event} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={event}
                                                        checked={selectedEvents.includes(event)}
                                                        onCheckedChange={() => toggleEvent(event)}
                                                    />
                                                    <label
                                                        htmlFor={event}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {event}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading || selectedEvents.length === 0}>
                            {isLoading ? 'Creating...' : 'Create Endpoint'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
