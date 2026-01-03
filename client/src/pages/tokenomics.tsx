import { motion } from "framer-motion";
import { Link } from "wouter";
import { Coins, Flame, RefreshCw, TrendingUp, Shield, Users, ArrowLeft, ExternalLink } from "lucide-react";
import { Navbar, Footer } from "@/components/landing";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
};

export default function Tokenomics() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <Navbar />

            {/* Hero */}
            <section className="pt-40 pb-20 relative overflow-hidden">
                <div className="absolute inset-0 gradient-hero opacity-40 pointer-events-none" />
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <Link href="/">
                        <button className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </button>
                    </Link>

                    <motion.div {...fadeInUp} className="max-w-4xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold font-mono mb-6 border border-blue-500/20">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            POST-MAINNET ROADMAP
                        </div>

                        <h1 className="font-heading font-bold text-5xl md:text-7xl leading-tight tracking-tighter mb-6">
                            The <span className="gradient-text">$INVOIX</span> Token
                        </h1>

                        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                            Invoix is not a speculative experiment. It's a protocol built around
                            <span className="text-white font-medium"> real transaction volume, real merchants, and real fees.</span>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Core Principles */}
            <section className="py-20 container mx-auto px-6">
                <motion.h2 {...fadeInUp} className="font-heading font-bold text-3xl md:text-4xl mb-12">
                    Core Principles
                </motion.h2>

                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: Users,
                            title: "Usage Over Hoarding",
                            description: "Holding tokens alone does not grant disproportionate control. The protocol rewards those who move volume—active merchants."
                        },
                        {
                            icon: Shield,
                            title: "Anti-Extraction Design",
                            description: "The system is built to prevent pure rent-seeking and short-term extraction. Built for builders, not extractors."
                        },
                        {
                            icon: TrendingUp,
                            title: "Transparency",
                            description: "Step-by-step build process with real audits and constraints. No hidden mechanisms."
                        }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            {...fadeInUp}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card p-8 rounded-2xl border border-white/10 hover:border-primary/30 transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                                <item.icon className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Revenue Model */}
            <section className="py-20 bg-white/[0.02] border-y border-white/5">
                <div className="container mx-auto px-6">
                    <motion.h2 {...fadeInUp} className="font-heading font-bold text-3xl md:text-4xl mb-12">
                        Revenue Split Model
                    </motion.h2>

                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                        <motion.div {...fadeInUp} className="glass-card p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                            <div className="text-6xl font-bold text-emerald-400 mb-4">50%</div>
                            <h3 className="text-xl font-bold mb-2">Token Holders</h3>
                            <p className="text-muted-foreground text-sm">
                                Protocol revenue flows to active participants who claim through the burn mechanism.
                            </p>
                        </motion.div>

                        <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="glass-card p-8 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                            <div className="text-6xl font-bold text-blue-400 mb-4">50%</div>
                            <h3 className="text-xl font-bold mb-2">Protocol Treasury</h3>
                            <p className="text-muted-foreground text-sm">
                                Development, liquidity provision, operations, and long-term sustainability.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Key Mechanisms */}
            <section className="py-20 container mx-auto px-6">
                <motion.h2 {...fadeInUp} className="font-heading font-bold text-3xl md:text-4xl mb-12">
                    Key Mechanisms
                </motion.h2>

                <div className="space-y-6 max-w-4xl">
                    {[
                        {
                            icon: Coins,
                            title: "Participation-Based Yield",
                            points: [
                                "Yield is tied to protocol activity, not passive holding.",
                                "Merchants who use the system benefit as it grows.",
                                "Ownership is earned through contribution (invoice volume)."
                            ]
                        },
                        {
                            icon: Flame,
                            title: "Burn-to-Claim Mechanism",
                            points: [
                                "Small token burn required to claim protocol rewards.",
                                "Prevents pure rent-seeking behavior.",
                                "Introduces deflationary pressure tied to actual usage.",
                                "Supports long-term stability over short-term extraction."
                            ]
                        },
                        {
                            icon: RefreshCw,
                            title: "Fee Recycling",
                            points: [
                                "Token-side fees are recycled into the ecosystem.",
                                "Deepens liquidity pools.",
                                "Strengthens price stability.",
                                "Backs the future Invoix Invoice Marketplace."
                            ]
                        }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            {...fadeInUp}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card p-8 rounded-2xl border border-white/10"
                        >
                            <div className="flex items-start gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <item.icon className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                                    <ul className="space-y-2">
                                        {item.points.map((point, j) => (
                                            <li key={j} className="flex items-start gap-3 text-muted-foreground text-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 container mx-auto px-6">
                <motion.div {...fadeInUp} className="glass-card p-12 rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent text-center max-w-3xl mx-auto">
                    <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4">
                        Built for Builders
                    </h2>
                    <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                        Invoix is designed for those who want to build and earn, not extract and exit.
                        Every mechanism rewards real merchants who drive real transaction volume.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/invoices/create">
                            <button className="btn-primary h-14 px-8 text-lg font-bold">
                                Start Using Invoix
                            </button>
                        </Link>
                        <a
                            href="https://x.com/Invoix_Solana"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-14 px-8 text-lg font-bold flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-colors"
                        >
                            Follow Updates
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </motion.div>
            </section>

            <Footer />
        </div>
    );
}
