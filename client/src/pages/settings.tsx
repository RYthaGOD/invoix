
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Shield, Database, FileSpreadsheet, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import { BusinessProfileForm } from '@/components/business-profile-form';
import { WebhookManager } from '@/components/webhook-manager';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Ensure Buffer is available in browser
if (typeof window !== 'undefined') {
    (window as any).Buffer = (window as any).Buffer || Buffer;
}

export default function SettingsPage() {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch profile to check if user can mint
    const { data: profileData } = useQuery({
        queryKey: ["/api/business/profile"],
        queryFn: async () => {
            const res = await fetch("/api/business/profile", { credentials: 'include' });
            if (!res.ok) throw new Error("Failed to fetch profile");
            return res.json();
        }
    });

    const hasProfile = !!profileData?.profile;

    const handleExport = async (type: 'invoices' | 'payments') => {
        if (!publicKey) return;

        try {
            toast({
                title: "Preparing Export",
                description: `Generating your ${type} CSV file...`,
            });

            // Use fetch to catch errors
            const url = `/api/exports/${type}?wallet=${publicKey.toBase58()}`;
            const res = await fetch(url, { credentials: 'include' });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error("Session expired. Please login again.");
                }
                throw new Error("Failed to generate export.");
            }

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${type}-${publicKey.toBase58().slice(0, 8)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            toast({
                title: "Export Complete",
                description: `Your ${type} CSV has been downloaded.`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: error.message || "Could not download the export file.",
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
                <TabsList className="bg-muted/50 p-1 border border-border/50" id="tour-profile-settings">
                    <TabsTrigger value="exports" className="gap-2">
                        <Database className="w-4 h-4" />
                        Data & Exports
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="gap-2">
                        <Shield className="w-4 h-4" />
                        Profile & Security
                    </TabsTrigger>
                    <TabsTrigger value="developers" className="gap-2">
                        <Code className="w-4 h-4" />
                        Developers
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

                            {/* BUSINESS DETAILS FORM */}
                            <BusinessProfileForm />

                            <Separator />

                            {/* NOTE: Logo upload is now handled inside the BusinessProfileForm for better UX and atomicity. 
                                Leaving this section as an informative area or removing the duplication would be ideal, 
                                but to avoid UI regression I will comment out the interactive part or leave it as instructions. 
                                Actually, user might look here. I'll make this interact with the same API.
                            */}

                            {/* LOGO UPLOAD SECTION - REDUNDANT BUT KEPT WORKING */}
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
                                        <Button variant="secondary" onClick={() => document.getElementById('settings-logo-upload')?.click()}>
                                            Upload Logo
                                        </Button>
                                        <input
                                            id="settings-logo-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;

                                                if (file.size > 2 * 1024 * 1024) {
                                                    toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
                                                    return;
                                                }

                                                const reader = new FileReader();
                                                reader.onload = async () => {
                                                    const base64 = reader.result as string;
                                                    try {
                                                        const res = await fetch('/api/upload', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            credentials: 'include',
                                                            body: JSON.stringify({ fileData: base64, fileName: file.name })
                                                        });
                                                        const data = await res.json();
                                                        if (data.success) {
                                                            // Fetch current profile to get businessName (required field)
                                                            const profileRes = await fetch('/api/business/profile', {
                                                                credentials: 'include'
                                                            });
                                                            const profileData = await profileRes.json();

                                                            if (profileData.success && profileData.profile) {
                                                                // Update profile with new logo URL
                                                                const updateRes = await fetch('/api/business/profile', {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    credentials: 'include',
                                                                    body: JSON.stringify({
                                                                        businessName: profileData.profile.businessName,
                                                                        businessEmail: profileData.profile.businessEmail || '',
                                                                        businessPhone: profileData.profile.businessPhone || '',
                                                                        businessAddress: profileData.profile.businessAddress || '',
                                                                        businessWebsite: profileData.profile.businessWebsite || '',
                                                                        taxId: profileData.profile.taxId || '',
                                                                        taxRegistrationNumber: profileData.profile.taxRegistrationNumber || '',
                                                                        defaultPaymentTerms: profileData.profile.defaultPaymentTerms || 'Net 30',
                                                                        defaultInvoicePrefix: profileData.profile.defaultInvoicePrefix || 'INV',
                                                                        logoUrl: data.url
                                                                    })
                                                                });
                                                                const updateData = await updateRes.json();
                                                                if (updateData.success) {
                                                                    toast({ title: "Logo Uploaded", description: "Your business logo has been saved!" });
                                                                    // Refresh the page or invalidate query to show new logo
                                                                    window.location.reload();
                                                                } else {
                                                                    throw new Error(updateData.message || 'Failed to save logo to profile');
                                                                }
                                                            } else {
                                                                toast({
                                                                    title: "Logo Uploaded",
                                                                    description: "Please save your business profile first to attach the logo.",
                                                                    variant: "destructive"
                                                                });
                                                            }
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
                                        <span className="text-xs text-muted-foreground">Supported: PNG, JPG (max 2MB)</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* IDENTITY MINTING SECTION */}
                            <div className="space-y-4" id="tour-identity-verification">
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
                                            id="tour-identity-mint-btn"
                                            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!hasProfile}
                                            onClick={async () => {
                                                if (!publicKey || !signTransaction) return;

                                                if (!hasProfile) {
                                                    toast({
                                                        title: "Profile Required",
                                                        description: "Please fill out and SAVE your Business Profile details above before minting your identity.",
                                                        variant: "destructive"
                                                    });
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    return;
                                                }

                                                toast({ title: " preparing Mint...", description: "Please wait..." });
                                                try {
                                                    // 1. Get Transaction from Server
                                                    const res = await fetch('/api/business/mint-identity-nft', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        credentials: 'include',
                                                        body: JSON.stringify({ wallet: publicKey.toBase58() })
                                                    });
                                                    const data = await res.json();

                                                    if (!data.success) {
                                                        throw new Error(data.message);
                                                    }

                                                    const { transaction: txBase64, mint } = data;

                                                    // 2. Deserialize Transaction (Umi produces Versioned Transactions)
                                                    const transaction = VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));

                                                    // 3. User Signs Transaction (Pays 0.008 SOL + Gas)
                                                    toast({ title: "Please Sign", description: "Approve the transaction in your wallet. (Cost: ~0.02 SOL total)" });
                                                    const signedTx = await signTransaction(transaction);

                                                    // 4. Send Transaction
                                                    toast({ title: "Sending...", description: "Confirming on Solana..." });
                                                    const signature = await connection.sendRawTransaction(signedTx.serialize());

                                                    // 5. External Confirmation Call
                                                    // We confirm locally first to ensure UI updates, then tell server
                                                    await connection.confirmTransaction(signature, 'confirmed');

                                                    // 6. Tell Backend it's done
                                                    const confirmRes = await fetch('/api/business/confirm-identity-mint', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        credentials: 'include',
                                                        body: JSON.stringify({ signature, mint })
                                                    });
                                                    const confirmData = await confirmRes.json();

                                                    if (confirmData.success) {
                                                        toast({ title: "Success!", description: "Your Business Identity Badge has been minted." });
                                                        // Invalidate profile query to reflect changes (if badge is shown in profile)
                                                        queryClient.invalidateQueries({ queryKey: ["/api/business/profile"] });
                                                    } else {
                                                        toast({ title: "Minted but not saved?", description: confirmData.message, variant: "destructive" });
                                                    }

                                                } catch (err: any) {
                                                    console.error(err);
                                                    toast({ title: "Minting Failed", description: err.message || "Transaction rejected or failed", variant: "destructive" });
                                                }
                                            }}
                                        >
                                            {!hasProfile ? "Save Profile First" : "Mint Badge (0.008 SOL + Gas)"}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="developers" className="space-y-6">
                    <WebhookManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
