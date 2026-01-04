import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function DevnetBanner() {
    const [isVisible, setIsVisible] = useState(true);

    // Only show on devnet
    const isDevnet = import.meta.env.VITE_SOLANA_NETWORK === 'devnet';
    if (!isDevnet || !isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-yellow-500/10 border-b border-yellow-500/20 backdrop-blur-sm relative z-[100] overflow-hidden"
            >
                {/* Gradient accent on left */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 via-orange-400 to-yellow-500" />

                <div className="container mx-auto px-4 py-2 flex items-center justify-between text-xs md:text-sm">
                    <div className="flex items-center gap-2 text-yellow-500">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <AlertTriangle className="w-4 h-4" />
                        </motion.div>
                        <span className="font-semibold">System Running on Devnet</span>
                        <span className="hidden md:inline text-muted-foreground">- No real funds are at risk.</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <a
                            href="https://faucet.solana.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 transition-all hover:scale-105 font-medium hover:underline"
                        >
                            Get Test SOL
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                            href="https://faucet.circle.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 transition-all hover:scale-105 font-medium hover:underline"
                        >
                            Get Test USDC
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-1.5 hover:bg-yellow-500/20 rounded-full transition-all hover:rotate-90 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
