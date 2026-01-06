/**
 * Marketplace Listing Detail Page
 * 
 * Displays detailed information about a specific invoice listing
 * with purchase functionality.
 */

import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
    ArrowLeft,
    Clock,
    DollarSign,
    TrendingUp,
    Shield,
    ShieldAlert,
    ShieldX,
    AlertTriangle,
    Calendar,
    Eye,
    Heart,
    ExternalLink,
    Copy,
    Check,
    User,
    BadgeCheck,
    Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface ListingDetail {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    faceValue: string;
    askingPrice: string;
    discountRate: string;
    yieldPercentage: string;
    currency: string;
    status: string;
    riskScore: number;
    riskLevel: string;
    riskFlags: string[];
    sellerCreditScore: number;
    sellerCreditTier: string;
    customerCreditScore: number | null;
    dueDate: string;
    invoiceDate: string;
    daysUntilDue: number;
    listedAt: string;
    expiresAt: string | null;
    viewCount: number;
    watchlistCount: number;
    description: string | null;
    nftMint: string;
    seller: string;
    invoicee: string;
}

const riskConfig = {
    low: {
        label: "Low Risk",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
        icon: Shield,
        description: "Strong seller and customer credit scores, reasonable time to maturity."
    },
    medium: {
        label: "Medium Risk",
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
        icon: Shield,
        description: "Adequate credit history, some factors to consider."
    },
    high: {
        label: "High Risk",
        color: "bg-orange-500/20 text-orange-400 border-orange-500/50",
        icon: ShieldAlert,
        description: "Elevated risk factors present. Due diligence recommended."
    },
    very_high: {
        label: "Very High Risk",
        color: "bg-red-500/20 text-red-400 border-red-500/50",
        icon: ShieldX,
        description: "Multiple risk flags detected. Invest with caution."
    },
};

const tierConfig: Record<string, { label: string; color: string }> = {
    prime: { label: "Prime", color: "text-emerald-400" },
    standard: { label: "Standard", color: "text-blue-400" },
    fair: { label: "Fair", color: "text-yellow-400" },
    developing: { label: "Developing", color: "text-orange-400" },
    new: { label: "New", color: "text-gray-400" },
};

export default function MarketplaceListing() {
    const params = useParams<{ id: string }>();
    const [, navigate] = useLocation();
    const { walletAddress } = useAuth();
    const { connected, sendTransaction } = useWallet();
    const { connection } = useConnection();

    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (params.id) {
            loadListing();
        }
    }, [params.id]);

    const loadListing = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/marketplace/listings/${params.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Listing not found");
                }
                throw new Error("Failed to load listing");
            }

            const data = await response.json();
            setListing(data.listing);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!connected || !walletAddress) {
            toast({
                title: "Connect Wallet",
                description: "Please connect your wallet to purchase this invoice.",
                variant: "destructive",
            });
            return;
        }

        setPurchasing(true);
        try {
            // 1. Get Transaction from API
            const response = await fetch("/api/marketplace/purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    listingId: listing?.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create purchase transaction");
            }

            if (!data.transaction) {
                throw new Error("Invalid response: No transaction returned");
            }

            // 2. Sign and Send
            const transactionBuffer = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            toast({
                title: "Awaiting Signature",
                description: "Please approve the purchase (Payment + Transfer) in your wallet.",
            });

            // Buyer signs
            const signature = await sendTransaction(transaction, connection);

            toast({
                title: "Processing Purchase",
                description: "Transaction sent. Waiting for blockchain confirmation...",
            });

            await connection.confirmTransaction(signature, 'confirmed');

            // 3. Confirm with Backend (for DB update if not using webhooks/indexer)
            // Optional: The API might update on next query or we can hit a confirm endpoint.
            // But usually we just reload.
            // Ideally we call /api/marketplace/confirm-purchase or similar if needed.
            // Previous audit mentioned `POST /api/marketplace/confirm-purchase` implementation.
            await fetch("/api/marketplace/confirm-purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signature, listingId: listing?.id }),
            });

            toast({
                title: "Purchase Successful!",
                description: "Invoice asset transferred to your wallet.",
            });

            // Reload listing to show sold status
            loadListing();

        } catch (err: any) {
            console.error("Purchase failed:", err);
            toast({
                title: "Purchase Failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setPurchasing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatCurrency = (amount: string, currency: string) => {
        const num = parseFloat(amount);
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getYieldColor = (yieldPct: number) => {
        if (yieldPct >= 15) return "text-emerald-400";
        if (yieldPct >= 10) return "text-blue-400";
        if (yieldPct >= 5) return "text-yellow-400";
        return "text-gray-400";
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-64" />
                        <Skeleton className="h-48" />
                    </div>
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    if (error || !listing) {
        return (
            <div className="glass-card p-12 text-center">
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                    {error || "Listing not found"}
                </h3>
                <p className="text-gray-400 mb-6">
                    This listing may have been sold, cancelled, or doesn't exist.
                </p>
                <Link href="/marketplace">
                    <Button>Back to Marketplace</Button>
                </Link>
            </div>
        );
    }

    const riskInfo = riskConfig[listing.riskLevel as keyof typeof riskConfig] || riskConfig.medium;
    const RiskIcon = riskInfo.icon;
    const yieldPct = parseFloat(listing.yieldPercentage);
    const isUrgent = listing.daysUntilDue <= 7 && listing.daysUntilDue >= 0;
    const tierInfo = tierConfig[listing.sellerCreditTier] || tierConfig.new;

    return (
        <div className="space-y-6">
            {/* Back Navigation */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    className="hover:bg-white/5"
                    onClick={() => navigate("/marketplace")}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Marketplace
                </Button>

                <Badge className={`${riskInfo.color} ml-auto`}>
                    <RiskIcon className="w-4 h-4 mr-1" />
                    {riskInfo.label}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Header Card */}
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                                        <Store className="w-6 h-6 text-purple-400" />
                                        Invoice {listing.invoiceNumber}
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Listed {formatDate(listing.listedAt)}
                                    </CardDescription>
                                </div>

                                <div className="flex items-center gap-2 text-gray-400">
                                    <Eye className="w-4 h-4" />
                                    <span>{listing.viewCount} views</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Face Value</div>
                                    <div className="text-xl font-semibold text-white">
                                        {formatCurrency(listing.faceValue, listing.currency)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buy Price</div>
                                    <div className="text-xl font-bold text-purple-400">
                                        {formatCurrency(listing.askingPrice, listing.currency)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Discount</div>
                                    <div className="text-xl font-semibold text-emerald-400">
                                        {listing.discountRate}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Potential Yield</div>
                                    <div className={`text-xl font-bold flex items-center gap-1 ${getYieldColor(yieldPct)}`}>
                                        <TrendingUp className="w-5 h-5" />
                                        {yieldPct.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risk Assessment */}
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <RiskIcon className={`w-5 h-5 ${riskInfo.color.split(' ')[1]}`} />
                                Risk Assessment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-400">{riskInfo.description}</p>

                            {/* Risk Score Bar */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-400">Risk Score</span>
                                    <span className={riskInfo.color.split(' ')[1]}>{listing.riskScore}/100</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${listing.riskScore <= 25 ? 'bg-emerald-500' :
                                            listing.riskScore <= 50 ? 'bg-yellow-500' :
                                                listing.riskScore <= 75 ? 'bg-orange-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${listing.riskScore}%` }}
                                    />
                                </div>
                            </div>

                            {/* Risk Flags */}
                            {listing.riskFlags && listing.riskFlags.length > 0 && (
                                <div>
                                    <div className="text-sm text-gray-400 mb-2">Risk Flags</div>
                                    <div className="flex flex-wrap gap-2">
                                        {listing.riskFlags.map((flag, i) => (
                                            <span
                                                key={i}
                                                className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded border border-red-500/20"
                                            >
                                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                                {flag.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Invoice Details */}
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Invoice Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Invoice Date</div>
                                    <div className="text-white flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        {formatDate(listing.invoiceDate)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Due Date</div>
                                    <div className={`flex items-center gap-2 ${isUrgent ? 'text-orange-400' : 'text-white'}`}>
                                        <Clock className={`w-4 h-4 ${isUrgent ? 'text-orange-400' : 'text-gray-400'}`} />
                                        {formatDate(listing.dueDate)}
                                        {isUrgent && <span className="text-xs">(Soon!)</span>}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Days Until Due</div>
                                    <div className={isUrgent ? 'text-orange-400 font-semibold' : 'text-white'}>
                                        {listing.daysUntilDue < 0
                                            ? 'Overdue'
                                            : listing.daysUntilDue === 0
                                                ? 'Due today'
                                                : `${listing.daysUntilDue} days`}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Currency</div>
                                    <div className="text-white">{listing.currency}</div>
                                </div>
                            </div>

                            {listing.description && (
                                <div className="pt-4 border-t border-white/10">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Description</div>
                                    <p className="text-gray-300">{listing.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Purchase Card */}
                    <Card className="glass-card border-purple-500/30 bg-purple-500/5">
                        <CardContent className="pt-6">
                            <div className="text-center mb-6">
                                <div className="text-gray-400 text-sm mb-1">Purchase Price</div>
                                <div className="text-4xl font-bold text-white">
                                    {formatCurrency(listing.askingPrice, listing.currency)}
                                </div>
                                <div className={`text-lg mt-2 flex items-center justify-center gap-1 ${getYieldColor(yieldPct)}`}>
                                    <TrendingUp className="w-4 h-4" />
                                    {yieldPct.toFixed(2)}% Potential Yield
                                </div>
                            </div>

                            <Button
                                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-lg py-6"
                                onClick={handlePurchase}
                                disabled={purchasing || listing.status !== 'active'}
                            >
                                {purchasing ? (
                                    <>Processing...</>
                                ) : listing.status !== 'active' ? (
                                    <>Listing Unavailable</>
                                ) : (
                                    <>
                                        <DollarSign className="w-5 h-5 mr-2" />
                                        Purchase Invoice
                                    </>
                                )}
                            </Button>

                            <p className="text-xs text-gray-500 text-center mt-4">
                                By purchasing, you acquire the right to collect payment
                                when the invoice matures.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Seller Info */}
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Seller
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Address</span>
                                <button
                                    className="text-white flex items-center gap-2 hover:text-purple-400 transition-colors"
                                    onClick={() => copyToClipboard(listing.seller)}
                                >
                                    {listing.seller}
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Credit Score</span>
                                <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${tierInfo.color}`}>
                                        {listing.sellerCreditScore}
                                    </span>
                                    <Badge variant="outline" className={tierInfo.color}>
                                        {tierInfo.label}
                                    </Badge>
                                </div>
                            </div>

                            {listing.customerCreditScore && (
                                <div className="pt-4 border-t border-white/10">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Customer (Payer)</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Credit Score</span>
                                        <span className="text-white">{listing.customerCreditScore}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* NFT Info */}
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BadgeCheck className="w-5 h-5 text-purple-400" />
                                NFT Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Mint Address</div>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded truncate flex-1">
                                            {listing.nftMint}
                                        </code>
                                        <a
                                            href={`https://solscan.io/token/${listing.nftMint}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-400 hover:text-purple-300"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
