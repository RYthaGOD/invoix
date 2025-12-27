import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check, Sparkles } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
};

const tiers = [
    {
        name: "Free",
        price: "$0",
        period: "forever",
        description: "Perfect for getting started",
        features: [
            "Unlimited Invoices",
            "SOL, USDC, USDT Payments",
            "Basic Analytics",
            "Community Support"
        ],
        cta: "Start Free",
        href: "/invoices/create",
        featured: false
    },
    {
        name: "Premium",
        price: "0.25 SOL",
        period: "one-time",
        description: "Unlock advanced features",
        features: [
            "Everything in Free",
            "Priority Support",
            "Advanced Analytics",
            "Custom Branding",
            "Developer API Access",
            "NFT Payment Receipts"
        ],
        cta: "Upgrade Now",
        href: "/dashboard/settings",
        featured: true
    }
];

export function Pricing() {
    return (
        <section id="pricing" className="py-24 container mx-auto px-6">
            <motion.div className="text-center mb-16" {...fadeInUp}>
                <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">Simple Pricing</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Start free, upgrade when you need more power.
                </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {tiers.map((tier, index) => (
                    <motion.div
                        key={tier.name}
                        {...fadeInUp}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="relative group"
                    >
                        {tier.featured && (
                            <div className="absolute -inset-[2px] bg-gradient-to-r from-primary to-accent rounded-3xl blur opacity-75 group-hover:opacity-100 transition-opacity" />
                        )}
                        <div className={`relative glass-card rounded-3xl p-8 h-full flex flex-col ${tier.featured ? 'border-primary/50' : ''}`}>
                            {tier.featured && (
                                <div className="absolute top-0 right-0 px-4 py-2 bg-primary text-white text-xs font-bold rounded-bl-2xl flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    RECOMMENDED
                                </div>
                            )}

                            <h3 className="text-2xl font-bold font-heading mb-2">{tier.name}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-bold text-white">{tier.price}</span>
                                <span className="text-muted-foreground">/ {tier.period}</span>
                            </div>

                            <div className="space-y-4 flex-1 mb-8">
                                {tier.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-gray-300">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Link href={tier.href}>
                                <button className={`w-full h-12 rounded-xl text-lg font-medium ${tier.featured ? 'btn-primary' : 'bg-white/10 hover:bg-white/20 text-white transition-colors'}`}>
                                    {tier.cta}
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
