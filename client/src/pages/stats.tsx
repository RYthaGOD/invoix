import { Link } from "wouter";
import { ArrowLeft, BarChart3, Activity, Users, Shield, Zap, Globe } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";

import { useTokenStats } from "@/hooks/use-token-stats";
import { useWebSocketStats } from "@/hooks/use-websocket-stats";
import { useQuery } from "@tanstack/react-query";

export default function Stats() {
    const { data: tokenStats, isLoading: isStatsLoading } = useTokenStats();

    // Use WebSocket for real-time global platform stats
    const { globalStats, isConnected } = useWebSocketStats();

    // Fallback: If WS is not connected (initial load), we might want to fetch once? 
    // Or just let the WS connect. For now, since we want "tracking", we rely on WS.

    const isTokenVolumeValid = tokenStats?.volume24h && Number(tokenStats.volume24h) > 0;
    const displayVolume = isTokenVolumeValid
        ? `$${(Number(tokenStats?.volume24h || 0) / 1000).toFixed(1)}K+`
        : `$${Number(globalStats?.totalVolume || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const displayPaidVolume = `$${Number(globalStats?.totalPaidVolume || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
            {/* Navbar */}
            <nav className="glass border-b border-border/50 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/">
                            <div className="flex items-center space-x-2 cursor-pointer group">
                                <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                    Back to Home
                                </span>
                            </div>
                        </Link>

                        <div className="flex items-center space-x-2">
                            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                                System Statistics
                            </span>
                            {isConnected && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                            )}
                        </div>

                        <WalletButton />
                    </div>
                </div>
            </nav>

            {/* Stats Content */}
            <section className="container mx-auto px-6 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">Network Status & Analytics</h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Real-time performance metrics of the SolanaInvoice protocol.
                    </p>

                    {/* Native Token Contract */}
                    <div className="mt-8 glass-strong p-6 rounded-xl max-w-3xl mx-auto smoke-shadow">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="text-2xl">🔷</div>
                            <h3 className="text-lg font-semibold">INVOIX Native Token</h3>
                        </div>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <code className="text-sm md:text-base font-mono bg-background/50 px-4 py-2 rounded-lg border border-border/50">
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
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {stats.map((stat, index) => (
                        <div key={index} className="glass-card p-6 rounded-xl smoke-shadow hover:glass-strong transition-all">
                            <div className="flex items-center justify-between mb-4">
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
                            <div className="text-3xl font-bold mb-1">{stat.value}</div>
                            <div className="text-sm text-muted-foreground">{stat.label}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 glass-strong p-8 rounded-2xl max-w-4xl mx-auto smoke-shadow text-center">
                    <h2 className="text-2xl font-bold mb-4">System Health</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">API Status</div>
                            <div className="text-xl font-mono text-green-500">Operational</div>
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">Solana Network</div>
                            <div className="text-xl font-mono text-green-500">Operational</div>
                        </div>
                        <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                            <div className="text-sm text-muted-foreground mb-1">Arcium Privacy</div>
                            <div className="text-xl font-mono text-green-500">Active</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
