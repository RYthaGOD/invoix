import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
};

const tiers = [
    {
        name: "Starter",
        price: "$0",
        period: "mo",
        description: "Perfect for freelancers",
        features: [
            "Unlimited Invoices",
            "SOL, USDC, EURC Payments",
            "Basic Analytics",
            "Discord Support"
        ],
        cta: "Start Free",
        href: "/invoices/create",
        featured: false
    },
    {
        name: "Pro",
        price: "$29",
        period: "one-time",
        description: "For growing businesses",
        features: [
            "Everything in Starter",
            "Priority Support",
            "Deep Privacy (Arcium)",
            "Custom Branding",
            "NFT Payment Receipts"
        ],
        cta: "Upgrade Now",
        href: "/dashboard/settings",
        featured: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "year",
        description: "For large scale operations",
        features: [
            "Everything in Pro",
            "Dedicated Account Manager",
            "Custom Smart Contracts",
            "SLA Support",
            "Audit Logs API"
        ],
        cta: "Contact Sales",
        href: "mailto:sales@invoix.io",
        featured: false
    }
];

export function Pricing() {
    return (
        <section id="pricing" className="py-32 container mx-auto px-6 relative">
            <motion.div className="text-center mb-20" {...fadeInUp}>
                <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">Simple Pricing</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Start free, upgrade for industrial power. No hidden fees.
                </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {tiers.map((tier, index) => (
                    <motion.div
                        key={tier.name}
                        {...fadeInUp}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="relative group perspective-1000"
                    >
                        {tier.featured ? (
                            // Premium Card Glow
                            <>
                                <div className="absolute -inset-[2px] bg-gradient-to-r from-primary via-accent to-primary rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity" />
                            </>
                        ) : null}

                        <div className={`relative h-full flex flex-col p-8 rounded-[2rem] transition-all duration-300
                            ${tier.featured
                                ? 'glass-card border-primary/50' // Premium Glass
                                : 'glass border-white/5 bg-white/5 hover:bg-white/10' // Standard Glass
                            }
                        `}>
                            {tier.featured && (
                                <div className="absolute top-0 right-0 px-5 py-2 bg-gradient-to-r from-primary to-accent text-white text-xs font-bold rounded-bl-2xl rounded-tr-2xl flex items-center gap-1.5 shadow-lg shadow-primary/20">
                                    <Sparkles className="w-3 h-3" />
                                    POPULAR
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-2xl font-bold font-heading mb-2 flex items-center gap-2">
                                    {tier.name}
                                    {tier.featured && <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
                                    {tier.name === "Enterprise" && <Building2 className="w-5 h-5 text-blue-400" />}
                                </h3>
                                <p className="text-sm text-muted-foreground">{tier.description}</p>
                            </div>

                            <div className="flex items-baseline gap-1 mb-8">
                                <span className={`text-5xl font-bold tracking-tight ${tier.featured ? 'text-white' : 'text-white/90'}`}>
                                    {tier.price}
                                </span>
                                {tier.price !== "Custom" && <span className="text-muted-foreground font-medium">/ {tier.period}</span>}
                            </div>

                            <div className="space-y-4 flex-1 mb-10">
                                {tier.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 group/item">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${tier.featured
                                            ? 'bg-primary/20 text-primary group-hover/item:bg-primary group-hover/item:text-white'
                                            : 'bg-white/10 text-muted-foreground group-hover/item:bg-white/20 group-hover/item:text-white'
                                            }`}>
                                            <Check className="w-3.5 h-3.5" />
                                        </div>
                                        <span className={`text-sm ${tier.featured ? 'text-gray-200' : 'text-gray-400'} group-hover/item:text-white transition-colors`}>
                                            {feature}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <Link href={tier.href}>
                                <button className={`w-full h-14 rounded-xl text-lg font-bold tracking-wide transition-all duration-300 transform group-hover:scale-[1.02] active:scale-[0.98] ${tier.featured
                                    ? 'btn-primary shadow-lg shadow-primary/25'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20'
                                    }`}>
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
