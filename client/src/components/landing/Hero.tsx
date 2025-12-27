import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
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
                            <Sparkles className="w-4 h-4 mr-2 text-pink-400 animate-pulse" />
                            <span className="text-sm font-semibold font-heading text-primary tracking-widest uppercase">
                                The New Standard for On-Chain Commerce
                            </span>
                        </motion.div>

                        <motion.h1
                            className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-8 tracking-tighter"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            Invoice with <br className="hidden md:block" />
                            <span className="gradient-text pb-2 inline-block relative">
                                Pure Velocity
                                <span className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-primary to-accent pointer-events-none"></span>
                            </span>
                        </motion.h1>

                        <motion.p
                            className="text-lg md:text-xl text-muted-foreground mb-12 max-w-xl lg:mx-0 mx-auto leading-relaxed text-balance"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            Instant crypto settlements, automated NFT receipts, and zero hidden fees.
                            Scale your B2B operations on the world's most performant blockchain.
                        </motion.p>

                        <motion.div
                            className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start items-center"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <Link href="/invoices/create">
                                <button className="btn-primary smoke-shadow h-14 px-10 text-lg flex items-center justify-center group relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)]" id="hero-create-invoice">
                                    <div className="absolute inset-0 animate-shimmer opacity-30"></div>
                                    <span className="relative flex items-center">
                                        Start Invoicing Free
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>
                            </Link>

                            <button
                                onClick={() => setIsWaitlistOpen(true)}
                                className="btn-secondary h-14 px-10 text-lg flex items-center justify-center hover:bg-white/10 border border-white/10 backdrop-blur-md"
                            >
                                Request API Access
                            </button>
                        </motion.div>

                        {/* Trusted By Bar */}
                        <motion.div
                            className="mt-16 pt-8 border-t border-white/5 flex flex-wrap justify-center lg:justify-start items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            transition={{ delay: 0.6 }}
                        >
                            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground mr-4">Trusted Across Solana</span>
                            <div className="h-6 w-24 bg-white/20 rounded animate-pulse" />
                            <div className="h-6 w-28 bg-white/20 rounded animate-pulse" />
                            <div className="h-6 w-20 bg-white/20 rounded animate-pulse" />
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
