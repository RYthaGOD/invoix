import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, Lock, Eye } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { WaitlistModal } from "./WaitlistModal";

export function Hero() {
    const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

    return (
        <section className="relative pt-32 pb-32 md:pt-48 md:pb-40 overflow-hidden">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 gradient-hero opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 text-center lg:text-left">
                    <div className="flex-1 max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8 border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(236,72,153,0.1)]"
                        >
                            <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
                            <span className="text-sm font-semibold font-heading text-emerald-400 tracking-widest uppercase">
                                Enterprise-Grade & Audited
                            </span>
                            <span className="mx-2 text-white/30">|</span>
                            <span className="text-sm text-muted-foreground">
                                Industrial Settlement Layer
                            </span>
                        </motion.div>

                        <motion.h1
                            className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-8 tracking-tighter"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            B2B Invoicing for<br className="hidden md:block" />
                            <span className="gradient-text pb-2 inline-block relative">
                                the Crypto Age
                                <span className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-primary to-accent pointer-events-none"></span>
                            </span>
                        </motion.h1>

                        <motion.p
                            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-xl lg:mx-0 mx-auto leading-relaxed text-balance"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            Create professional invoices. Get paid in USDC, SOL, or EURC with sub-second finality.
                            Every payment automatically mints an NFT receipt for immutable, auditable records.
                            <span className="block mt-2 text-emerald-400/80 font-medium italic">Production-hardened, security-audited, and powered by Arcium confidential computing.</span>
                        </motion.p>

                        <motion.div
                            className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start items-center"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <Link href="/invoices/create">
                                <button className="btn-primary smoke-shadow h-14 px-10 text-lg flex items-center justify-center group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(236,72,153,0.5)]" id="hero-create-invoice">
                                    <div className="absolute inset-0 animate-shimmer opacity-30"></div>
                                    <span className="relative flex items-center font-bold tracking-wide">
                                        Start Invoicing Free
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>
                            </Link>

                            <Link href="/docs">
                                <button
                                    className="btn-secondary h-14 px-10 text-lg flex items-center justify-center hover:bg-white/10 border border-white/10 backdrop-blur-md"
                                >
                                    Read Docs
                                </button>
                            </Link>
                        </motion.div>

                        {/* Powered By Tech Stack */}
                        <motion.div
                            className="mt-16 pt-8 border-t border-white/5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-4 block">
                                Powered by the Frontier Stack
                            </span>
                            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6">
                                {/* Solana */}
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#14F195]/50 transition-colors group">
                                    <img
                                        src="https://cryptologos.cc/logos/solana-sol-logo.svg"
                                        alt="Solana"
                                        className="w-5 h-5"
                                    />
                                    <span className="text-sm font-semibold text-white/80 group-hover:text-[#14F195] transition-colors">Solana</span>
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
                                {/* Metaplex */}
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/50 transition-colors group">
                                    <svg className="w-5 h-5" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M9.08241 8.63562C9.16584 8.51233 9.17565 8.34958 9.09714 8.22136L4.33208 0.158106C4.26338 0.0397463 4.14069 -0.0292969 4.00329 -0.0292969H0.656463C0.36202 -0.0292969 0.17554 0.291261 0.327669 0.547707L6.58947 11.2889C6.72688 11.5305 7.0753 11.5453 7.23234 11.3135L9.08241 8.63562ZM3.29663 11.1212C3.44876 11.3776 3.26228 11.7031 2.96783 11.7031H2.96293H0.671185C0.460168 11.7031 0.28841 11.5305 0.28841 11.3184V7.4323C0.28841 7.03776 0.803684 6.89968 0.999978 7.23503L3.29663 11.1212Z" fill="currentColor" />
                                        <path d="M18.0531 11.2297C18.2003 11.4861 18.0187 11.8067 17.7243 11.8067H14.3971C14.2597 11.8067 14.137 11.7327 14.0683 11.6143L7.61511 0.547707C7.46789 0.291261 7.64946 -0.0292969 7.9439 -0.0292969H11.2858C11.4232 -0.0292969 11.5459 0.0446779 11.6146 0.163038L18.0531 11.2297Z" fill="currentColor" />
                                    </svg>
                                    <span className="text-sm font-semibold text-white/80 group-hover:text-orange-400 transition-colors">Metaplex</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        className="flex-1 relative"
                        initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                    >
                        <div className="relative z-10 group cursor-default">
                            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-colors duration-700" />
                            <img
                                src="/3d-invoice.png"
                                alt="Futuristic Solana Invoice"
                                className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-float relative z-10"
                            />
                        </div>

                        {/* Floating elements/badges around the image */}
                        <div className="absolute -top-10 -right-10 glass p-4 rounded-2xl border border-white/10 animate-float-delayed z-20 hidden md:block">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight">Status</div>
                                    <div className="text-sm font-bold text-white">Verified Paid</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />
        </section>
    );
}
