import { motion } from "framer-motion";
import { ChevronRight, ShieldCheck, Zap, Globe, Lock, Book, FileText, Settings, TrendingUp, Coins, Users, Layers, Sparkles, BadgePercent, Code } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const docsContent = {
    protocol: {
        title: "Protocol Overview",
        icon: <Zap className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                {/* Executive Summary Card */}
                <div className="glass-card p-8 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-primary" />
                        What is Invoix?
                    </h3>
                    <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                        <strong className="text-white">Invoix is the industrial settlement layer for B2B commerce on Solana.</strong> We enable businesses to create, send, and settle invoices in under 400ms with military-grade privacy—replacing legacy Net-30 payment terms with instant, trustless value transfer.
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="glass p-4 rounded-xl border border-white/10">
                            <div className="text-3xl font-bold text-primary">&lt;400ms</div>
                            <div className="text-xs text-muted-foreground">Settlement Time</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/10">
                            <div className="text-3xl font-bold text-green-400">1%</div>
                            <div className="text-xs text-muted-foreground">Platform Fee</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/10">
                            <div className="text-3xl font-bold text-cyan-400">$0.001</div>
                            <div className="text-xs text-muted-foreground">Per NFT Receipt</div>
                        </div>
                    </div>
                </div>

                {/* Privacy Section */}
                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        Industrial Privacy Layer (Arcium v0.5.2)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Unlike standard blockchain transactions, sensitive invoice details (line items, pricing, parties) are encrypted client-side using <code className="text-primary">x25519</code> and <code className="text-primary">RescueCipher</code> before ever leaving the browser.
                    </p>
                    <ul className="mt-4 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                        <li><strong className="text-white">Multi-Party Execution (MXE)</strong>: Verifiable off-chain compute in Trusted Execution Environments</li>
                        <li><strong className="text-white">TEE Enforced Access</strong>: Even database admins cannot view your commercial data</li>
                        <li><strong className="text-white">Zero-Knowledge Proofs</strong>: Verify invoice existence without revealing contents</li>
                    </ul>
                </div>

                {/* Core Capabilities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            Settlement Layer
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            High-velocity settlement on Solana Mainnet/Devnet supporting <strong className="text-white">USDC, EURC, USDT,</strong> and native <strong className="text-white">SOL</strong>. Sub-400ms finality for instant business liquidity.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-400" />
                            Atomic Integrity
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            <strong className="text-white">REPLAY-GUARD™</strong> technology prevents transaction double-counting across payment and NFT services using a global signature ledger.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            8K Premium NFT Receipts
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Every payment mints a <strong className="text-white">Compressed NFT (cNFT)</strong> receipt with 8K 3D visuals—immutable proof-of-payment for your accounting department.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-400" />
                            Gasless UX
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Businesses sign transactions without holding SOL for gas. Our relayer abstracts blockchain complexity while maintaining full decentralization.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            Recurring Economy
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Manage subscriptions with <strong className="text-white">automated recurring billing</strong>. Token extensions enable streaming payments and conditional release milestones.
                        </p>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <BadgePercent className="w-4 h-4 text-pink-400" />
                            Capital Markets
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Access instant liquidity by selling unpaid invoices in a <strong className="text-white">non-custodial marketplace</strong>. Dynamic risk scoring and transparent yield generation for investors.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    business: {
        title: "Business Model",
        icon: <TrendingUp className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                <div className="glass-card p-8 border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Coins className="w-6 h-6 text-green-400" />
                        Revenue Streams
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/10">
                            <div>
                                <div className="font-bold text-white">Transaction Fee</div>
                                <div className="text-sm text-muted-foreground">Applied to every settled invoice</div>
                            </div>
                            <div className="text-2xl font-bold text-green-400">1%</div>
                        </div>
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/10">
                            <div>
                                <div className="font-bold text-white">Premium Upgrade</div>
                                <div className="text-sm text-muted-foreground">One-time payment for API access, branding, deep privacy</div>
                            </div>
                            <div className="text-2xl font-bold text-primary">0.25 SOL</div>
                        </div>
                        <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/10">
                            <div>
                                <div className="font-bold text-white">NFT Collection Revenue</div>
                                <div className="text-sm text-muted-foreground">Community NFT drops (1000 total supply)</div>
                            </div>
                            <div className="text-2xl font-bold text-cyan-400">$0.50-$5</div>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Market Opportunity</h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        The global B2B payments market is valued at <strong className="text-white">$125 trillion annually</strong>. Legacy systems extract 2-3% in fees with 30-90 day settlement delays. Invoix captures this value with instant settlement and transparent 1% fees.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center mt-6">
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="text-2xl font-bold text-white">$125T</div>
                            <div className="text-xs text-muted-foreground">Annual B2B Volume</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="text-2xl font-bold text-primary">2.9%</div>
                            <div className="text-xs text-muted-foreground">Legacy Fee (We charge 1%)</div>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <BadgePercent className="w-5 h-5 text-primary" />
                        Pricing Tiers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass p-6 rounded-xl border border-white/5">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Free Tier</div>
                            <div className="text-3xl font-bold text-white mb-2">$0</div>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>✓ Unlimited Invoices</li>
                                <li>✓ SOL, USDC, EURC Payments</li>
                                <li>✓ Basic Analytics</li>
                                <li>✓ Community Support</li>
                            </ul>
                        </div>
                        <div className="glass p-6 rounded-xl border border-primary/30 bg-primary/5">
                            <div className="text-sm text-primary uppercase tracking-wider mb-2">Premium</div>
                            <div className="text-3xl font-bold text-white mb-2">0.25 SOL</div>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>✓ Everything in Free</li>
                                <li>✓ Deep Privacy (Arcium)</li>
                                <li>✓ Custom Branding</li>
                                <li>✓ Developer API Access</li>
                                <li>✓ 8K NFT Receipts</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    roadmap: {
        title: "Roadmap",
        icon: <Book className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                <p className="text-lg text-muted-foreground">
                    Invoix is executing a phased roadmap to become the dominant B2B settlement layer on Solana and beyond.
                </p>

                {/* Phase 1 - Complete */}
                <div className="glass-card p-6 border-green-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">1</div>
                        <h4 className="text-xl font-bold text-white">Institutional Foundation</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">COMPLETE</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Invoicing Engine (Atomic Sequential)</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Solana/USDC/EURC/SOL Settlement</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 8K Premium 3D NFT Receipts</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Arcium v0.5.2 Industrial Privacy</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> REPLAY-GUARD™ & XSS-SHIELD™</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Midnight Prism 3.0 UI</li>
                    </ul>
                </div>

                {/* Phase 2 - Complete */}
                <div className="glass-card p-6 border-green-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">2</div>
                        <h4 className="text-xl font-bold text-white">Recurring Economy</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">COMPLETE</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Subscription Streams (Token Extensions)</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Enterprise Oracle Integration (Webhooks)</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Recurring Billing Dashboard</li>
                    </ul>
                </div>

                {/* Phase 3 - Complete */}
                <div className="glass-card p-6 border-green-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">3</div>
                        <h4 className="text-xl font-bold text-white">Decentralized Capital Markets</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">COMPLETE</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Non-Custodial Invoice Marketplace (Live)</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Risk Scoring & Credit Protocol</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Tax Reporting & Annual Exports</li>
                        <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Dynamic Yield Generation</li>
                    </ul>
                </div>

                {/* Phase 4 - In Progress */}
                <div className="glass-card p-6 border-yellow-500/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">4</div>
                        <h4 className="text-xl font-bold text-white">Enterprise & Scale</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-yellow-500/20 text-yellow-400 rounded-full">IN PROGRESS</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Liquidity Pools for Accounts Receivable</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Cross-Chain Settlement (Wormhole)</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> White-Label Solutions</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Multi-Signature Treasury</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Fiat On/Off Ramps Integration</li>
                    </ul>
                </div>
            </div>
        )
    },
    whitepaper: {
        title: "Technical Whitepaper",
        icon: <FileText className="w-5 h-5" />,
        content: (
            <div className="prose prose-invert max-w-none space-y-8">
                <div className="glass-card p-8 border-white/10">
                    <h2 className="text-3xl font-bold mb-6">Abstract</h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Traditional B2B settlement suffers from multi-day latency, opaque fee structures (~2.9%), and zero confidentiality guarantees. Invoix introduces a <strong className="text-white">Hardened Hybrid Architecture</strong> combining Arcium's confidential computing with Solana's sub-second finality to create the first industrial-grade B2B settlement layer.
                    </p>
                </div>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">1. State Compression (cNFTs)</h3>
                    <p className="text-muted-foreground">
                        Invoix utilizes Solana's <strong className="text-white">Merkle Tree state compression</strong> to mint Proof-of-Payment receipts for ~$0.001 each. Our architecture supports <strong className="text-white">billions of audit-ready records</strong> without on-chain storage bloat.
                    </p>
                    <div className="glass p-4 rounded-xl border border-white/5 text-sm font-mono text-muted-foreground">
                        Cost per NFT: ~0.00001 SOL (vs 0.02 SOL for standard NFTs)<br />
                        Tree Capacity: 16,384 NFTs per tree (~$0.005 setup)
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">2. The "Glass Citadel" Protocol (Arcium MXE)</h3>
                    <p className="text-muted-foreground">
                        AwibPay and similar "burner wallet" tools offer black-box anonymity, which is incompatible with corporate treasury standards. Invoix utilizes Arcium's <strong className="text-white">Multi-Party Execution (MXE)</strong> to build a "Glass Citadel":
                    </p>
                    <div className="glass p-4 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-400 mt-1" />
                            <div>
                                <strong className="text-white block">Composite Privacy</strong>
                                <span className="text-sm text-muted-foreground">Transactions are encrypted from competitors and the public, but selectively transparent to holders of the <strong>Auditor View Key</strong> for regulatory compliance.</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Lock className="w-5 h-5 text-primary mt-1" />
                            <div>
                                <strong className="text-white block">Fail-Closed Encryption</strong>
                                <span className="text-sm text-muted-foreground">Uses x25519 key exchange + RescueCipher. If the TEE cannot guarantee secrecy, the transaction aborts. No plaintext fallbacks.</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">3. REPLAY-GUARD™ Technology</h3>
                    <p className="text-muted-foreground">
                        The Industrial Signature Ledger tracks every transaction signature globally, preventing replay attacks across payment and NFT services. Combined with atomic database transactions, this ensures 100% financial integrity.
                    </p>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-2 border-primary pl-4">4. 8K Premium Visual Engine</h3>
                    <p className="text-muted-foreground">
                        All NFTs are rendered using our <strong className="text-white">High-Fidelity 3D SVG Engine</strong> featuring:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>Midnight Prism glassmorphism gradients</li>
                        <li>feSpecularLighting and feDropShadow filters</li>
                        <li>Dynamic data injection (amounts, dates, parties)</li>
                        <li>Holographic Trading Cards for Community NFTs</li>
                    </ul>
                </section>
            </div>
        )
    },
    setup: {
        title: "API Access",
        icon: <Code className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                {/* Hero CTA */}
                <div className="glass-card p-8 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center">
                    <h3 className="text-2xl font-bold mb-4">Build on Invoix</h3>
                    <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                        Integrate industrial B2B settlement into your application. Create invoices, process payments, and mint NFT receipts programmatically.
                    </p>
                    <Link href="/">
                        <a
                            onClick={(e) => {
                                e.preventDefault();
                                // Trigger waitlist modal from landing page
                                window.location.href = "/?openWaitlist=true";
                            }}
                            className="btn-primary px-8 py-3 text-lg inline-flex items-center gap-2"
                        >
                            Apply for API Access
                            <ChevronRight className="w-5 h-5" />
                        </a>
                    </Link>
                </div>

                {/* What You Get */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        What You Get
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="font-bold text-white mb-1">RESTful API</div>
                            <div className="text-sm text-muted-foreground">Full CRUD operations for invoices, customers, and payments</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="font-bold text-white mb-1">Webhook Events</div>
                            <div className="text-sm text-muted-foreground">Real-time notifications for payment confirmations</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="font-bold text-white mb-1">NFT Minting</div>
                            <div className="text-sm text-muted-foreground">Programmatic 8K Premium NFT receipt generation</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="font-bold text-white mb-1">Arcium Privacy</div>
                            <div className="text-sm text-muted-foreground">TEE-encrypted invoice data for enterprise confidentiality</div>
                        </div>
                    </div>
                </div>

                {/* Use Cases */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Use Cases</h4>
                    <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-white">E-Commerce Platforms</strong>
                                <p className="text-sm">Generate invoices automatically after checkout with instant crypto settlement</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-white">SaaS Billing</strong>
                                <p className="text-sm">Integrate subscription invoicing with automated receipt NFTs for your customers</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-white">Freelance Marketplaces</strong>
                                <p className="text-sm">Enable creators to invoice clients with verifiable on-chain payment proofs</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-white">DAO Treasury Management</strong>
                                <p className="text-sm">Automate contractor payments with immutable audit trails</p>
                            </div>
                        </li>
                    </ul>
                </div>

                {/* API Endpoints - Comprehensive */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Complete API Reference</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                        All endpoints require authentication via <code className="text-primary">X-API-Key</code> header. Base URL: <code className="text-primary">{window.location.origin}/api</code>
                    </p>

                    {/* Invoice Management */}
                    <div className="mb-6">
                        <h5 className="text-sm font-bold text-white mb-3">Invoice Management</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/invoices</span>
                                <span className="text-muted-foreground ml-auto text-xs">List all invoices</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/invoices/:id</span>
                                <span className="text-muted-foreground ml-auto text-xs">Get invoice details</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/invoices</span>
                                <span className="text-muted-foreground ml-auto text-xs">Create new invoice</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-blue-400 w-16 font-bold">PATCH</span>
                                <span className="text-white">/invoices/:id</span>
                                <span className="text-muted-foreground ml-auto text-xs">Update invoice</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Processing */}
                    <div className="mb-6">
                        <h5 className="text-sm font-bold text-white mb-3">Payment Processing</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/payments/relay</span>
                                <span className="text-muted-foreground ml-auto text-xs">Gasless payment relay</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/solana-pay/:id</span>
                                <span className="text-muted-foreground ml-auto text-xs">Generate Solana Pay QR</span>
                            </div>
                        </div>
                    </div>

                    {/* Subscriptions */}
                    <div className="mb-6">
                        <h5 className="text-sm font-bold text-white mb-3">Subscriptions & Recurring Billing</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/subscriptions</span>
                                <span className="text-muted-foreground ml-auto text-xs">List subscriptions</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/subscriptions</span>
                                <span className="text-muted-foreground ml-auto text-xs">Create subscription plan</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/subscriptions/:id/cancel</span>
                                <span className="text-muted-foreground ml-auto text-xs">Cancel subscription</span>
                            </div>
                        </div>
                    </div>

                    {/* Marketplace */}
                    <div className="mb-6">
                        <h5 className="text-sm font-bold text-white mb-3">Invoice Marketplace</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/marketplace/listings</span>
                                <span className="text-muted-foreground ml-auto text-xs">Browse marketplace</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/marketplace/list</span>
                                <span className="text-muted-foreground ml-auto text-xs">List invoice for sale</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/marketplace/purchase</span>
                                <span className="text-muted-foreground ml-auto text-xs">Purchase listed invoice</span>
                            </div>
                        </div>
                    </div>

                    {/* Webhooks */}
                    <div className="mb-6">
                        <h5 className="text-sm font-bold text-white mb-3">Webhook Management</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/webhooks</span>
                                <span className="text-muted-foreground ml-auto text-xs">List webhook endpoints</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/webhooks</span>
                                <span className="text-muted-foreground ml-auto text-xs">Create webhook endpoint</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-red-400 w-16 font-bold">DELETE</span>
                                <span className="text-white">/webhooks/:id</span>
                                <span className="text-muted-foreground ml-auto text-xs">Delete webhook</span>
                            </div>
                        </div>
                    </div>

                    {/* NFT Operations */}
                    <div>
                        <h5 className="text-sm font-bold text-white mb-3">NFT Receipt Operations</h5>
                        <div className="space-y-2 text-sm font-mono">
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-green-400 w-16 font-bold">GET</span>
                                <span className="text-white">/nft/:invoiceId</span>
                                <span className="text-muted-foreground ml-auto text-xs">Get NFT metadata</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 glass rounded border border-white/5">
                                <span className="text-yellow-400 w-16 font-bold">POST</span>
                                <span className="text-white">/nft/mint-invoice/:id</span>
                                <span className="text-muted-foreground ml-auto text-xs">Mint receipt NFT</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Authentication & Security */}
                <div className="glass-card p-6 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-cyan-400" />
                        Authentication & Security
                    </h4>
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <div>
                            <strong className="text-white block mb-1">API Key Format</strong>
                            <code className="text-cyan-400 text-xs">X-API-Key: inv_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
                        </div>
                        <div>
                            <strong className="text-white block mb-1">Webhook Signature Verification</strong>
                            <p>Verify webhook authenticity using HMAC SHA-256 with your webhook secret:</p>
                            <code className="text-cyan-400 text-xs block mt-2">
                                signature = HMAC_SHA256(webhook_secret, request_body)
                            </code>
                        </div>
                        <div>
                            <strong className="text-white block mb-1">Error Handling</strong>
                            <p>All errors return standard HTTP status codes with JSON response bodies containing <code className="text-primary">error</code> and <code className="text-primary">message</code> fields.</p>
                        </div>
                    </div>
                </div>

                {/* Rate Limits */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                        Rate Limits & Policies
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="text-2xl font-bold text-white">1,000</div>
                            <div className="text-xs text-muted-foreground">Requests/hour</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="text-2xl font-bold text-white">100</div>
                            <div className="text-xs text-muted-foreground">Invoices/day</div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <div className="text-2xl font-bold text-white">∞</div>
                            <div className="text-xs text-muted-foreground">NFT Mints</div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                        Enterprise rate limit increases available upon request. All API keys are SHA-256 hashed and never stored in plaintext.
                    </p>
                </div>

                {/* Application Process */}
                <div className="glass-card p-6 border-cyan-500/30">
                    <h4 className="font-bold mb-4 text-xl">Application Process</h4>
                    <ol className="space-y-4 text-muted-foreground">
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">1</div>
                            <div>
                                <strong className="text-white">Submit Application</strong>
                                <p className="text-sm">Tell us about your project and use case</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">2</div>
                            <div>
                                <strong className="text-white">Review (24-48 hours)</strong>
                                <p className="text-sm">Our team reviews your application</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">3</div>
                            <div>
                                <strong className="text-white">Receive API Key</strong>
                                <p className="text-sm">Get your secret key via email and start building</p>
                            </div>
                        </li>
                    </ol>
                </div>
            </div>
        )
    },
    faq: {
        title: "FAQ",
        icon: <Book className="w-5 h-5" />,
        content: (
            <div className="space-y-6">
                <div className="glass-card p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What is Invoix?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Invoix is a B2B invoicing and payment platform built on Solana.</strong> It lets businesses create professional invoices, accept crypto payments (USDC, USDT, SOL), and automatically mint NFT receipts for permanent audit trails. Payments settle in under 400ms.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What are the fees?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">1% platform fee on all payments.</strong> There are no subscription fees, no hidden costs. NFT receipt minting costs approximately $0.001 per receipt using Solana's compressed NFT technology.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Which currencies are supported?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        We currently support <strong className="text-white">USDC, USDT, EURC, PYUSD, and native SOL</strong>. All stablecoins use their official SPL token mints on Solana Mainnet. More tokens will be added based on community demand.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What is Glass Citadel™?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Glass Citadel is our <strong className="text-white">privacy + auditability architecture</strong>. Invoice details (line items, amounts, parties) are encrypted with Arcium MXE technology. Payments are public on-chain, but the details behind them remain private—unless you share them with auditors via a View Key.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Do I need a wallet to use Invoix?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Yes, you'll need a Solana wallet</strong> like Phantom, Solflare, or Backpack to connect and receive payments. Invoice recipients can pay via QR code scan with any Solana Pay-compatible wallet.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What are the NFT receipts?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Every payment automatically mints a <strong className="text-white">Compressed NFT (cNFT)</strong> to your wallet. These serve as permanent, on-chain proof of payment for your accounting and tax records. They're grouped in a verified Metaplex collection and viewable on marketplaces like Magic Eden.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Is my data secure?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Yes.</strong> Invoice data is encrypted client-side using x25519 + RescueCipher before it ever leaves your browser. Even our database admins cannot read your commercial data. Payments use battle-tested Solana security with atomic transaction guarantees.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Can my customers pay without signing up?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Yes!</strong> Share your invoice link or QR code with customers. They can pay directly from any Solana wallet—no Invoix account required. The payment is verified automatically and you get an instant notification.
                    </p>
                </div>

                <div className="glass-card p-6 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-cyan-400">Q:</span> Is there an API?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Yes, API access is available by application.</strong> You can create invoices, process payments, and mint NFT receipts programmatically. Check the <strong className="text-cyan-400">API Access</strong> section for details on how to apply.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Can I automate recurring billing?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Absolutely.</strong> Our Subscription engine allows you to set up recurring invoices (daily, weekly, monthly) that are automatically emailed to clients. Payments are tracked and receipts minted automatically for every cycle.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> How does the Invoice Marketplace work?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Get paid instantly.</strong> You can list your unpaid invoices for sale on our non-custodial marketplace. Investors purchase the invoice (the NFT receipt rights) at a discount, giving you immediate cash flow while they earn a yield upon settlement.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> How do webhooks work?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Webhooks send real-time HTTP notifications</strong> to your server when events occur (invoice.paid, invoice.created, etc.). You can configure webhook endpoints in your dashboard and receive authenticated POST requests with event data. Perfect for ERP/CRM integration.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What is the marketplace discount rate?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Discount rates vary based on credit score and time to payment.</strong> Typically 5-15% depending on the buyer's risk assessment. Higher credit scores = lower discounts. You always see the exact cash you'll receive before confirming a sale.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> How does credit scoring work?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Our <strong className="text-white">on-chain credit protocol</strong> analyzes payment history, invoice velocity, settlement speed, and default rates. Scores range from 300-850. Better scores unlock lower marketplace fees and higher buyer confidence.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Can I white-label Invoix?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Enterprise white-label solutions are coming in Phase 4.</strong> Currently, Premium users get custom branding (logo, colors) on invoices and NFT receipts. Contact us for early enterprise access.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What are the technical requirements?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Minimal requirements:</strong> A Solana wallet (Phantom, Solflare, Backpack), internet connection, and modern browser (Chrome, Brave, Firefox). For API integration, any language that supports HTTP/REST is compatible.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> How do I handle failed payments?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Payments are atomic—they either succeed completely or fail completely.</strong> Failed transactions are never partially processed. You'll receive immediate feedback. For recurring billing, failed payments trigger retry logic with exponential backoff.
                    </p>
                </div>

                <div className="glass-card p-6 border-white/10">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What's the difference between invoices and subscriptions?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-white">Invoices are one-time</strong> payment requests. <strong className="text-white">Subscriptions automatically generate invoices</strong> on your chosen schedule (daily, weekly, monthly). Both support the same payment methods and mint NFT receipts.
                    </p>
                </div>
            </div >
        )
    },
    integrations: {
        title: "Integration Guides",
        icon: <Settings className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                {/* Quick Start */}
                <div className="glass-card p-8 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                        <Zap className="w-6 h-6 text-primary" />
                        Quick Start (5 Minutes)
                    </h3>
                    <ol className="space-y-4 text-muted-foreground">
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">1</div>
                            <div>
                                <strong className="text-white">Connect Your Wallet</strong>
                                <p className="text-sm">Visit the dashboard and connect your Solana wallet (Phantom, Solflare, etc.)</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">2</div>
                            <div>
                                <strong className="text-white">Create Your First Invoice</strong>
                                <p className="text-sm">Click "New Invoice", fill in customer details, line items, and select payment token</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">3</div>
                            <div>
                                <strong className="text-white">Share Payment Link</strong>
                                <p className="text-sm">Copy the invoice link or QR code and send it to your customer</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">4</div>
                            <div>
                                <strong className="text-white">Get Paid Instantly</strong>
                                <p className="text-sm">Customer pays → You receive funds + NFT receipt in \u003c400ms</p>
                            </div>
                        </li>
                    </ol>
                </div>

                {/* E-commerce Integration */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">E-Commerce Integration</h4>
                    <p className="text-muted-foreground mb-4">
                        Automatically generate invoices after checkout and offer crypto payment options.
                    </p>
                    <div className="glass p-4 rounded-xl border border-white/5 font-mono text-sm text-muted-foreground space-y-2">
                        <div><span className="text-green-400">// After successful checkout</span></div>
                        <div><span className="text-cyan-400">const</span> response = <span className="text-cyan-400">await</span> <span className="text-yellow-400">fetch</span>(<span className="text-green-300">'/api/v1/invoices'</span>, {'{'}</div>
                        <div className="pl-4">method: <span className="text-green-300">'POST'</span>,</div>
                        <div className="pl-4">headers: {'{'} <span className="text-green-300">'X-API-Key'</span>: apiKey {'}'},</div>
                        <div className="pl-4">body: <span className="text-yellow-400">JSON</span>.<span className="text-yellow-400">stringify</span>({'({'}</div>
                        <div className="pl-8">customerEmail: <span className="text-green-300">'customer@example.com'</span>,</div>
                        <div className="pl-8">amount: orderTotal,</div>
                        <div className="pl-8">currency: <span className="text-green-300">'USDC'</span>,</div>
                        <div className="pl-8">lineItems: [...]</div>
                        <div className="pl-4">{'})'}</div>
                        <div>{'});'}</div>
                    </div>
                </div>

                {/* Webhook Setup */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Webhook Setup</h4>
                    <p className="text-muted-foreground mb-4">
                        Receive real-time notifications for invoice and payment events.
                    </p>
                    <div className="space-y-3 text-sm">
                        <div className="glass p-3 rounded border border-white/5">
                            <strong className="text-white">1. Create Webhook Endpoint</strong>
                            <p className="text-muted-foreground text-xs mt-1">POST /api/webhooks with your URL</p>
                        </div>
                        <div className="glass p-3 rounded border border-white/5">
                            <strong className="text-white">2. Select Events</strong>
                            <p className="text-muted-foreground text-xs mt-1">invoice.paid, invoice.created, payment.failed, etc.</p>
                        </div>
                        <div className="glass p-3 rounded border border-white/5">
                            <strong className="text-white">3. Verify Signatures</strong>
                            <p className="text-muted-foreground text-xs mt-1">Use HMAC SHA-256 to verify webhook authenticity</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    advanced: {
        title: "Advanced Features",
        icon: <Layers className="w-5 h-5" />,
        content: (
            <div className="space-y-8">
                {/* Subscriptions */}
                <div className="glass-card p-6 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        Subscriptions & Recurring Billing
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        Create subscription plans that automatically generate and send invoices on your schedule.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <strong className="text-white block mb-2">Billing Frequencies</strong>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Daily (e.g., SaaS daily usage)</li>
                                <li>• Weekly (service contracts)</li>
                                <li>• Monthly (standard subscriptions)</li>
                                <li>• Custom intervals</li>
                            </ul>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/5">
                            <strong className="text-white block mb-2">Auto-Features</strong>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Invoice generation</li>
                                <li>• Email notifications</li>
                                <li> • Payment tracking</li>
                                <li>• NFT receipt minting</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Marketplace */}
                <div className="glass-card p-6 border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <BadgePercent className="w-5 h-5 text-cyan-400" />
                        Invoice Marketplace (Live)
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        Sell unpaid invoices to investors for instant liquidity. Non-custodial with transparent pricing.
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 glass rounded border border-white/5">
                            <span className="text-white font-medium">Listing Fee</span>
                            <span className="text-cyan-400">Free</span>
                        </div>
                        <div className="flex items-center justify-between p-3 glass rounded border border-white/5">
                            <span className="text-white font-medium">Typical Discount</span>
                            <span className="text-cyan-400">5-15%</span>
                        </div>
                        <div className="flex items-center justify-between p-3 glass rounded border border-white/5">
                            <span className="text-white font-medium">Settlement Time</span>
                            <span className="text-cyan-400">Instant</span>
                        </div>
                    </div>
                </div>

                {/* Credit Scoring */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Credit Scoring System</h4>
                    <p className="text-muted-foreground mb-4">
                        On-chain credit scores (300-850) based on payment history and reliability.
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="glass p-3 rounded border border-red-500/20">
                            <div className="text-red-400 font-bold">300-579</div>
                            <div className="text-xs text-muted-foreground">Poor</div>
                        </div>
                        <div className="glass p-3 rounded border border-yellow-500/20">
                            <div className="text-yellow-400 font-bold">580-669</div>
                            <div className="text-xs text-muted-foreground">Fair</div>
                        </div>
                        <div className="glass p-3 rounded border border-green-500/20">
                            <div className="text-green-400 font-bold">670-850</div>
                            <div className="text-xs text-muted-foreground">Good-Excellent</div>
                        </div>
                    </div>
                </div>

                {/* Tax Reporting */}
                <div className="glass-card p-6 border-white/10">
                    <h4 className="font-bold mb-4 text-xl">Tax Reporting & Exports</h4>
                    <p className="text-muted-foreground mb-4">
                        Generate annual tax reports with all payment data aggregated and ready for filing.
                    </p>
                    <div className="space-y-2 text-sm">
                        <div className="glass p-3 rounded border border-white/5 flex items-center justify-between">
                            <span className="text-white">CSV Export</span>
                            <span className="text-green-400 text-xs">Ready</span>
                        </div>
                        <div className="glass p-3 rounded border border-white/5 flex items-center justify-between">
                            <span className="text-white">PDF Reports</span>
                            <span className="text-green-400 text-xs">Ready</span>
                        </div>
                        <div className="glass p-3 rounded border border-white/5 flex items-center justify-between">
                            <span className="text-white">1099-Like Summaries</span>
                            <span className="text-green-400 text-xs">Ready</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
};

export default function Docs() {
    const [activeTab, setActiveTab] = useState<keyof typeof docsContent>("protocol");

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-primary/30 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
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
