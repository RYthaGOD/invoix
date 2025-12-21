import { motion } from "framer-motion";
import { Check } from "lucide-react";

export function Rewards() {
    return (
        <section id="rewards" className="py-32 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="glass-strong rounded-[3rem] p-12 md:p-20 border border-white/10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-bold font-mono mb-8 border border-accent/20">
                                TOKEN REWARDS LIVE
                            </div>
                            <h2 className="font-heading font-bold text-4xl md:text-6xl mb-6">
                                Get paid to <br />
                                <span className="gradient-text">get paid.</span>
                            </h2>
                            <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl">
                                Invoix isn't just a tool; it's a protocol. 50% of fees go toward buying back $INVOIX tokens and rewarding active users.
                            </p>

                            <div className="flex flex-col gap-4">
                                {[
                                    "Earn $INVOIX for every invoice paid",
                                    "Stake for reduced platform fees",
                                    "Vote on protocol governance"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl glass hover:bg-white/5 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <span className="font-medium text-white">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            className="relative"
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl shadow-primary/10">
                                <div className="text-center mb-8">
                                    <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-2">Current APY</div>
                                    <div className="text-6xl font-heading font-bold gradient-text">12.5%</div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-center p-4 rounded-xl bg-black/20">
                                        <span className="text-muted-foreground">My Rewards</span>
                                        <span className="font-mono font-bold text-primary">1,420.69 INVOIX</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 rounded-xl bg-black/20">
                                        <span className="text-muted-foreground">Est. Value</span>
                                        <span className="font-mono font-bold text-white">$452.12</span>
                                    </div>
                                </div>

                                <button className="btn-primary w-full h-12 text-lg">Connect Wallet to Earn</button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
