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
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase">Verified Features</span>
                </div>
                <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl mb-6 tracking-tight">Everything Your Business Needs</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Instant settlement, automated receipts, and enterprise-grade security. All verified and production-ready.
                </p>
            </motion.div>

            <div className="bento-grid max-w-7xl mx-auto">
                {/* 1. Instant Settlement */}
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
                        <h3 className="text-3xl font-bold font-heading mb-4">Instant Settlement</h3>
                        <p className="text-muted-foreground text-lg leading-relaxed max-w-md mb-auto">
                            Get paid in seconds, not days. Invoix leverages Solana's high-speed blockchain to settle transactions instantly.
                            No more waiting for Net-30 payment terms.
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

                {/* 2. Compressed NFT Receipts */}
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
                                alt="Compressed NFT Receipt"
                                className="w-full max-w-[280px] h-auto drop-shadow-2xl animate-float relative z-10"
                            />
                        </div>
                        <div className="order-1 lg:order-2 space-y-4">
                            <div className="icon-wrapper group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                                <Receipt className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading">Automated NFT Receipts</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Every payment automatically mints a compressed NFT receipt. 95% cheaper than standard NFTs.
                                Permanent, verifiable proof for auditors and regulators.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 3. Multi-Currency Support */}
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
                            <h3 className="text-xl font-bold font-heading mb-2">Multi-Currency Support</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Accept payments in USDC, USDT, EURC, PYUSD, or native SOL. Instant settlement in the currency your business needs.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 4. Enterprise Privacy (Optional) */}
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
                                Optional Encryption
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">VERIFIED</span>
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Optionally encrypt sensitive invoice data with Arcium for confidential transactions.
                                Non-custodial authentication via passkeys for maximum security.
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
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                                Automate recurring billing for your customers. Create subscription plans, track billing cycles, and mint invoices automatically. Powered by Solana for instant settlement and transparent on-chain tracking.
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
