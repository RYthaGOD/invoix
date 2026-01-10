import { MarketplaceStats } from "./types";

interface MarketStatsProps {
    stats: MarketplaceStats | null;
}

export const MarketStats = ({ stats }: MarketStatsProps) => {
    if (!stats) return null;

    return (
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
    );
};
