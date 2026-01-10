import { motion } from "framer-motion";
import { UserPlus, FileText, CreditCard, CheckCircle } from "lucide-react";

export function HowItWorks() {
    const steps = [
        {
            icon: UserPlus,
            title: "Connect Wallet",
            description: "Sign in with any Solana wallet or use Passkeys for biometric, non-custodial login."
        },
        {
            icon: FileText,
            title: "Create Invoice",
            description: "Fill in client details and amount. We support SOL, USDC, USDT, and EURC."
        },
        {
            icon: CreditCard,
            title: "Get Paid Instantly",
            description: "Client pays via crypto. Funds settle in your wallet in seconds."
        },
        {
            icon: CheckCircle,
            title: "Automated Receipt",
            description: "An NFT receipt is minted automatically as immutable proof of payment."
        }
    ];

    return (
        <section className="py-32 container mx-auto px-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="text-center mb-24 relative z-10">
                <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-primary font-mono text-xs font-bold tracking-[0.2em] uppercase mb-4 block"
                >
                    Workflow
                </motion.span>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl tracking-tight"
                >
                    Settlement in <span className="gradient-text">Seconds</span>
                </motion.h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {/* Desktop Connector Line Container */}
                <div className="hidden lg:block absolute top-[3rem] left-0 right-0 h-0.5 bg-white/5 overflow-hidden -z-10 rounded-full">
                    <motion.div
                        initial={{ x: "-100%" }}
                        whileInView={{ x: "100%" }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                    />
                </div>

                {steps.map((step, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.15 }}
                        className="group relative"
                    >
                        {/* Connecting Dot */}
                        <div className="hidden lg:block absolute top-[3rem] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#020617] border-2 border-white/10 group-hover:border-primary group-hover:scale-150 transition-all duration-300 z-0">
                            <div className="absolute inset-0 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="h-full pt-16">
                            <div className="glass-card p-8 rounded-2xl h-full border border-white/5 hover:border-primary/30 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_10px_40px_rgba(139,92,246,0.15)] bg-gradient-to-b from-white/5 to-transparent relative overflow-hidden">

                                {/* Inner Glow */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="mb-6 relative">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:border-primary/30 transition-colors duration-300">
                                        <step.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="absolute -top-2 -right-2 text-[10px] font-bold font-mono text-white/20 group-hover:text-primary/40 transition-colors">
                                        0{index + 1}
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold font-heading mb-3 text-foreground group-hover:text-white transition-colors">{step.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-white/70 transition-colors">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
