import { motion } from "framer-motion";
import { UserPlus, FileText, CreditCard, CheckCircle } from "lucide-react";

export function HowItWorks() {
    const steps = [
        {
            icon: UserPlus,
            title: "Connect Wallet",
            description: "Sign in with Phantom or Solflare. No email or password required."
        },
        {
            icon: FileText,
            title: "Create Invoice",
            description: "Fill in client details and amount. We support SOL, USDC, and USDT."
        },
        {
            icon: CreditCard,
            title: "Get Paid Instantly",
            description: "Client pays via crypto. Funds settle in your wallet in seconds."
        },
        {
            icon: CheckCircle,
            title: "Automated Receipt",
            description: "A compressed NFT receipt is minted automatically as proof of payment."
        }
    ];

    return (
        <section className="py-24 container mx-auto px-6 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <motion.div
                className="text-center mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <span className="text-primary font-mono text-sm tracking-widest uppercase mb-2 block">Simple Workflow</span>
                <h2 className="font-heading font-bold text-4xl md:text-5xl">How Invoix Works</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {steps.map((step, index) => (
                    <motion.div
                        key={index}
                        className="relative group"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                    >
                        <div className="glass-card p-6 rounded-2xl h-full border border-white/5 hover:border-primary/30 transition-colors">
                            <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/30">
                                {index + 1}
                            </div>
                            <div className="mb-4 mt-2 text-primary/80 group-hover:text-primary transition-colors">
                                <step.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold font-heading mb-2">{step.title}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
