
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Shield, Database, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleExport = async (type: 'invoices' | 'payments') => {
        if (!publicKey) return;

        try {
            // Direct download link
            const url = `/api/exports/${type}?wallet=${publicKey.toBase58()}`;

            // Create temporary link to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}-${publicKey.toBase58().slice(0, 8)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: "Export Started",
                description: `Your ${type} CSV export is downloading.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "Could not download the export file.",
            });
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold font-heading tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account preferences, exports, and security settings.
                </p>
            </div>

            <Tabs defaultValue="exports" className="space-y-6">
                <TabsList className="bg-muted/50 p-1 border border-border/50">
                    <TabsTrigger value="exports" className="gap-2">
                        <Database className="w-4 h-4" />
                        Data & Exports
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="gap-2">
                        <Shield className="w-4 h-4" />
                        Profile & Security
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="exports" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-primary" />
                                Accounting Exports
                            </CardTitle>
                            <CardDescription>
                                Download your transaction history for accounting, tax, and audit purposes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Invoice Export */}
                                <div className="border rounded-lg p-4 space-y-4 hover:bg-accent/5 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">Invoice History</h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                CSV export of all sent and received invoices.
                                                Includes status, amounts, and dates.
                                            </p>
                                        </div>
                                        <div className="bg-primary/10 p-2 rounded-full">
                                            <FileSpreadsheet className="w-5 h-5 text-primary" />
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                        onClick={() => handleExport('invoices')}
                                        disabled={!publicKey}
                                    >
                                        <Download className="w-4 h-4" />
                                        Export Invoices (.csv)
                                    </Button>
                                </div>

                                {/* Payment Export */}
                                <div className="border rounded-lg p-4 space-y-4 hover:bg-accent/5 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">Payment History</h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Detailed ledger of all payments.
                                                Includes valid TX hashes and USD value at time of payment.
                                            </p>
                                        </div>
                                        <div className="bg-primary/10 p-2 rounded-full">
                                            <FileSpreadsheet className="w-5 h-5 text-primary" />
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                        onClick={() => handleExport('payments')}
                                        disabled={!publicKey}
                                    >
                                        <Download className="w-4 h-4" />
                                        Export Payments (.csv)
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4">
                                <div className="flex gap-3">
                                    <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <h4 className="font-medium text-blue-500">Audit Ready data</h4>
                                        <p className="text-sm text-muted-foreground">
                                            All exports include on-chain transaction hashes for independent verification.
                                            USD values are snapshot at the time of transaction for consistent tax reporting.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Business Profile & Identity</CardTitle>
                            <CardDescription>
                                Manage your business branding and on-chain verification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">

                            {/* LOGO UPLOAD SECTION */}
                            <div className="flex bg-muted/20 p-6 rounded-lg border gap-6 items-start">
                                <div className="space-y-2 flex-1">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-blue-500" />
                                        Brand Logo
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Upload your business logo. This will be stamped on every Invoice NFT you issue.
                                        For best results, use a square PNG or JPG (max 2MB).
                                    </p>

                                    <div className="flex items-center gap-4 mt-4">
                                        <Button variant="secondary" onClick={() => document.getElementById('logo-upload')?.click()}>
                                            Upload Logo
                                        </Button>
                                        <input
                                            id="logo-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                // Check size
                                                if (file.size > 2 * 1024 * 1024) {
                                                    toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
                                                    return;
                                                }

                                                // Convert to Base64
                                                const reader = new FileReader();
                                                reader.onload = async () => {
                                                    const base64 = reader.result as string;
                                                    try {
                                                        const res = await fetch('/api/upload', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ fileData: base64, fileName: file.name })
                                                        });
                                                        const data = await res.json();
                                                        if (data.success) {
                                                            toast({ title: "Logo Uploaded", description: "Your branding has been updated." });
                                                            // Invalidate to refresh profile
                                                            queryClient.invalidateQueries({ queryKey: ['/api/business/profile'] });
                                                        } else {
                                                            throw new Error(data.message);
                                                        }
                                                    } catch (err: any) {
                                                        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">Supported: PNG, JPG, SVG</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* IDENTITY MINTING SECTION */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-semibold text-lg">Verified Business Identity</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Mint a non-transferable "Verified Business" NFT to your wallet.
                                        This builds trust with your clients by proving your on-chain history.
                                    </p>
                                </div>

                                <div className="border border-blue-500/20 bg-blue-500/5 p-4 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-blue-900 dark:text-blue-300">Basic Verification</h4>
                                                <p className="text-xs text-blue-700/80 dark:text-blue-400/80">
                                                    Verifies wallet ownership and invoice history.
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={async () => {
                                                if (!publicKey) return;
                                                toast({ title: "Minting Identity...", description: "Please wait while we verify your profile." });
                                                try {
                                                    const res = await fetch('/api/business/mint-identity-nft', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ wallet: publicKey.toBase58() })
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        toast({ title: "Identity Minted!", description: "View your new badge in your wallet." });
                                                    } else {
                                                        throw new Error(data.message);
                                                    }
                                                } catch (err: any) {
                                                    toast({ title: "Minting Failed", description: err.message, variant: "destructive" });
                                                }
                                            }}
                                        >
                                            Mint Badge (Free)
                                        </Button>
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
