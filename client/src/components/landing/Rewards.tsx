import { motion } from "framer-motion";
import { Trophy, Target, Users } from "lucide-react";

export function Rewards() {
    return (
        <section id="rewards" className="section-padding bg-primary text-white">
            <div className="container-custom">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-16"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-6">
                            Join the future of invoicing
                        </h2>
                        <p className="text-lg text-white/80 max-w-2xl mx-auto">
                            Be part of a growing community of businesses getting paid faster with blockchain technology.
                        </p>
                    </motion.div>

                    {/* Stats Grid */}
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Trophy,
                                value: "$2M+",
                                label: "Total Invoiced"
                            },
                            {
                                icon: Users,
                                value: "1,000+",
                                label: "Active Businesses"
                            },
                            {
                                icon: Target,
                                value: "99.9%",
                                label: "Payment Success Rate"
                            }
                        ].map((stat, index) => {
                            const Icon = stat.icon;
                            return (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20"
                                >
                                    <Icon className="w-12 h-12 mx-auto mb-4 text-white" />
                                    <div className="text-4xl font-bold mb-2">{stat.value}</div>
                                    <div className="text-white/70">{stat.label}</div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
