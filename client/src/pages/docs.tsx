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
                <div className="card-flat border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-primary" />
                        What is Invoix?
                    </h3>
                    <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                        <strong className="text-foreground">Invoix is the industrial settlement layer for B2B commerce on Solana.</strong> We enable businesses to create, send, and settle invoices in under 400ms with military-grade privacy—replacing legacy Net-30 payment terms with instant, trustless value transfer.
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="card-flat p-4">
                            <div className="text-3xl font-bold text-primary">&lt;400ms</div>
                            <div className="text-xs text-muted-foreground mt-1">Settlement Time</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="text-3xl font-bold text-green-500">1%</div>
                            <div className="text-xs text-muted-foreground mt-1">Platform Fee</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="text-3xl font-bold text-cyan-500">$0.001</div>
                            <div className="text-xs text-muted-foreground mt-1">Per NFT Receipt</div>
                        </div>
                    </div>
                </div>

                {/* Privacy Section */}
                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        Industrial Privacy Layer (Arcium v0.5.2)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Unlike standard blockchain transactions, sensitive invoice details (line items, pricing, parties) are encrypted client-side using <code className="text-primary">x25519</code> and <code className="text-primary">RescueCipher</code> before ever leaving the browser.
                    </p>
                    <ul className="mt-4 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                        <li><strong className="text-foreground">Multi-Party Execution (MXE)</strong>: Verifiable off-chain compute in Trusted Execution Environments</li>
                        <li><strong className="text-foreground">TEE Enforced Access</strong>: Even database admins cannot view your commercial data</li>
                        <li><strong className="text-foreground">Zero-Knowledge Proofs</strong>: Verify invoice existence without revealing contents</li>
                    </ul>
                </div>

                {/* Core Capabilities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card-flat bg-muted/30">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            Settlement Layer
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            High-velocity settlement on Solana Mainnet/Devnet supporting <strong className="text-foreground">USDC, EURC, USDT,</strong> and native <strong className="text-foreground">SOL</strong>. Sub-400ms finality for instant business liquidity.
                        </p>
                    </div>
                    <div className="card-flat bg-muted/30">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-400" />
                            Atomic Integrity
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            <strong className="text-foreground">REPLAY-GUARD™</strong> technology prevents transaction double-counting across payment and NFT services using a global signature ledger.
                        </p>
                    </div>
                    <div className="card-flat bg-muted/30">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            8K Premium NFT Receipts
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Every payment mints a <strong className="text-foreground">Compressed NFT (cNFT)</strong> receipt with 8K 3D visuals—immutable proof-of-payment for your accounting department.
                        </p>
                    </div>
                    <div className="card-flat bg-muted/30">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-400" />
                            Gasless UX
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            Businesses sign transactions without holding SOL for gas. Our relayer abstracts blockchain complexity while maintaining full decentralization.
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
                <div className="card-flat border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Coins className="w-6 h-6 text-green-400" />
                        Revenue Streams
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 card-flat">
                            <div>
                                <div className="font-bold text-foreground">Transaction Fee</div>
                                <div className="text-sm text-muted-foreground">Applied to every settled invoice</div>
                            </div>
                            <div className="text-2xl font-bold text-green-400">1%</div>
                        </div>
                        <div className="flex items-center justify-between p-4 card-flat">
                            <div>
                                <div className="font-bold text-foreground">Premium Upgrade</div>
                                <div className="text-sm text-muted-foreground">One-time payment for API access, branding, deep privacy</div>
                            </div>
                            <div className="text-2xl font-bold text-primary">0.25 SOL</div>
                        </div>
                        <div className="flex items-center justify-between p-4 card-flat">
                            <div>
                                <div className="font-bold text-foreground">NFT Collection Revenue</div>
                                <div className="text-sm text-muted-foreground">Community NFT drops (1000 total supply)</div>
                            </div>
                            <div className="text-2xl font-bold text-cyan-400">$0.50-$5</div>
                        </div>
                    </div>
                </div>

                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl">Market Opportunity</h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        The global B2B payments market is valued at <strong className="text-foreground">$125 trillion annually</strong>. Legacy systems extract 2-3% in fees with 30-90 day settlement delays. Invoix captures this value with instant settlement and transparent 1% fees.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center mt-6">
                        <div className="card-flat p-4">
                            <div className="text-2xl font-bold text-foreground">$125T</div>
                            <div className="text-xs text-muted-foreground">Annual B2B Volume</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="text-2xl font-bold text-primary">2.9%</div>
                            <div className="text-xs text-muted-foreground">Legacy Fee (We charge 1%)</div>
                        </div>
                    </div>
                </div>

                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <BadgePercent className="w-5 h-5 text-primary" />
                        Pricing Tiers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card-flat">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Free Tier</div>
                            <div className="text-3xl font-bold text-foreground mb-2">$0</div>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>✓ Unlimited Invoices</li>
                                <li>✓ SOL, USDC, EURC Payments</li>
                                <li>✓ Basic Analytics</li>
                                <li>✓ Community Support</li>
                            </ul>
                        </div>
                        <div className="card-flat border-2 border-primary/20 bg-primary/5">
                            <div className="text-sm text-primary uppercase tracking-wider mb-2">Premium</div>
                            <div className="text-3xl font-bold text-foreground mb-2">0.25 SOL</div>
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
                <div className="card-flat border-2 border-green-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">1</div>
                        <h4 className="text-xl font-bold text-foreground">Institutional Foundation</h4>
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

                {/* Phase 2 - In Progress */}
                <div className="card-flat border-2 border-yellow-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">2</div>
                        <h4 className="text-xl font-bold text-foreground">Recurring Economy</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-yellow-500/20 text-yellow-400 rounded-full">IN PROGRESS</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Subscription Streams (Token Extensions)</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Conditional Invoices (Milestone Releases)</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Enterprise Oracle Integration (ERP)</li>
                    </ul>
                </div>

                {/* Phase 3 - Future */}
                <div className="card-flat">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-foreground font-bold">3</div>
                        <h4 className="text-xl font-bold text-foreground">Tradeable Debt</h4>
                        <span className="ml-auto px-3 py-1 text-xs font-bold bg-white/10 text-muted-foreground rounded-full">PLANNED</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground pl-11">
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Invoice Factoring (RWA NFTs)</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Liquidity Pools for Accounts Receivable</li>
                        <li className="flex items-center gap-2"><span className="text-muted-foreground">○</span> Cross-Chain Settlement (Wormhole)</li>
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
                <div className="card-flat">
                    <h2 className="text-3xl font-bold mb-6">Abstract</h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Traditional B2B settlement suffers from multi-day latency, opaque fee structures (~2.9%), and zero confidentiality guarantees. Invoix introduces a <strong className="text-foreground">Hardened Hybrid Architecture</strong> combining Arcium's confidential computing with Solana's sub-second finality to create the first industrial-grade B2B settlement layer.
                    </p>
                </div>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground border-l-2 border-primary pl-4">1. State Compression (cNFTs)</h3>
                    <p className="text-muted-foreground">
                        Invoix utilizes Solana's <strong className="text-foreground">Merkle Tree state compression</strong> to mint Proof-of-Payment receipts for ~$0.001 each. Our architecture supports <strong className="text-foreground">billions of audit-ready records</strong> without on-chain storage bloat.
                    </p>
                    <div className="glass p-4 rounded-xl border border-white/5 text-sm font-mono text-muted-foreground">
                        Cost per NFT: ~0.00001 SOL (vs 0.02 SOL for standard NFTs)<br />
                        Tree Capacity: 16,384 NFTs per tree (~$0.005 setup)
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground border-l-2 border-primary pl-4">2. The "Glass Citadel" Protocol (Arcium MXE)</h3>
                    <p className="text-muted-foreground">
                        AwibPay and similar "burner wallet" tools offer black-box anonymity, which is incompatible with corporate treasury standards. Invoix utilizes Arcium's <strong className="text-foreground">Multi-Party Execution (MXE)</strong> to build a "Glass Citadel":
                    </p>
                    <div className="glass p-4 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-400 mt-1" />
                            <div>
                                <strong className="text-foreground block">Composite Privacy</strong>
                                <span className="text-sm text-muted-foreground">Transactions are encrypted from competitors and the public, but selectively transparent to holders of the <strong>Auditor View Key</strong> for regulatory compliance.</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Lock className="w-5 h-5 text-primary mt-1" />
                            <div>
                                <strong className="text-foreground block">Fail-Closed Encryption</strong>
                                <span className="text-sm text-muted-foreground">Uses x25519 key exchange + RescueCipher. If the TEE cannot guarantee secrecy, the transaction aborts. No plaintext fallbacks.</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground border-l-2 border-primary pl-4">3. REPLAY-GUARD™ Technology</h3>
                    <p className="text-muted-foreground">
                        The Industrial Signature Ledger tracks every transaction signature globally, preventing replay attacks across payment and NFT services. Combined with atomic database transactions, this ensures 100% financial integrity.
                    </p>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground border-l-2 border-primary pl-4">4. 8K Premium Visual Engine</h3>
                    <p className="text-muted-foreground">
                        All NFTs are rendered using our <strong className="text-foreground">High-Fidelity 3D SVG Engine</strong> featuring:
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
                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        What You Get
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card-flat p-4">
                            <div className="font-bold text-foreground mb-1">RESTful API</div>
                            <div className="text-sm text-muted-foreground">Full CRUD operations for invoices, customers, and payments</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="font-bold text-foreground mb-1">Webhook Events</div>
                            <div className="text-sm text-muted-foreground">Real-time notifications for payment confirmations</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="font-bold text-foreground mb-1">NFT Minting</div>
                            <div className="text-sm text-muted-foreground">Programmatic 8K Premium NFT receipt generation</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="font-bold text-foreground mb-1">Arcium Privacy</div>
                            <div className="text-sm text-muted-foreground">TEE-encrypted invoice data for enterprise confidentiality</div>
                        </div>
                    </div>
                </div>

                {/* Use Cases */}
                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl">Use Cases</h4>
                    <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-foreground">E-Commerce Platforms</strong>
                                <p className="text-sm">Generate invoices automatically after checkout with instant crypto settlement</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-foreground">SaaS Billing</strong>
                                <p className="text-sm">Integrate subscription invoicing with automated receipt NFTs for your customers</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-foreground">Freelance Marketplaces</strong>
                                <p className="text-sm">Enable creators to invoice clients with verifiable on-chain payment proofs</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-green-400 text-xs">✓</span>
                            </div>
                            <div>
                                <strong className="text-foreground">DAO Treasury Management</strong>
                                <p className="text-sm">Automate contractor payments with immutable audit trails</p>
                            </div>
                        </li>
                    </ul>
                </div>

                {/* API Endpoints Preview */}
                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl">API Endpoints</h4>
                    <div className="space-y-2 text-sm font-mono">
                        <div className="flex items-center gap-4 p-3 card-flat">
                            <span className="text-green-400 w-16 font-bold">GET</span>
                            <span className="text-foreground">/api/v1/invoices</span>
                            <span className="text-muted-foreground ml-auto text-xs">List all invoices</span>
                        </div>
                        <div className="flex items-center gap-4 p-3 card-flat">
                            <span className="text-yellow-400 w-16 font-bold">POST</span>
                            <span className="text-foreground">/api/v1/invoices</span>
                            <span className="text-muted-foreground ml-auto text-xs">Create invoice</span>
                        </div>
                        <div className="flex items-center gap-4 p-3 card-flat">
                            <span className="text-yellow-400 w-16 font-bold">POST</span>
                            <span className="text-foreground">/api/v1/payments/relay</span>
                            <span className="text-muted-foreground ml-auto text-xs">Gasless payment</span>
                        </div>
                        <div className="flex items-center gap-4 p-3 card-flat">
                            <span className="text-green-400 w-16 font-bold">GET</span>
                            <span className="text-foreground">/api/v1/nft/:invoiceId</span>
                            <span className="text-muted-foreground ml-auto text-xs">Get NFT metadata</span>
                        </div>
                    </div>
                </div>

                {/* Rate Limits */}
                <div className="card-flat">
                    <h4 className="font-bold mb-4 text-xl flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                        Rate Limits & Policies
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="card-flat p-4">
                            <div className="text-2xl font-bold text-foreground">1,000</div>
                            <div className="text-xs text-muted-foreground">Requests/hour</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="text-2xl font-bold text-foreground">100</div>
                            <div className="text-xs text-muted-foreground">Invoices/day</div>
                        </div>
                        <div className="card-flat p-4">
                            <div className="text-2xl font-bold text-foreground">∞</div>
                            <div className="text-xs text-muted-foreground">NFT Mints</div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                        Enterprise rate limit increases available upon request. All API keys are SHA-256 hashed and never stored in plaintext.
                    </p>
                </div>

                {/* Application Process */}
                <div className="card-flat border-2 border-cyan-500/20">
                    <h4 className="font-bold mb-4 text-xl">Application Process</h4>
                    <ol className="space-y-4 text-muted-foreground">
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">1</div>
                            <div>
                                <strong className="text-foreground">Submit Application</strong>
                                <p className="text-sm">Tell us about your project and use case</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">2</div>
                            <div>
                                <strong className="text-foreground">Review (24-48 hours)</strong>
                                <p className="text-sm">Our team reviews your application</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">3</div>
                            <div>
                                <strong className="text-foreground">Receive API Key</strong>
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
                <div className="card-flat border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What is Invoix?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Invoix is a B2B invoicing and payment platform built on Solana.</strong> It lets businesses create professional invoices, accept crypto payments (USDC, USDT, SOL), and automatically mint NFT receipts for permanent audit trails. Payments settle in under 400ms.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What are the fees?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">1% platform fee on all payments.</strong> There are no subscription fees, no hidden costs. NFT receipt minting costs approximately $0.001 per receipt using Solana's compressed NFT technology.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Which currencies are supported?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        We currently support <strong className="text-foreground">USDC, USDT, EURC, PYUSD, and native SOL</strong>. All stablecoins use their official SPL token mints on Solana Mainnet. More tokens will be added based on community demand.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What is Glass Citadel™?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Glass Citadel is our <strong className="text-foreground">privacy + auditability architecture</strong>. Invoice details (line items, amounts, parties) are encrypted with Arcium MXE technology. Payments are public on-chain, but the details behind them remain private—unless you share them with auditors via a View Key.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Do I need a wallet to use Invoix?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Yes, you'll need a Solana wallet</strong> like Phantom, Solflare, or Backpack to connect and receive payments. Invoice recipients can pay via QR code scan with any Solana Pay-compatible wallet.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> What are the NFT receipts?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        Every payment automatically mints a <strong className="text-foreground">Compressed NFT (cNFT)</strong> to your wallet. These serve as permanent, on-chain proof of payment for your accounting and tax records. They're grouped in a verified Metaplex collection and viewable on marketplaces like Magic Eden.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Is my data secure?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Yes.</strong> Invoice data is encrypted client-side using x25519 + RescueCipher before it ever leaves your browser. Even our database admins cannot read your commercial data. Payments use battle-tested Solana security with atomic transaction guarantees.
                    </p>
                </div>

                <div className="card-flat">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-primary">Q:</span> Can my customers pay without signing up?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Yes!</strong> Share your invoice link or QR code with customers. They can pay directly from any Solana wallet—no Invoix account required. The payment is verified automatically and you get an instant notification.
                    </p>
                </div>

                <div className="card-flat border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-cyan-400">Q:</span> Is there an API?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Yes, API access is available by application.</strong> You can create invoices, process payments, and mint NFT receipts programmatically. Check the <strong className="text-cyan-400">API Access</strong> section for details on how to apply.
                    </p>
                </div>
            </div>
        )
    }
};

export default function Docs() {
    const [activeTab, setActiveTab] = useState<keyof typeof docsContent>("protocol");

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Devnet Banner */}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-400 text-amber-900 py-2 px-4 text-center text-sm font-semibold">
                <span className="inline-flex items-center gap-2">
                    <span>⚠️</span>
                    DEVNET ONLY — This is a testnet deployment. Do not use real funds.
                    <span>⚠️</span>
                </span>
            </div>

            {/* Glass Navigation Bar */}
            <nav className="fixed w-full top-14 z-50 transition-all duration-300 bg-white/80 backdrop-blur-xl shadow-sm border-b border-border/50">
                <div className="container-custom">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/">
                            <a className="flex items-center gap-2 cursor-pointer group">
                                <div className="w-8 h-8 flex items-center justify-center gradient-primary rounded-lg group-hover:scale-105 transition-transform">
                                    <span className="font-bold text-white text-lg">I</span>
                                </div>
                                <span className="font-heading font-bold text-xl text-foreground">
                                    Invoix
                                </span>
                                <span className="text-xs text-muted-foreground font-medium ml-2">/ Docs</span>
                            </a>
                        </Link>
                        <Link href="/invoices">
                            <a className="btn-primary text-sm px-6 py-2">Dashboard</a>
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="container-custom pt-40 pb-20">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Sidebar */}
                    <aside className="w-full lg:w-64 space-y-2 lg:sticky lg:top-40 h-fit">
                        {Object.entries(docsContent).map(([id, item]) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === id
                                    ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
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
                            <h1 className="text-4xl md:text-5xl font-bold mb-10 text-foreground">
                                {docsContent[activeTab].title}
                            </h1>
                            <div className="pb-20">
                                {docsContent[activeTab].content}
                            </div>
                        </motion.div>
                    </section>
                </div>
            </main>

            <footer className="border-t border-border py-10 mt-20 bg-background">
                <div className="container-custom text-center text-muted-foreground text-sm">
                    © 2025 Invoix. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
