import { motion } from "framer-motion";
import { ChevronRight, ShieldCheck, Zap, Globe, Lock, Book, FileText, Settings } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const docsContent = {
    protocol: {
        title: "Protocol Overview",
        icon: <Zap className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        Industrial Privacy Layer
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Invoix leverages **Arcium v0.5.2** for Tier-0 Confidentiality. Unlike standard blockchain transactions,
                        sensitive invoice details are encrypted client-side using <code className="text-primary">x25519</code>
                        and <code className="text-primary">RescueCipher</code>.
                    </p>
                    <ul className="mt-4 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                        <li>Multi-Party Execution (MXE) for verifiable off-chain compute</li>
                        <li>Trusted Execution Environment (TEE) enforced authorizations</li>
                        <li>Zero-Knowledge proof of state existence</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2">Settlement Layer</h4>
                        <p className="text-sm text-muted-foreground">
                            High-velocity settlement on Solana Mainnet/Devnet supporting USDC, EURC, and native SOL.
                            Sub-400ms finality ensures instant business liquidity.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2">Atomic Integrity</h4>
                        <p className="text-sm text-muted-foreground">
                            REPLAY-GUARD™ technology prevents transaction double-counting across payment and NFT services
                            using a global signature ledger.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    whitepaper: {
        title: "Technical Whitepaper",
        icon: <FileText className="w-5 h-5" />,
        content: (
            <div className="prose prose-invert max-w-none">
                <h2 className="text-3xl font-bold mb-6">The Path to Trillion-Dollar B2B</h2>
                <p className="text-lg text-muted-foreground mb-8">
                    Traditional B2B settlement is broken. With "Net 30" friction and 2.9% legacy fees, enterprises lose
                    billions in liquidity and efficiency every year.
                </p>
                <div className="space-y-6">
                    <section>
                        <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">State Compression (cNFTs)</h3>
                        <p className="text-muted-foreground">
                            Invoix utilizes Solana's state compression to mint Proof-of-Payment receipts for fractions of a cent.
                            Our Merkle Tree architecture allows for billions of audit-ready records without bloating on-chain costs.
                        </p>
                    </section>
                    <section>
                        <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">Gasless Enterprise Experience</h3>
                        <p className="text-muted-foreground">
                            Through advanced relayer patterns, businesses can sign transactions without holding SOL for gas fees.
                            Invoix abstracts the complexity of blockchain while maintaining decentralized settlement.
                        </p>
                    </section>
                </div>
            </div>
        )
    },
    setup: {
        title: "Developer Setup",
        icon: <Settings className="w-5 h-5" />,
        content: (
            <div className="space-y-6">
                <h3 className="text-2xl font-bold">Quick Start Guide</h3>
                <div className="glass p-6 rounded-2xl bg-black/40 font-mono text-sm border border-white/5">
                    <pre className="text-pink-400">
                        {`# Clone the repository
git clone https://github.com/RYthaGOD/invoix.git
cd invoix

# Initialize Environment
cp .env.example .env

# Run Industrial Build
npm install
npm run dev`}
                    </pre>
                </div>
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                        Security Requirements
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        Ensure your <code className="text-primary">ARCIUM_PROGRAM_ID</code> is correctly set in your environment variables.
                        Testing on Devnet requires a funded wallet (solana airdrop).
                    </p>
                </div>
            </div>
        )
    }
};

export default function Docs() {
    const [activeTab, setActiveTab] = useState<keyof typeof docsContent>("protocol");

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-primary/30">
            {/* Background elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2" />
            </div>

            <header className="fixed top-0 w-full z-40 glass border-b border-white/5 py-4 px-8 flex justify-between items-center backdrop-blur-xl">
                <Link href="/">
                    <a className="flex items-center space-x-3 group">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" />
                        <span className="font-heading font-bold text-xl tracking-tighter">
                            Invoix <span className="text-muted-foreground font-normal">Docs</span>
                        </span>
                    </a>
                </Link>
                <Link href="/invoices">
                    <a className="btn-primary py-2 px-6 text-sm">Dashboard →</a>
                </Link>
            </header>

            <main className="container mx-auto pt-32 pb-20 px-6">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Sidebar */}
                    <aside className="w-full lg:w-64 space-y-2 lg:sticky lg:top-32 h-fit">
                        {Object.entries(docsContent).map(([id, item]) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === id
                                        ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium text-sm">{item.title}</span>
                                {activeTab === id && <ChevronRight className="w-4 h-4 ml-auto" />}
                            </button>
                        ))}
                    </aside>

                    {/* Content Area */}
                    <section className="flex-1 max-w-4xl min-h-[60vh]">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-10 tracking-tight">
                                {docsContent[activeTab].title}
                            </h1>
                            <div className="pb-20">
                                {docsContent[activeTab].content}
                            </div>
                        </motion.div>
                    </section>
                </div>
            </main>

            <footer className="border-t border-white/5 py-10 mt-20">
                <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
                    © 2025 Invoix Protocol. Built for Industrial Solana Commerce.
                </div>
            </footer>
        </div>
    );
}
