import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Rocket, Sparkles } from "lucide-react";

export default function ComingSoon() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 gradient-hero opacity-40 pointer-events-none" />
            <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 max-w-md"
            >
                {/* Animated Icon Container */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-24 h-24 glass-card rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10 relative overflow-hidden group"
                >
                    <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Rocket className="w-12 h-12 text-primary" />
                    </motion.div>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl md:text-5xl font-bold font-heading gradient-text mb-4"
                >
                    Coming Soon
                </motion.h1>

                {/* Description */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-muted-foreground text-lg max-w-md mb-4 leading-relaxed"
                >
                    We're working hard to bring you this feature.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-white/10 text-sm text-muted-foreground mb-8"
                >
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Stay tuned for updates</span>
                </motion.div>

                {/* Action Button */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Link href="/invoices">
                        <button className="btn-primary h-12 px-8 flex items-center gap-2 mx-auto group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Dashboard
                        </button>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
}
