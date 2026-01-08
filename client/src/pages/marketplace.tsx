/**
 * Invoice Marketplace
 * 
 * Browse and purchase discounted invoices for yield.
 * Features:
 * - Filter by currency, risk level, yield
 * - Sort by price, yield, risk, date
 * - Search functionality
 * - Responsive card grid
 * - Risk level badges
 */

import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
    Search,
    Filter,
    TrendingUp,
    Shield,
    ShieldAlert,
    ShieldX,
    Clock,
    DollarSign,
    Eye,
    AlertTriangle,
    ArrowUpDown,
    RefreshCw,
    Store,
    ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MarketplaceListing {
    id: string;
    invoiceNumber: string;
    faceValue: string;
    askingPrice: string;
    discountRate: string;
    yieldPercentage: string;
    currency: string;
    riskScore: number;
    riskLevel: string;
    riskFlags: string[];
    sellerCreditScore: number;
    sellerCreditTier: string;
    customerCreditScore: number | null;
    dueDate: string;
    daysUntilDue: number;
    listedAt: string;
    expiresAt: string | null;
    viewCount: number;
    description: string | null;
    sellerTruncated: string;
}

interface MarketplaceStats {
    activeListings: number;
    totalSold: number;
    totalVolume: string;
    averageYield: string;
}

const riskConfig = {
    low: {
        label: "Low Risk",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
        icon: Shield
    },
    medium: {
        label: "Medium",
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
        icon: Shield
    },
    high: {
        label: "High Risk",
        color: "bg-orange-500/20 text-orange-400 border-orange-500/50",
        icon: ShieldAlert
    },
    very_high: {
        label: "Very High",
        color: "bg-red-500/20 text-red-400 border-red-500/50",
        icon: ShieldX
    },
};

const tierConfig: Record<string, { color: string }> = {
    prime: { color: "text-emerald-400" },
    standard: { color: "text-blue-400" },
    fair: { color: "text-yellow-400" },
    developing: { color: "text-orange-400" },
    new: { color: "text-gray-400" },
};

export default function Marketplace() {
    const [location, navigate] = useLocation();
    const { walletAddress } = useAuth();
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [stats, setStats] = useState<MarketplaceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isMyListings = location === '/marketplace/my-listings';

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [currencyFilter, setCurrencyFilter] = useState<string>("all");
    const [riskFilter, setRiskFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("listedAt");
    const [sortOrder, setSortOrder] = useState<string>("desc");

    useEffect(() => {
        loadListings();
        if (!isMyListings) {
            loadStats();
        }
    }, [currencyFilter, riskFilter, sortBy, sortOrder, location, walletAddress]);

    const loadListings = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                limit: "50",
                sortBy,
                sortOrder,
                ...(currencyFilter !== "all" && { currency: currencyFilter }),
                ...(riskFilter !== "all" && { riskLevel: riskFilter }),
                ...(isMyListings && walletAddress && { seller: walletAddress, status: "all" }),
            });

            const response = await fetch(`/api/marketplace/listings?${params}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error("Failed to load marketplace listings");
            }

            const data = await response.json();
            setListings(data.listings || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await fetch("/api/marketplace/stats");
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            }
        } catch (err) {
            console.error("Failed to load marketplace stats:", err);
        }
    };

    const filteredListings = listings.filter((listing) => {
        const matchesSearch =
            listing.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.sellerTruncated.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    const formatCurrency = (amount: string, currency: string) => {
        const num = parseFloat(amount);
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getRiskBadge = (riskLevel: string) => {
        const config = riskConfig[riskLevel as keyof typeof riskConfig] || riskConfig.medium;
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
    };

    const getYieldColor = (yieldPct: number) => {
        if (yieldPct >= 15) return "text-emerald-400";
        if (yieldPct >= 10) return "text-blue-400";
        if (yieldPct >= 5) return "text-yellow-400";
        return "text-gray-400";
    };

    const ListingCard = ({ listing }: { listing: MarketplaceListing }) => {
        const yieldPct = parseFloat(listing.yieldPercentage);
        const daysUntilDue = listing.daysUntilDue;
        const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

        return (
            <div
                className="glass-card p-5 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/30 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/marketplace/${listing.id}`)}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="text-white font-semibold text-lg group-hover:text-purple-300 transition-colors">
                            {listing.invoiceNumber}
                        </div>
                        <div className="text-gray-400 text-sm mt-0.5">
                            Seller: {listing.sellerTruncated}
                        </div>
                    </div>
                    {getRiskBadge(listing.riskLevel)}
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Face Value</div>
                        <div className="text-gray-300 font-medium">
                            {formatCurrency(listing.faceValue, listing.currency)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buy Price</div>
                        <div className="text-white font-semibold text-lg">
                            {formatCurrency(listing.askingPrice, listing.currency)}
                        </div>
                    </div>
                </div>

                {/* Yield and Discount */}
                <div className="flex items-center justify-between py-3 border-y border-white/10 mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className={`w-4 h-4 ${getYieldColor(yieldPct)}`} />
                        <span className={`font-bold ${getYieldColor(yieldPct)}`}>
                            {yieldPct.toFixed(1)}% Yield
                        </span>
                    </div>
                    <div className="text-gray-400 text-sm">
                        {listing.discountRate}% discount
                    </div>
                </div>

                {/* Details Row */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className={`w-4 h-4 ${isUrgent ? 'text-orange-400' : ''}`} />
                        <span className={isUrgent ? 'text-orange-400 font-medium' : ''}>
                            {daysUntilDue < 0
                                ? 'Overdue'
                                : daysUntilDue === 0
                                    ? 'Due today'
                                    : `${daysUntilDue} days`}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Eye className="w-4 h-4" />
                        <span>{listing.viewCount}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-gray-500">Score:</span>
                        <span className={tierConfig[listing.sellerCreditTier]?.color || 'text-gray-400'}>
                            {listing.sellerCreditScore}
                        </span>
                    </div>
                </div>

                {/* Risk Flags */}
                {listing.riskFlags && listing.riskFlags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {listing.riskFlags.slice(0, 2).map((flag, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20"
                            >
                                {flag.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Store className="w-8 h-8 text-purple-400" />
                        {isMyListings ? "My Listings" : "Invoice Marketplace"}
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {isMyListings
                            ? "Manage your active and expired listings"
                            : "Purchase discounted invoices for yield • Powered by RWA tokenization"}
                    </p>
                </div>

                <div className="flex gap-3">
                    {walletAddress && !isMyListings && (
                        <>
                            <Link href="/marketplace/my-listings">
                                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                                    My Listings
                                </Button>
                            </Link>
                            <Link href="/marketplace/my-investments">
                                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                                    My Investments
                                </Button>
                            </Link>
                        </>
                    )}
                    {isMyListings && (
                        <Link href="/marketplace">
                            <Button variant="outline" className="border-white/10 hover:bg-white/5">
                                Back to Browse
                            </Button>
                        </Link>
                    )}
                    <Button
                        onClick={loadListings}
                        variant="outline"
                        className="border-white/10 hover:bg-white/5"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-card p-5 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors"></div>
                        <div className="text-xs font-bold text-purple-300/80 mb-2 uppercase tracking-widest relative z-10">Active Listings</div>
                        <div className="text-4xl font-bold text-purple-400 relative z-10">{stats.activeListings}</div>
                    </div>

                    <div className="glass-card p-5 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                        <div className="text-xs font-bold text-blue-300/80 mb-2 uppercase tracking-widest relative z-10">Invoices Sold</div>
                        <div className="text-4xl font-bold text-blue-400 relative z-10">{stats.totalSold}</div>
                    </div>

                    <div className="glass-card p-5 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
                        <div className="text-xs font-bold text-emerald-300/80 mb-2 uppercase tracking-widest relative z-10">Total Volume</div>
                        <div className="text-4xl font-bold text-emerald-400 relative z-10">${stats.totalVolume}</div>
                    </div>

                    <div className="glass-card p-5 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(234,179,8,0.15)] transition-all">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-colors"></div>
                        <div className="text-xs font-bold text-yellow-300/80 mb-2 uppercase tracking-widest relative z-10">Avg. Yield</div>
                        <div className="text-4xl font-bold text-yellow-400 relative z-10">{stats.averageYield}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="glass-card p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search listings..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                        />
                    </div>

                    {/* Currency Filter */}
                    <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                        <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
                            <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Currencies</SelectItem>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="USDT">USDT</SelectItem>
                            <SelectItem value="SOL">SOL</SelectItem>
                            <SelectItem value="EURC">EURC</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Risk Filter */}
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                        <SelectTrigger className="w-[150px] bg-white/5 border-white/10">
                            <SelectValue placeholder="Risk Level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Risk Levels</SelectItem>
                            <SelectItem value="low">Low Risk</SelectItem>
                            <SelectItem value="medium">Medium Risk</SelectItem>
                            <SelectItem value="high">High Risk</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Sort */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
                            <ArrowUpDown className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="listedAt">Listed Date</SelectItem>
                            <SelectItem value="yield">Yield</SelectItem>
                            <SelectItem value="price">Price</SelectItem>
                            <SelectItem value="risk">Risk Score</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Listings Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card p-5 animate-pulse">
                            <div className="h-6 bg-white/10 rounded mb-4 w-2/3"></div>
                            <div className="h-4 bg-white/10 rounded mb-2 w-1/2"></div>
                            <div className="h-8 bg-white/10 rounded mb-4"></div>
                            <div className="h-10 bg-white/10 rounded"></div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="glass-card p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400 mb-4">{error}</p>
                    <Button onClick={loadListings} variant="outline">
                        Try Again
                    </Button>
                </div>
            ) : filteredListings.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <Store className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Listings Found</h3>
                    <p className="text-gray-400 mb-6">
                        {searchTerm || currencyFilter !== 'all' || riskFilter !== 'all'
                            ? "Try adjusting your filters to see more results"
                            : "Be the first to list an invoice on the marketplace!"}
                    </p>
                    {walletAddress && (
                        <Link href="/invoices">
                            <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                                <DollarSign className="w-4 h-4 mr-2" />
                                List Your Invoice
                            </Button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredListings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))}
                </div>
            )}

            {/* Load More */}
            {filteredListings.length >= 20 && (
                <div className="text-center">
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">
                        Load More Listings
                    </Button>
                </div>
            )}
        </div>
    );
}
