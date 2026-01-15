import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check, Star } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, ease: "easeOut" }
};

const tiers = [
    {
        name: "Starter",
        price: "$0",
        period: "forever",
        description: "Perfect for freelancers and small businesses",
        features: [
            "Unlimited invoices",
            "SOL, USDC, EURC payments",
            "Basic analytics",
            "Email support",
            "Payment tracking"
        ],
        cta: "Start Free",
        href: "/invoices/create",
        featured: false
    },
    {
        name: "Pro",
        price: "$29",
        period: "one-time",
        description: "For growing businesses with advanced needs",
        features: [
            "Everything in Starter",
            "Priority support",
            "Arcium encryption",
            "Custom branding",
            "NFT receipts",
            "Advanced analytics",
            "API access"
        ],
        cta: "Upgrade to Pro",
        href: "/dashboard/settings",
        featured: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "contact us",
        description: "For large-scale operations with custom needs",
        features: [
            "Everything in Pro",
            "Dedicated account manager",
            "Custom smart contracts",
            "99.99% SLA",
            "Audit logs API",
            "White-label solution",
            "Volume discounts"
        ],
        cta: "Contact Sales",
        href: "mailto:sales@invoix.io",
        featured: false
    }
];

export function Pricing() {
    return (
        <section id="pricing" className="section-padding bg-muted/30">
            <div className="container-custom">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-16 max-w-3xl mx-auto"
                    {...fadeInUp}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                        <span className="text-sm font-medium">Simple Pricing</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                        Start free, scale as you grow
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        No hidden fees. No surprises. Just transparent pricing that grows with your business.
                    </p>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier, index) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`relative ${tier.featured ? 'md:-mt-4 md:mb-4' : ''}`}
                        >
                            {/* Popular Badge */}
                            {tier.featured && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                                    <div className="flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full shadow-lg">
                                        <Star className="w-3 h-3 fill-current" />
                                        Most Popular
                                    </div>
                                </div>
                            )}

                            {/* Card */}
                            <div className={`
                                h-full card-flat flex flex-col
                                ${tier.featured
                                    ? 'border-2 border-primary shadow-xl'
                                    : 'border border-border'
                                }
                            `}>
                                {/* Header */}
                                <div className="pb-8 border-b border-border">
                                    <h3 className="text-2xl font-bold text-foreground mb-2">
                                        {tier.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        {tier.description}
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-bold text-foreground">
                                            {tier.price}
                                        </span>
                                        {tier.price !== "Custom" && (
                                            <span className="text-muted-foreground">
                                                /{tier.period}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Features */}
                                <ul className="flex-1 space-y-4 py-8">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Check className="w-3 h-3 text-primary" />
                                            </div>
                                            <span className="text-foreground">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                <div className="pt-8">
                                    <Link href={tier.href}>
                                        <button className={tier.featured ? 'btn-primary w-full' : 'btn-secondary w-full'}>
                                            {tier.cta}
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* FAQ Note */}
                <motion.p
                    className="text-center text-sm text-muted-foreground mt-12"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                >
                    Questions? Check our{" "}
                    <a href="#faq" className="text-primary hover:underline">
                        FAQ
                    </a>
                    {" "}or{" "}
                    <a href="mailto:support@invoix.io" className="text-primary hover:underline">
                        contact support
                    </a>
                </motion.p>
            </div>
        </section>
    );
}
