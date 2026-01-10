import { MarketplaceListing } from "./types";
import { Link } from "wouter";
import {
    TrendingUp,
    Shield,
    ShieldAlert,
    ShieldX,
    Clock,
    Eye,
    Lock
} from "lucide-react";

interface ListingCardProps {
    listing: MarketplaceListing;
    onClick: () => void;
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

export const ListingCard = ({ listing, onClick }: ListingCardProps) => {
    const yieldPct = parseFloat(listing.yieldPercentage);
    const daysUntilDue = listing.daysUntilDue;
    const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

    const formatCurrency = (amount: string, currency: string) => {
        const num = parseFloat(amount);
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    };

    const getYieldColor = (yieldPct: number) => {
        if (yieldPct >= 15) return "text-emerald-400";
        if (yieldPct >= 10) return "text-blue-400";
        if (yieldPct >= 5) return "text-yellow-400";
        return "text-gray-400";
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

    return (
        <div
            className="glass-card p-5 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/30 transition-all duration-300 cursor-pointer group"
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-white font-semibold text-lg group-hover:text-purple-300 transition-colors">
                        {listing.invoiceNumber}
                        {listing.isBlind && <Lock className="inline w-4 h-4 ml-2 text-purple-400" />}
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
