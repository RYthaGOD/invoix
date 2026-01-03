import { motion } from "framer-motion";
import { Check, TrendingUp, Users, Activity, Twitter, Flame, Coins, RefreshCw } from "lucide-react";
import { useAnalyticsStats } from "@/hooks/use-analytics";
import { Link } from "wouter";

export function Rewards() {
    const { pageViews, uniqueWallets, isLoading } = useAnalyticsStats();

    return (
        <section id="rewards" className="py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#020617]" />
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/5 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid lg:grid-cols-12 gap-16 items-center">

                    {/* Content Side */}
                    <div className="lg:col-span-7">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold font-mono mb-8 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-default">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                POST-MAINNET ROADMAP
                            </div>

                            <h2 className="font-heading font-bold text-5xl md:text-7xl mb-8 leading-[0.95] tracking-tighter">
                                The <span className="gradient-text">$INVOIX</span><br />
                                Rewards System
                            </h2>

                            <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl text-balance">
                                Built on real transaction volume, real merchants, and real fees.
                                Not speculation—<span className="text-white font-medium">ownership through contribution.</span>
                            </p>

                            <div className="flex flex-col gap-5">
                                {[
                                    {
                                        icon: Coins,
                                        title: "50/50 Revenue Split",
                                        desc: "Half to token holders, half to protocol treasury."
                                    },
                                    {
                                        icon: Flame,
                                        title: "Burn-to-Claim",
                                        desc: "Small token burn to claim rewards. Anti-rent-seeking."
                                    },
                                    {
                                        icon: RefreshCw,
                                        title: "Fee Recycling",
                                        desc: "Fees flow back into liquidity and the marketplace."
                                    }
                                ].map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 + (i * 0.1) }}
                                        className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-lg">{item.title}</div>
                                            <div className="text-muted-foreground text-sm">{item.desc}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <Link href="/tokenomics">
                                <button className="mt-8 px-6 py-3 text-sm font-bold text-primary border border-primary/30 rounded-full hover:bg-primary/10 transition-colors">
                                    Read Full Tokenomics →
                                </button>
                            </Link>
                        </motion.div>
                    </div>

                    {/* Visual Side - Roadmap & Analytics */}
                    <div className="lg:col-span-5 relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="relative"
                        >
                            {/* Abstract Token Prism */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-10 blur-[80px] rounded-full" />

                            <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
                                {/* Decor */}
                                <div className="absolute top-0 right-0 p-8 opacity-20">
                                    <TrendingUp className="w-32 h-32 text-white" />
                                </div>

                                <div className="space-y-8 relative z-10">
                                    <div className="space-y-2">
                                        <div className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Early Adopter Growth</div>
                                        <div className="text-4xl md:text-5xl font-bold font-heading text-white tracking-tighter">
                                            Join the Movement
                                        </div>
                                    </div>

                                    {/* Real Analytics Stats */}
                                    <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/10">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-2 mb-2 text-primary">
                                                <Users className="w-4 h-4" />
                                                <div className="text-xs font-bold uppercase tracking-wider">Community</div>
                                            </div>
                                            <div className="text-2xl font-bold text-white font-mono">
                                                {isLoading ? "..." : uniqueWallets.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-1">Unique Members</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-2 mb-2 text-accent">
                                                <Activity className="w-4 h-4" />
                                                <div className="text-xs font-bold uppercase tracking-wider">Interest</div>
                                            </div>
                                            <div className="text-2xl font-bold text-white font-mono">
                                                {isLoading ? "..." : pageViews.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-1">Platform Hits</div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm mt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium text-white">Roadmap Progress</span>
                                            <span className="text-xs text-blue-400 font-mono">PHASE 2</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full w-[35%] bg-gradient-to-r from-blue-600 to-blue-400 rounded-full animate-pulse" />
                                        </div>
                                    </div>

                                    <a
                                        href="https://x.com/Invoix_Solana"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary w-full h-14 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 mt-4 flex items-center justify-center gap-2 group"
                                    >
                                        <Twitter className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        Follow on X
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
}
