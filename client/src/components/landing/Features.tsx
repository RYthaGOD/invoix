import { motion } from "framer-motion";
import { Zap, Receipt, Shield, CreditCard, Lock, TrendingUp } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, ease: "easeOut" }
};

const features = [
    {
        icon: Zap,
        title: "Instant Settlements",
        description: "Get paid in seconds, not weeks. Solana's 400ms block times mean your payments settle instantly with cryptographic proof.",
        color: "bg-blue-50 text-blue-600 border-blue-100"
    },
    {
        icon: Receipt,
        title: "NFT Receipts",
        description: "Every payment automatically creates an immutable NFT receipt. Perfect for audits, compliance, and accounting.",
        color: "bg-purple-50 text-purple-600 border-purple-100"
    },
    {
        icon: Shield,
        title: "Blockchain Security",
        description: "Your invoices and payments are secured by Solana's decentralized network. No single point of failure.",
        color: "bg-green-50 text-green-600 border-green-100"
    },
    {
        icon: CreditCard,
        title: "Multi-Currency",
        description: "Accept payments in USDC, SOL, EURC, and more. Give your customers flexibility in how they pay.",
        color: "bg-indigo-50 text-indigo-600 border-indigo-100"
    },
    {
        icon: Lock,
        title: "Private & Compliant",
        description: "Confidential data encryption with Arcium. Your sensitive business information stays private.",
        color: "bg-amber-50 text-amber-600 border-amber-100"
    },
    {
        icon: TrendingUp,
        title: "Real-Time Analytics",
        description: "Track invoice status, payment history, and revenue metrics in real-time. Make data-driven decisions.",
        color: "bg-cyan-50 text-cyan-600 border-cyan-100"
    }
];

export function Features() {
    return (
        <section id="features" className="section-padding bg-background">
            <div className="container-custom">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-16 max-w-3xl mx-auto"
                    {...fadeInUp}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                        <span className="text-sm font-medium">Powerful Features</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                        Everything you need to<br />get paid faster
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Modern invoicing meets blockchain technology. Create, send, and track invoices with the speed and security of Solana.
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={feature.title}
                                className="card-flat group hover:shadow-lg transition-all duration-300"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-6 h-6" />
                                </div>

                                {/* Content */}
                                <h3 className="text-xl font-semibold text-foreground mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
