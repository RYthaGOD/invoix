import { motion } from "framer-motion";
import { Link } from "wouter";
import { Check } from "lucide-react";

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
};

export function Pricing() {
    return (
        <section id="pricing" className="py-24 container mx-auto px-6">
            <motion.div className="text-center mb-16" {...fadeInUp}>
                <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">Fair Launch Pricing</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    No subscriptions. No hidden fees. Just pay for network costs.
                </p>
            </motion.div>

            <div className="max-w-md mx-auto relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-3xl blur p-[2px] opacity-75 group-hover:opacity-100 transition-opacity" />
                <div className="relative glass-card rounded-3xl p-8 overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 right-0 px-4 py-2 bg-primary text-white text-xs font-bold rounded-bl-2xl">
                        COMMUNITY
                    </div>

                    <h3 className="text-2xl font-bold font-heading mb-2">Protocol Access</h3>
                    <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-bold text-white">$0</span>
                        <span className="text-muted-foreground">/ month</span>
                    </div>

                    <div className="space-y-4 flex-1 mb-8">
                        {[
                            "Unlimited Invoices",
                            "Unlimited Clients",
                            "SOL, USDC, USDT & EURC Payments",
                            "NFT Payment Receipts",
                            "Real-time Analytics",
                            "Community Support"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <Check className="w-3 h-3" />
                                </div>
                                <span className="text-sm text-gray-300">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <Link href="/invoices/create">
                        <button className="w-full btn-primary h-12 rounded-xl text-lg font-medium">
                            Start Now
                        </button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
