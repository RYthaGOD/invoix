import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useTokenStats } from "@/hooks/use-token-stats";
import { useToast } from "@/hooks/use-toast";
import { WalletButton } from "@/components/wallet-button";

interface HeroProps {
    tokenAddress: string;
}

export function Hero({ tokenAddress }: HeroProps) {
    const { data: tokenStats, isLoading: isStatsLoading } = useTokenStats();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const copyAddress = async () => {
        await navigator.clipboard.writeText(tokenAddress);
        setCopied(true);
        toast({
            title: "Address Copied",
            description: "Token address copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="relative pt-32 pb-32 md:pt-48 md:pb-40 overflow-hidden">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 gradient-hero opacity-80 pointer-events-none" />
            <div className="absolute top-20 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10 -translate-x-1/4 translate-y-1/4" />

            <div className="container mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8 border border-primary/20 bg-primary/5 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                >
                    <Sparkles className="w-4 h-4 mr-2 text-primary animate-pulse" />
                    <span className="text-sm font-semibold font-heading bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent tracking-wide">
                        THE FUTURE OF B2B PAYMENTS
                    </span>
                </motion.div>

                <motion.h1
                    className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-8 tracking-tight"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    Invoice with <br className="hidden md:block" />
                    <span className="gradient-text pb-2 inline-block">Cosmic Speed.</span>
                </motion.h1>

                <motion.p
                    className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed text-balance"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    Instant crypto payments, automated NFT receipts, and zero subscription fees.
                    Experience the new standard for on-chain commerce.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="flex justify-center mb-10"
                >
                    <button
                        onClick={copyAddress}
                        className="group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-xs text-muted-foreground hover:text-white font-mono"
                    >
                        <span className="text-primary/70 group-hover:text-primary">CA:</span>
                        {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-6)}
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                </motion.div>

                <motion.div
                    className="flex flex-col sm:flex-row gap-5 justify-center"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <Link href="/invoices/create">
                        <button className="btn-primary smoke-shadow h-14 px-10 text-lg flex items-center justify-center group" id="hero-create-invoice">
                            Start Invoicing Free
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </Link>

                    <Link href="/invoices">
                        <button className="btn-secondary h-14 px-10 text-lg flex items-center justify-center" id="hero-dashboard">
                            Launch Dashboard
                        </button>
                    </Link>
                </motion.div>

                {/* Abstract Stats Graphic */}
                {/* Using tokenStats logic passed or fetched internally if preferred, keeping as is from original */}
            </div>
        </section>
    );
}
