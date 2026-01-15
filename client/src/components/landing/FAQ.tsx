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
        answer: "Invoix is a modern invoicing platform built on Solana. Create, send, and track invoices with instant cryptocurrency payments and blockchain security."
    },
    {
        question: "Is Invoix free to use?",
        answer: "Yes! The Starter tier is completely free with unlimited invoices. Premium features like encryption, custom branding, and priority support require a one-time upgrade."
    },
    {
        question: "Which cryptocurrencies are supported?",
        answer: "Invoix currently supports SOL, USDC, USDT, EURC, and PYUSD. All payments settle directly to your wallet with no intermediaries."
    },
    {
        question: "What are NFT Receipts?",
        answer: "Every successful payment automatically mints an NFT receipt as immutable proof of payment. Perfect for audits, compliance, and accounting."
    },
    {
        question: "How is my data secured?",
        answer: "All sensitive data is encrypted using Arcium's confidential computing. Only authorized parties can decrypt invoice details. Authentication uses blockchain signatures for maximum security."
    },
    {
        question: "Is Invoix on Mainnet?",
        answer: "Invoix is currently live on Solana Devnet for public testing. Mainnet launch is planned after completing security audits. Do not use real funds on the current deployment."
    }
];

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="border-b border-border last:border-none"
        >
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between py-6 text-left group"
            >
                <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors pr-8">
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
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <p className="text-muted-foreground pb-6 leading-relaxed">
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
        <section id="faq" className="section-padding bg-background">
            <div className="container-custom">
                <div className="max-w-4xl mx-auto">
                    {/* Section Header */}
                    <motion.div
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                            <span className="text-sm font-medium">FAQ</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                            Frequently asked questions
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Have a different question? Contact our{" "}
                            <a href="mailto:support@invoix.io" className="text-primary hover:underline">
                                support team
                            </a>
                        </p>
                    </motion.div>

                    {/* FAQ Accordion */}
                    <div className="card-flat">
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
            </div>
        </section>
    );
}
