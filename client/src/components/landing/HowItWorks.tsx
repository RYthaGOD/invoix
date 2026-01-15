import { motion } from "framer-motion";
import { UserPlus, FileText, Send, CheckCircle } from "lucide-react";

export function HowItWorks() {
    const steps = [
        {
            number: "01",
            icon: UserPlus,
            title: "Connect Wallet",
            description: "Sign in with any Solana wallet. No email or password required."
        },
        {
            number: "02",
            icon: FileText,
            title: "Create Invoice",
            description: "Fill in customer details, add line items, and set payment terms."
        },
        {
            number: "03",
            icon: Send,
            title: "Send & Track",
            description: "Share payment link with your customer and track status in real-time."
        },
        {
            number: "04",
            icon: CheckCircle,
            title: "Get Paid",
            description: "Receive payment instantly in your wallet with automatic NFT receipt."
        }
    ];

    return (
        <section className="section-padding bg-background">
            <div className="container-custom">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-16 max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                        <span className="text-sm font-medium">How It Works</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                        Get paid in four simple steps
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        From invoice creation to payment receipt, the entire process takes minutes.
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <motion.div
                                key={step.number}
                                className="relative"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                {/* Connecting Line (desktop only) */}
                                {index < steps.length - 1 && (
                                    <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-border -translate-x-1/2 z-0" />
                                )}

                                {/* Step Content */}
                                <div className="relative z-10 text-center">
                                    {/* Number Badge */}
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg mb-6">
                                        {step.number}
                                    </div>

                                    {/* Icon */}
                                    <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
                                        <Icon className="w-8 h-8 text-primary" />
                                    </div>

                                    {/* Title & Description */}
                                    <h3 className="text-xl font-semibold text-foreground mb-3">
                                        {step.title}
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
