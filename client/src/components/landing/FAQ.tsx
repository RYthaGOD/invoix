import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface FAQItem {
    question: string;
    answer: string;
}

const faqs: FAQItem[] = [
    {
        question: "What is Invoix?",
        answer: "Invoix is a decentralized B2B invoicing protocol built on Solana. It allows businesses to create, send, and settle invoices using stablecoins (USDC, USDT, EURC) or native SOL, with settlement finality in under 400 milliseconds."
    },
    {
        question: "How does the Glass Citadel privacy system work?",
        answer: "Glass Citadel uses Arcium's confidential computing (MXE) to encrypt sensitive invoice data like line items and pricing. Only authorized wallet holders can decrypt their specific invoices. Public metadata (timestamps, status) remains visible for auditability, but financial details stay private."
    },
    {
        question: "What are NFT Receipts?",
        answer: "Every successful payment on Invoix automatically mints a compressed NFT (cNFT) receipt to the payer's wallet. This serves as an immutable, on-chain proof of payment that satisfies auditors and tax authorities. The receipts are stored on Solana and viewable on any NFT marketplace."
    },
    {
        question: "Is Invoix free to use?",
        answer: "Yes! The Starter tier is completely free with unlimited invoices. Premium features like deep privacy (Arcium encryption), custom branding, and priority support are available with a one-time upgrade. There are no monthly subscriptions."
    },
    {
        question: "Which cryptocurrencies are supported?",
        answer: "Invoix currently supports native SOL, USDC, USDT, EURC, and PYUSD. All payments settle directly to your wallet in the currency you choose, with no intermediaries holding your funds."
    },
    {
        question: "How do gasless payments work?",
        answer: "The Invoix protocol relays transactions on behalf of payers, covering the Solana network fees. This means your customers can pay invoices without needing SOL for gas, reducing friction for first-time crypto users."
    },
    {
        question: "Is Invoix on Mainnet?",
        answer: "Invoix is currently live on Solana Devnet for public beta testing. Mainnet launch is planned after completing security audits and community feedback integration. Do not use real funds on the current deployment."
    },
    {
        question: "How is my data secured?",
        answer: "All sensitive data is encrypted using Arcium's x25519 and RescueCipher algorithms before transmission. Database admins cannot view your invoice details. Authentication uses Sign In With Solana (SIWS) with replay-attack protection and strict rate limiting."
    }
];

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border-b border-white/5 last:border-none"
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between py-6 text-left group"
            >
                <span className="text-lg font-semibold text-white group-hover:text-primary transition-colors pr-8">
                    {item.question}
                </span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                >
                    <ChevronDown className={`w-5 h-5 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground'}`} />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <p className="pb-6 text-muted-foreground leading-relaxed pr-12">
                            {item.answer}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-32 container mx-auto px-6 relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16 relative z-10"
            >
                <span className="text-primary font-mono text-xs font-bold tracking-[0.2em] uppercase mb-4 block">
                    FAQ
                </span>
                <h2 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
                    Common <span className="gradient-text">Questions</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Everything you need to know about Invoix and decentralized B2B payments.
                </p>
            </motion.div>

            <div className="max-w-3xl mx-auto relative z-10">
                <div className="glass-card rounded-[2rem] border border-white/10 p-8 md:p-12">
                    {faqs.map((faq, index) => (
                        <FAQAccordionItem
                            key={index}
                            item={faq}
                            isOpen={openIndex === index}
                            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
