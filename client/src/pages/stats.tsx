import { BarChart3, Activity, Users, Shield, Zap, Globe } from "lucide-react";

import { useTokenStats } from "@/hooks/use-token-stats";
import { useWebSocketStats } from "@/hooks/use-websocket-stats";
import { useQuery } from "@tanstack/react-query";

export default function Stats() {
    const { data: tokenStats, isLoading: isStatsLoading } = useTokenStats();

    // Add interface for tokenStats to fix TS error if not exported (or just assume shape)
    const solPrice = tokenStats?.solPrice || 0;

    // Use WebSocket for real-time global platform stats
    const { globalStats, isConnected } = useWebSocketStats();

    // Fetch system health for Glass Citadel status
    const { data: healthData } = useQuery({
        queryKey: ['system-health'],
        queryFn: async () => {
            const res = await fetch('/health');
            if (!res.ok) throw new Error('Health check failed');
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30s
        staleTime: 10000,
    });

    // Fallback: If WS is not connected (initial load), we might want to fetch once? 
    // Or just let the WS connect. For now, since we want "tracking", we rely on WS.

    const isTokenVolumeValid = tokenStats?.volume24h && Number(tokenStats.volume24h) > 0;
    const displayVolume = isTokenVolumeValid
        ? `$${(Number(tokenStats?.volume24h || 0) / 1000).toFixed(1)}K+`
        : `$${Number(globalStats?.totalVolume || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Calculate Total Settled Volume in USD
    // If volumes array exists (new backend), use it. Else fall back to totalPaidVolume (legacy raw sum).
    let totalSettledValueUsd = 0;

    // Check if we have SOL volume but no price yet
    let hasSolVolume = false;

    if (globalStats?.volumes && globalStats.volumes.length > 0) {
        // Iterate currencies and convert
        globalStats.volumes.forEach(v => {
            const currency = (v.currency || "").toUpperCase();
            if (currency === "SOL") {
                hasSolVolume = true;
                totalSettledValueUsd += Number(v.amount) * solPrice;
            } else {
                // Assume 1:1 for stablecoins (USDC, USDT, PYUSD, EURC)
                // In a perfect world, we'd fetch EUR exchange rate too, but 1:1 is close enough for beta
                totalSettledValueUsd += Number(v.amount);
            }
        });
    } else {
        // Legacy/Fallback: If no breakdown, assume it's stablecoin USD or just raw sum
        totalSettledValueUsd = Number(globalStats?.totalPaidVolume || 0);
    }

    const isPriceLoading = hasSolVolume && solPrice === 0 && isStatsLoading;
    const displayPaidVolume = isPriceLoading
        ? "..."
        : `$${totalSettledValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const stats = [
        {
            label: isTokenVolumeValid ? "Total Token Volume (24h)" : "Total Platform Volume",
            value: isStatsLoading ? "..." : displayVolume,
            change: isTokenVolumeValid ? `${Number(tokenStats?.priceChange24h || 0).toFixed(2)}%` : "Internal",
            icon: <BarChart3 className="w-5 h-5 text-primary" />
        },
        {
            label: "Transaction Speed",
            value: "Fast",
            change: "Optimal",
            icon: <Zap className="w-5 h-5 text-primary" />
        },
        {
            label: "Total Invoices Created", // Updated label
            value: (globalStats?.totalInvoices || 0).toLocaleString(),
            change: isConnected ? "Live" : "Connecting...",
            icon: <Activity className={`w-5 h-5 ${isConnected ? "text-green-500 animate-pulse" : "text-primary"}`} />
        },
        {
            label: "Unique Wallets (Users)", // Updated label
            value: (globalStats?.totalUsers || 0).toLocaleString(),
            change: isConnected ? "Live" : "Connecting...",
            icon: <Users className="w-5 h-5 text-primary" />
        },
        {
            label: "Total Settled Volume", // New Card
            value: displayPaidVolume,
            change: isConnected ? "Live" : "Connecting...",
            icon: <Shield className="w-5 h-5 text-green-400" />
        },
        {
            label: "Network Uptime",
            value: "100%",
            change: "Stable",
            icon: <Globe className="w-5 h-5 text-primary" />
        },
        {
            label: "Encrypted Transactions",
            value: (globalStats?.encryptedInvoices || 0).toLocaleString(),
            change: isConnected ? "Live" : "Connecting...",
            icon: <Shield className="w-5 h-5 text-primary" />
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">System Statistics</h1>
                    <p className="text-muted-foreground">Real-time performance metrics of the SolanaInvoice protocol</p>
                </div>
                {isConnected && (
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                )}
            </div>

            {/* Native Token Contract */}
            <div className="card-flat p-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="text-2xl">🔷</div>
                    <h3 className="text-lg font-semibold text-foreground">INVOIX Native Token</h3>
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    <code className="text-sm md:text-base font-mono bg-background/50 px-4 py-2 rounded-lg border border-border/50 text-foreground">
                        AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump
                    </code>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText('AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump');
                        }}
                        className="px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                    >
                        Copy
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="card-flat p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                        <div className="relative z-10 flex items-center justify-between mb-4">
                            <div className="p-3 bg-primary/10 rounded-lg">
                                {stat.icon}
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.change === "Live" ? "bg-green-500/10 text-green-500" :
                                stat.change.startsWith("+") ? "bg-green-500/10 text-green-500" :
                                    stat.change.startsWith("-") ? "bg-blue-500/10 text-blue-500" :
                                        "bg-muted text-muted-foreground"
                                }`}>
                                {stat.change}
                            </span>
                        </div>
                        <div className="text-3xl font-bold mb-1 text-foreground">{stat.value}</div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* System Health */}
            <div className="card-flat p-8 rounded-xl shadow-sm">
                <h2 className="text-2xl font-bold mb-6 text-foreground text-center">System Health</h2>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">API Status</div>
                            <div className={`text-xl font-mono ${healthData?.status === 'healthy' ? 'text-green-500' : healthData?.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'}`}>
                                {healthData?.status === 'healthy' ? 'Operational' : healthData?.status === 'degraded' ? 'Degraded' : 'Checking...'}
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">Database</div>
                            <div className={`text-xl font-mono ${healthData?.checks?.database?.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                                {healthData?.checks?.database?.status === 'ok' ? `${healthData?.checks?.database?.latency || 0}ms` : 'Error'}
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">Arcium Privacy</div>
                            <div className={`text-xl font-mono ${healthData?.checks?.environment?.info?.arciumEnabled ? 'text-green-500' : 'text-yellow-500'}`}>
                                {healthData?.checks?.environment?.info?.arciumEnabled ? 'Active' : 'Standby'}
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl relative overflow-hidden transition-all duration-500 ${healthData?.checks?.glassCitadel?.status === 'ok'
                                ? 'bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent border-2 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                                : healthData?.checks?.glassCitadel?.status === 'degraded'
                                    ? 'bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/30'
                                    : 'bg-background/50 border border-border/50'
                            }`}>
                            {/* Animated glow ring when active */}
                            {healthData?.checks?.glassCitadel?.status === 'ok' && (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-400/5 to-emerald-500/10 animate-pulse pointer-events-none" />
                                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-transparent to-cyan-500/20 blur-xl opacity-50 animate-pulse pointer-events-none" />
                                </>
                            )}

                            <div className="relative z-10 flex items-center gap-2 mb-1">
                                <Shield className={`w-4 h-4 ${healthData?.checks?.glassCitadel?.status === 'ok'
                                        ? 'text-emerald-400 animate-pulse'
                                        : 'text-muted-foreground'
                                    }`} />
                                <span className="text-sm text-muted-foreground">Glass Citadel™</span>
                            </div>

                            <div className={`relative z-10 text-xl font-mono font-bold ${healthData?.checks?.glassCitadel?.status === 'ok'
                                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : healthData?.checks?.glassCitadel?.status === 'degraded'
                                        ? 'text-yellow-500'
                                        : 'text-muted-foreground'
                                }`}>
                                {healthData?.checks?.glassCitadel?.status === 'ok' ? '● Active' : healthData?.checks?.glassCitadel?.status === 'degraded' ? '◐ Partial' : '○ Disabled'}
                            </div>

                            {healthData?.checks?.glassCitadel?.status === 'ok' && (
                                <div className="relative z-10 text-[10px] text-emerald-400/70 mt-1 font-mono">
                                    Audit Trail Ready
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
