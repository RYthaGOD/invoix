import { motion } from "framer-motion";
import { Zap, Receipt, ShieldCheck, CreditCard, CalendarClock } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
};

export function Features() {
    return (
        <section id="features" className="py-32 container mx-auto px-6">
            <motion.div
                className="text-center mb-24"
                {...fadeInUp}
            >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                    <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Glass Citadel™ Architecture</span>
                </div>
                <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl mb-6 tracking-tight">Built for Trust</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Confidential data stays encrypted. Payments create permanent proof. Both happen on the same platform.
                </p>
            </motion.div>

            <div className="bento-grid max-w-7xl mx-auto">
                {/* 1. Large Card: Lightning Settlements */}
                <motion.div
                    className="md:col-span-3 lg:col-span-2 row-span-2 feature-card group hover:border-primary/40 transition-all duration-500 overflow-hidden"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="icon-wrapper group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] mb-8">
                            <Zap className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-3xl font-bold font-heading mb-4">400ms Settlement</h3>
                        <p className="text-muted-foreground text-lg leading-relaxed max-w-md mb-auto">
                            Net-30 is history. Invoix leverages Solana's ~400ms block times to settle global transactions instantly.
                            Realize revenue immediately with cryptographic proof of payment.
                        </p>

                        <div className="mt-12 h-48 relative rounded-2xl border border-white/5 bg-black/40 overflow-hidden group-hover:border-primary/20 transition-colors">
                            <div className="absolute inset-0 flex items-center justify-around px-8">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div
                                        key={i}
                                        className="h-20 w-12 rounded-lg bg-gradient-to-b from-primary/40 to-primary/5 border border-primary/20 animate-pulse"
                                        style={{ animationDelay: `${i * 0.1}s`, opacity: 0.3 + (i * 0.1) }}
                                    />
                                ))}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. NFT Receipts (3D Asset) */}
                <motion.div
                    className="md:col-span-1 lg:col-span-2 row-span-2 feature-card group bg-gradient-to-b from-cyan-500/5 to-transparent hover:border-cyan-400/40 transition-all duration-500 overflow-hidden"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="grid lg:grid-cols-2 gap-8 items-center h-full">
                        <div className="order-2 lg:order-1 relative h-64 lg:h-full flex items-center justify-center">
                            <div className="absolute inset-0 bg-cyan-500/10 blur-[80px] rounded-full group-hover:bg-cyan-500/20 transition-colors duration-700" />
                            <img
                                src="/nft-receipt.png"
                                alt="Holographic NFT Receipt"
                                className="w-full max-w-[280px] h-auto drop-shadow-2xl animate-float relative z-10"
                            />
                        </div>
                        <div className="order-1 lg:order-2 space-y-4">
                            <div className="icon-wrapper group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                                <Receipt className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading">Immutable Audit Trail</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Every payment mints a compressed NFT receipt on-chain.
                                Permanent, verifiable proof that satisfies auditors and regulators alike.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 3. Multi-Currency */}
                <motion.div
                    className="md:col-span-2 lg:col-span-2 row-span-1 feature-card group hover:border-pink-500/40 transition-all duration-500"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="flex items-start gap-6">
                        <div className="icon-wrapper shrink-0 group-hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                            <CreditCard className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-heading mb-2">Stablecoin Native</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Accept USDC, USDT, EURC, PYUSD, or native SOL. Real-time settlement in the currency your business needs.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 4. Glass Citadel Security */}
                <motion.div
                    className="md:col-span-2 lg:col-span-2 row-span-1 feature-card group bg-gradient-to-br from-emerald-500/5 to-transparent hover:border-emerald-400/40 transition-all duration-500"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="flex items-start gap-6">
                        <div className="icon-wrapper shrink-0 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-500/10 border-emerald-500/20">
                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-heading mb-2 flex items-center gap-2">
                                Glass Citadel™ Privacy
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">ACTIVE</span>
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Invoice details encrypted with Arcium (SDK mode). Public payments, private line items.
                                Designed for enterprise confidentiality on a transparent blockchain.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 5. Recurring Subscriptions */}
                <motion.div
                    className="md:col-span-4 lg:col-span-4 row-span-1 feature-card group bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-400/40 transition-all duration-500"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="flex items-start gap-6">
                        <div className="icon-wrapper shrink-0 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] bg-purple-500/10 border-purple-500/20">
                            <CalendarClock className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold font-heading mb-2 flex items-center gap-2">
                                Recurring Subscriptions
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono">NEW</span>
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                                Set up automated recurring billing for your customers. Create subscription plans, track billing cycles, and mint invoices automatically. Built on Solana for instant settlement and transparent on-chain tracking.
                            </p>
                            <div className="grid grid-cols-3 gap-4 text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-400"></div>
                                    <span>Auto-billing</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-400"></div>
                                    <span>On-chain tracking</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-400"></div>
                                    <span>Instant settlement</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
