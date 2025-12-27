import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function Hero() {
    return (
        <section className="relative pt-32 pb-32 md:pt-48 md:pb-40 overflow-hidden">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 gradient-hero opacity-60 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />
            <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/15 blur-[80px] rounded-full pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 blur-[60px] rounded-full pointer-events-none -z-10 -translate-x-1/4 translate-y-1/4" />

            <div className="container mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8 border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(236,72,153,0.1)]"
                >
                    <Sparkles className="w-4 h-4 mr-2 text-pink-400 animate-pulse" />
                    <span className="text-sm font-semibold font-heading text-primary tracking-wide">
                        PROFESSIONAL B2B INVOICING
                    </span>
                </motion.div>

                <motion.h1
                    className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-8 tracking-tight"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    Invoice with <br className="hidden md:block" />
                    <span className="gradient-text pb-2 inline-block relative">
                        Blockchain Speed
                        <span className="absolute inset-0 blur-2xl opacity-30 bg-gradient-to-r from-primary to-accent pointer-events-none"></span>
                    </span>
                </motion.h1>

                <motion.p
                    className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed text-balance"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    Instant crypto payments, automated NFT receipts, and zero subscription fees.
                    Experience the new standard for on-chain commerce.
                </motion.p>

                <motion.div
                    className="flex flex-col sm:flex-row gap-5 justify-center items-center"
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

                    <Link href="/invoices">
                        <button className="btn-secondary h-14 px-10 text-lg flex items-center justify-center hover:bg-white/10" id="hero-dashboard">
                            Launch Dashboard
                        </button>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
