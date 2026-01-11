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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
    Lock,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MarketStats } from "@/components/marketplace/market-stats";
import { MarketplaceListing, MarketplaceStats, AccessRequest } from "@/components/marketplace/types";

// Interfaces moved to @/components/marketplace/types

export default function Marketplace() {
    const [location, navigate] = useLocation();
    const { walletAddress } = useAuth();
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [stats, setStats] = useState<MarketplaceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Access Requests State
    const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

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
        } else {
            loadPendingRequests();
        }
    }, [currencyFilter, riskFilter, sortBy, sortOrder, location, walletAddress]);

    const loadPendingRequests = async () => {
        if (!walletAddress) return;
        setLoadingRequests(true);
        try {
            const res = await fetch("/api/marketplace/access-requests/pending");
            if (res.ok) {
                const data = await res.json();
                setPendingRequests(data.requests || []);
            }
        } catch (error) {
            console.error("Failed to load requests", error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleAccessAction = async (requestId: string, action: 'approve' | 'reject') => {
        try {
            const res = await fetch(`/api/marketplace/access-requests/${requestId}/${action}`, {
                method: "POST"
            });

            if (res.ok) {
                toast({
                    title: `Access ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                    description: "The buyer has been notified."
                });
                // Remove from list
                setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
            }
        } catch (error) {
            toast({
                title: "Action Failed",
                description: "Something went wrong.",
                variant: "destructive"
            });
        }
    };

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

    // Helper functions moved to components

    function renderListingsContent() {
        return (
            <>
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
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                                onClick={() => navigate(`/marketplace/${listing.id}`)}
                            />
                        ))}
                    </div>
                )}

                {/* Load More */}
                {filteredListings.length >= 20 && (
                    <div className="text-center mt-6">
                        <Button variant="outline" className="border-white/10 hover:bg-white/5">
                            Load More Listings
                        </Button>
                    </div>
                )}
            </>
        );
    }

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

            {/* My Listings & Requests Tabs */}
            {isMyListings ? (
                <Tabs defaultValue="listings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10">
                        <TabsTrigger value="listings">Active Listings</TabsTrigger>
                        <TabsTrigger value="requests" className="relative">
                            Access Requests
                            {pendingRequests.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="listings" className="mt-6">
                        {renderListingsContent()}
                    </TabsContent>

                    <TabsContent value="requests" className="mt-6">
                        {loadingRequests ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                            </div>
                        ) : pendingRequests.length === 0 ? (
                            <div className="glass-card p-12 text-center text-gray-400">
                                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No pending access requests.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pendingRequests.map(request => (
                                    <div key={request.requestId} className="glass-card p-4 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-white">{request.invoiceNumber}</span>
                                                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                                    Blind Listing
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-gray-400 mb-2">
                                                Buyer: <span className="text-gray-300 font-mono">{request.buyerWallet.slice(0, 6)}...{request.buyerWallet.slice(-4)}</span>
                                            </div>
                                            <div className="text-xs bg-white/5 p-2 rounded text-gray-300 italic">
                                                "{request.message}"
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                onClick={() => handleAccessAction(request.requestId, 'reject')}
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                                onClick={() => handleAccessAction(request.requestId, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            ) : (
                <>
                    {/* Stats Cards */}
                    <MarketStats stats={stats} />

                    {/* Filters */}
                    <div className="glass-card p-4">
                        <div className="flex flex-col md:flex-row gap-4" id="tour-marketplace-filter">
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

                    {renderListingsContent()}
                </>
            )}
        </div>
    );
}
