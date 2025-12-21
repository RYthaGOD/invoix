import { motion } from "framer-motion";
import { Zap, Receipt, ShieldCheck, CreditCard } from "lucide-react";

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
                className="text-center mb-20"
                {...fadeInUp}
            >
                <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">Designed for scale</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    A comprehensive suite of tools built to handle everything from freelance gigs to enterprise payroll.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* Main Feature - Large */}
                <motion.div
                    className="md:col-span-2 feature-card group"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="flex flex-col h-full justify-between relative z-10">
                        <div>
                            <div className="icon-wrapper">
                                <Zap className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading mb-3">Lightning Fast Settlements</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
                                Say goodbye to Net-30. With Solana, funds settle in your wallet in 400ms.
                                Better cash flow, zero waiting.
                            </p>
                        </div>
                        <div className="mt-8 relative h-32 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                            {/* Abstract visualization of speed/blocks */}
                            <div className="absolute inset-0 flex items-center gap-4 px-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-16 w-24 rounded-lg bg-primary/20 border border-primary/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Feature 2 - Vertical */}
                <motion.div
                    className="md:col-span-1 feature-card group bg-gradient-to-b from-white/5 to-transparent"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="icon-wrapper">
                        <Receipt className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="text-xl font-bold font-heading mb-3">NFT Receipts</h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Automatically mint compressed NFTs as immutable proof of payment for every invoice.
                    </p>
                </motion.div>

                {/* Feature 3 */}
                <motion.div
                    className="md:col-span-1 feature-card group"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="icon-wrapper">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold font-heading mb-3">Revenue Preserved</h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Strict on-chain analysis ensures every payment is verified in atomic units. Zero revenue leakage.
                    </p>
                </motion.div>

                {/* Feature 4 - Large */}
                <motion.div
                    className="md:col-span-2 feature-card group overflow-hidden"
                    variants={fadeInUp}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: true }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[80px] rounded-full -z-10" />
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="icon-wrapper">
                                <CreditCard className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold font-heading mb-3">Multi-Currency Support</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                Accept Native SOL, USDC, USDT, or EURC. Auto-convert or hold stablecoins to avoid volatility.
                            </p>
                        </div>
                        <div className="relative">
                            <div className="glass-card p-4 rounded-xl border border-white/10 rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-mono text-muted-foreground">Amount Due</span>
                                    <span className="text-sm font-bold text-white">12.50 SOL</span>
                                </div>
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-2/3 bg-gradient-to-r from-primary to-accent" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
