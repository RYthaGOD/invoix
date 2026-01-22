import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { ShinyButton } from "@/components/ui/shiny-button";

export function Hero() {
    return (
        <BackgroundPaths>
            <section className="relative pt-32 pb-32 md:pt-48 md:pb-40">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="flex flex-col items-center gap-12 text-center max-w-5xl mx-auto">
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center px-4 py-2 rounded-full glass-card border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                        >
                            <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
                            <span className="text-sm font-semibold font-heading text-emerald-400 tracking-widest uppercase">
                                Trusted by Businesses
                            </span>
                            <span className="mx-2 text-white/30">|</span>
                            <span className="text-sm text-muted-foreground">
                                Audited & Secure
                            </span>
                        </motion.div>

                        {/* Headline */}
                        <motion.h1
                            className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tighter"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            Modern B2B Invoicing
                            <br className="hidden md:block" />
                            <span className="gradient-text pb-2 inline-block relative">
                                & Payments
                                <span className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-primary to-accent pointer-events-none"></span>
                            </span>
                        </motion.h1>

                        {/* Subheadline */}
                        <motion.p
                            className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            Create professional invoices. Get paid instantly in USDC, SOL, or EURC.
                            Every payment automatically creates a permanent NFT receipt for auditing.
                        </motion.p>

                        {/* CTAs with ShinyButton */}
                        <motion.div
                            className="flex flex-col sm:flex-row gap-5 justify-center items-center"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <Link href="/invoices/create">
                                <ShinyButton variant="primary" className="text-lg px-10">
                                    Get Started Free
                                    <ArrowRight className="w-5 h-5" />
                                </ShinyButton>
                            </Link>

                            <Link href="/docs">
                                <ShinyButton variant="secondary" className="text-lg px-10">
                                    View Documentation
                                </ShinyButton>
                            </Link>
                        </motion.div>

                        {/* Tech Stack */}
                        <motion.div
                            className="mt-16 pt-8 border-t border-white/5 w-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-4 block">
                                Powered by Industry Leaders
                            </span>
                            <div className="flex flex-wrap justify-center items-center gap-6">
                                {/* Solana */}
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#14F195]/50 transition-colors group">
                                    <img
                                        src="https://cryptologos.cc/logos/solana-sol-logo.svg"
                                        alt="Solana"
                                        className="w-5 h-5"
                                    />
                                    <span className="text-sm font-semibold text-white/80 group-hover:text-[#14F195] transition-colors">Solana</span>
                                </div>
                                {/* Metaplex */}
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/50 transition-colors group">
                                    <svg className="w-5 h-5" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M9.08241 8.63562C9.16584 8.51233 9.17565 8.34958 9.09714 8.22136L4.33208 0.158106C4.26338 0.0397463 4.14069 -0.0292969 4.00329 -0.0292969H0.656463C0.36202 -0.0292969 0.17554 0.291261 0.327669 0.547707L6.58947 11.2889C6.72688 11.5305 7.0753 11.5453 7.23234 11.3135L9.08241 8.63562ZM3.29663 11.1212C3.44876 11.3776 3.26228 11.7031 2.96783 11.7031H2.96293H0.671185C0.460168 11.7031 0.28841 11.5305 0.28841 11.3184V7.4323C0.28841 7.03776 0.803684 6.89968 0.999978 7.23503L3.29663 11.1212Z" fill="currentColor" />
                                        <path d="M18.0531 11.2297C18.2003 11.4861 18.0187 11.8067 17.7243 11.8067H14.3971C14.2597 11.8067 14.137 11.7327 14.0683 11.6143L7.61511 0.547707C7.46789 0.291261 7.64946 -0.0292969 7.9439 -0.0292969H11.2858C11.4232 -0.0292969 11.5459 0.0446779 11.6146 0.163038L18.0531 11.2297Z" fill="currentColor" />
                                    </svg>
                                    <span className="text-sm font-semibold text-white/80 group-hover:text-orange-400 transition-colors">Metaplex</span>
                                </div>
                                {/* Arcium */}
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors group">
                                    <img
                                        src="https://cdn.prod.website-files.com/67086aa28c40f80ff00c0a83/6889f33ff6f77a9c9fa396d0_02%20Logomark.svg"
                                        alt="Arcium"
                                        className="w-5 h-5"
                                    />
                                    <span className="text-sm font-semibold text-white/80 group-hover:text-purple-400 transition-colors">Arcium</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </BackgroundPaths>
    );
}
