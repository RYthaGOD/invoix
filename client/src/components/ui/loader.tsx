
import { motion } from "framer-motion";

export function Loader() {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[50vh] gap-4">
            <div className="relative flex items-center justify-center">
                {/* Outer Ring - Iridescent */}
                <motion.div
                    className="absolute w-16 h-16 rounded-full border-2 border-t-primary border-r-transparent border-b-primary/30 border-l-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />

                {/* Inner Ring - Accent */}
                <motion.div
                    className="absolute w-10 h-10 rounded-full border-2 border-t-transparent border-r-accent border-b-transparent border-l-accent/50"
                    animate={{ rotate: -180 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />

                {/* Core Pulping Dot */}
                <motion.div
                    className="w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>

            {/* Loading text with shimmer */}
            <motion.span
                className="text-muted-foreground text-sm font-medium tracking-widest uppercase opacity-80"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                Loading Invoix
            </motion.span>
        </div>
    );
}
