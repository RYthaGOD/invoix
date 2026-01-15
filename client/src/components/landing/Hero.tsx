import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "wouter";
import { GlassSphere } from "./GlassSphere";

export function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-32 pb-20">
            {/* Simple subtle background */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />

            <div className="container-custom relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Side - Content */}
                    <div className="text-center lg:text-left">
                        {/* Trust Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
                        >
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                Trusted by 1,000+ businesses
                            </span>
                        </motion.div>

                        {/* Main Headline */}
                        <motion.h1
                            className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            Invoice Smarter,<br />
                            Get Paid Faster
                        </motion.h1>

                        {/* Subheading */}
                        <motion.p
                            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            Modern invoicing platform powered by Solana. Create professional invoices,
                            accept crypto payments, and get paid instantly with blockchain transparency.
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div
                            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-12"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Link href="/invoices/create">
                                <button className="btn-primary group">
                                    <span className="flex items-center">
                                        Start Free Trial
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>
                            </Link>

                            <button
                                onClick={() => window.location.href = '#pricing'}
                                className="btn-secondary"
                            >
                                View Pricing
                            </button>
                        </motion.div>

                        {/* Social Proof / Stats */}
                        <motion.div
                            className="flex flex-wrap justify-center lg:justify-start items-center gap-8 md:gap-12 pt-8 border-t border-border"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <div className="text-center lg:text-left">
                                <div className="text-3xl font-bold text-foreground">?k+</div>
                                <div className="text-sm text-muted-foreground mt-1">Invoiced</div>
                            </div>
                            <div className="text-center lg:text-left">
                                <div className="text-3xl font-bold text-foreground">x,xxx</div>
                                <div className="text-sm text-muted-foreground mt-1">Users</div>
                            </div>
                            <div className="text-center lg:text-left">
                                <div className="text-3xl font-bold text-foreground">99.99%</div>
                                <div className="text-sm text-muted-foreground mt-1">Uptime</div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Side - Transaction Network Visualization */}
                    <motion.div
                        className="hidden lg:block h-[600px] relative"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        <GlassSphere />
                    </motion.div>
                </div>

                {/* Tech Stack Badges - Below on mobile */}
                <motion.div
                    className="mt-16 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <span className="text-xs font-medium uppercase text-muted-foreground mb-4 block">
                        Powered by
                    </span>
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                            <img
                                src="https://cryptologos.cc/logos/solana-sol-logo.svg"
                                alt="Solana"
                                className="w-5 h-5"
                            />
                            <span className="text-sm font-medium text-foreground">Solana</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                            <img
                                src="https://cdn.prod.website-files.com/67086aa28c40f80ff00c0a83/6889f33ff6f77a9c9fa396d0_02%20Logomark.svg"
                                alt="Arcium"
                                className="w-5 h-5"
                            />
                            <span className="text-sm font-medium text-foreground">Arcium</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                            <svg className="w-5 h-5 text-foreground" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M9.08241 8.63562C9.16584 8.51233 9.17565 8.34958 9.09714 8.22136L4.33208 0.158106C4.26338 0.0397463 4.14069 -0.0292969 4.00329 -0.0292969H0.656463C0.36202 -0.0292969 0.17554 0.291261 0.327669 0.547707L6.58947 11.2889C6.72688 11.5305 7.0753 11.5453 7.23234 11.3135L9.08241 8.63562ZM3.29663 11.1212C3.44876 11.3776 3.26228 11.7031 2.96783 11.7031H2.96293H0.671185C0.460168 11.7031 0.28841 11.5305 0.28841 11.3184V7.4323C0.28841 7.03776 0.803684 6.89968 0.999978 7.23503L3.29663 11.1212Z" fill="currentColor" />
                                <path d="M18.0531 11.2297C18.2003 11.4861 18.0187 11.8067 17.7243 11.8067H14.3971C14.2597 11.8067 14.137 11.7327 14.0683 11.6143L7.61511 0.547707C7.46789 0.291261 7.64946 -0.0292969 7.9439 -0.0292969H11.2858C11.4232 -0.0292969 11.5459 0.0446779 11.6146 0.163038L18.0531 11.2297Z" fill="currentColor" />
                            </svg>
                            <span className="text-sm font-medium text-foreground">Metaplex</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
