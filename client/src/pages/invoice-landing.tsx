import { motion } from "framer-motion";
import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";
import {
  FileText,
  Lock,
  Zap,
  ArrowRight,
  Check,
  CreditCard,
  Users,
  BarChart3,
  Sparkles,
  Receipt,
  Building2,
  ChevronRight,
  Globe,
  Monitor,
  ShieldCheck,
  ShieldCheck,
  Copy,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useTokenStats } from "@/hooks/use-token-stats";
import { useToast } from "@/hooks/use-toast";

const TOKEN_ADDRESS = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";

export default function InvoiceLanding() {
  const { data: tokenStats, isLoading: isStatsLoading } = useTokenStats();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [mobileMenuOpen]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(TOKEN_ADDRESS);
    setCopied(true);
    toast({
      title: "Address Copied",
      description: "Token address copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-white">
      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 transition-all duration-300 glass border-b border-white/5">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <a className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full group-hover:bg-primary/40 transition-colors" />
                  <img src="/invoix-logo.jpg" alt="Invoix Logo" className="relative w-10 h-10 object-contain rounded-xl shadow-lg border border-white/10" />
                </div>
                <span className="text-2xl font-bold font-heading tracking-tight">
                  <span className="text-foreground">Inv</span>
                  <span className="gradient-text">oix</span>
                </span>
              </a>
            </Link>

            {/* Nav Links - Desktop */}
            <div className="hidden md:flex items-center space-x-1 bg-white/5 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/5">
              {[
                { label: "Features", id: "features" },
                { label: "Rewards", id: "rewards" },
                { label: "Pricing", id: "pricing" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 rounded-full transition-all"
                >
                  {item.label}
                </button>
              ))}
              <Link href="/invoices">
                <a className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 rounded-full transition-all">
                  Dashboard
                </a>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <WalletButton />
              </div>

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-full glass hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl md:hidden flex flex-col pt-24 px-6"
          >
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <nav className="flex flex-col gap-6 text-2xl font-heading font-bold text-center">
              {[
                { label: "Features", id: "features" },
                { label: "Rewards", id: "rewards" },
                { label: "Pricing", id: "pricing" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setTimeout(() => scrollToSection(item.id), 300);
                  }}
                  className="text-white hover:text-primary transition-colors py-2"
                >
                  {item.label}
                </button>
              ))}
              <Link href="/invoices">
                <a className="text-primary mt-4 py-2" onClick={() => setMobileMenuOpen(false)}>
                  Launch Dashboard
                </a>
              </Link>
            </nav>

            <div className="mt-12 flex justify-center">
              <WalletButton />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-32 md:pt-48 md:pb-40 overflow-hidden">
        {/* Animated Mesh Gradient Background */}
        <div className="absolute inset-0 gradient-hero opacity-80 pointer-events-none" />
        <div className="absolute top-20 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full pointer-events-none -z-10 translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none -z-10 -translate-x-1/4 translate-y-1/4" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8 border border-primary/20 bg-primary/5 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
          >
            <Sparkles className="w-4 h-4 mr-2 text-primary animate-pulse" />
            <span className="text-sm font-semibold font-heading bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent tracking-wide">
              THE FUTURE OF B2B PAYMENTS
            </span>
          </motion.div>

          <motion.h1
            className="font-heading font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-8 tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Invoice with <br className="hidden md:block" />
            <span className="gradient-text pb-2 inline-block">Cosmic Speed.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed text-balance"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Instant crypto payments, automated NFT receipts, and zero subscription fees.
            Experience the new standard for on-chain commerce.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex justify-center mb-10"
          >
            <button
              onClick={copyAddress}
              className="group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-xs text-muted-foreground hover:text-white font-mono"
            >
              <span className="text-primary/70 group-hover:text-primary">CA:</span>
              {TOKEN_ADDRESS.slice(0, 6)}...{TOKEN_ADDRESS.slice(-6)}
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-5 justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link href="/invoices/create">
              <button className="btn-primary smoke-shadow h-14 px-10 text-lg flex items-center justify-center group">
                Start Invoicing Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>

            <Link href="/invoices">
              <button className="btn-secondary h-14 px-10 text-lg flex items-center justify-center">
                Launch Dashboard
              </button>
            </Link>
          </motion.div>

          {/* Abstract Stats Graphic */}
          <motion.div
            className="mt-24 relative max-w-5xl mx-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12">
              {[
                { val: isStatsLoading ? "..." : `$${Number(tokenStats?.priceUsd || 0).toFixed(6)}`, label: "Token Price", icon: Zap },
                { val: isStatsLoading ? "..." : `${Number(tokenStats?.priceChange24h || 0).toFixed(2)}%`, label: "24h Change", icon: Check },
                { val: isStatsLoading ? "..." : `$${(Number(tokenStats?.volume24h || 0) / 1000).toFixed(1)}K+`, label: "24h Volume", icon: BarChart3 },
                { val: "24/7", label: "Uptime", icon: Globe },
              ].map((stat, i) => (
                <div key={i} className="text-center p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <div className="flex justify-center mb-3 text-primary/80">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold font-heading text-white mb-1">{stat.val}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 container mx-auto px-6">
        <motion.div
          className="text-center mb-20"
          {...fadeInUp}
        >
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6">Designed for scale</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suite of tools built to handle everything from freelance gigs to enterprise payroll.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Main Feature - Large */}
          <motion.div
            className="md:col-span-2 feature-card group"
            variants={fadeInUp}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div>
                <div className="icon-wrapper">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold font-heading mb-3">Lightning Fast Settlements</h3>
                <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
                  Say goodbye to Net-30. With Solana, funds settle in your wallet in 400ms.
                  Better cash flow, zero waiting.
                </p>
              </div>
              <div className="mt-8 relative h-32 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {/* Abstract visualization of speed/blocks */}
                <div className="absolute inset-0 flex items-center gap-4 px-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 w-24 rounded-lg bg-primary/20 border border-primary/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 - Vertical */}
          <motion.div
            className="md:col-span-1 feature-card group bg-gradient-to-b from-white/5 to-transparent"
            variants={fadeInUp}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <div className="icon-wrapper">
              <Receipt className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold font-heading mb-3">NFT Receipts</h3>
            <p className="text-muted-foreground leading-relaxed">
              Automatically mint compressed NFTs as immutable proof of payment for every invoice.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            className="md:col-span-1 feature-card group"
            variants={fadeInUp}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <div className="icon-wrapper">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold font-heading mb-3">Revenue Preserved</h3>
            <p className="text-muted-foreground leading-relaxed">
              Strict on-chain analysis ensures every payment is verified in atomic units. Zero revenue leakage.
            </p>
          </motion.div>

          {/* Feature 4 - Large */}
          <motion.div
            className="md:col-span-2 feature-card group overflow-hidden"
            variants={fadeInUp}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[80px] rounded-full -z-10" />
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="icon-wrapper">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold font-heading mb-3">Multi-Currency Support</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Accept Native SOL, USDC, USDT, or EURC. Auto-convert or hold stablecoins to avoid volatility.
                </p>
              </div>
              <div className="relative">
                <div className="glass-card p-4 rounded-xl border border-white/10 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-mono text-muted-foreground">Amount Due</span>
                    <span className="text-sm font-bold text-white">12.50 SOL</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-gradient-to-r from-primary to-accent" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
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
                "USDC, USDT, & SOL Payments",
                "Compressed NFT Receipts",
                "Basic Analytics",
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
      </section >

      {/* Pricing / Rewards CTA (Combined for impact) */}
      < section id="rewards" className="py-32 relative" >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="glass-strong rounded-[3rem] p-12 md:p-20 border border-white/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
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
              </div>

              <div className="relative">
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
              </div>
            </div>
          </div>
        </div>
      </section >

      {/* Footer */}
      < footer className="border-t border-white/10 bg-black/40 py-20 backdrop-blur-lg" >
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 text-sm">
            <div className="col-span-1 md:col-span-2">
              <Link href="/">
                <a className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xl font-bold font-heading">Invoix</span>
                </a>
              </Link>
              <p className="text-muted-foreground max-w-sm leading-relaxed mb-6">
                The next generation of B2B payments. Fast, secure, and rewarding.
                Built on the Solana blockchain.
              </p>
              <div className="flex gap-4">
                {/* Socials */}
                <a href="https://x.com/InvoixSola24238" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                  <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <div className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                  <Monitor className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Product</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><Link href="/invoices"><a className="hover:text-primary transition-colors">Dashboard</a></Link></li>
                <li><Link href="/invoices/create"><a className="hover:text-primary transition-colors">Create Invoice</a></Link></li>
                <li><Link href="/pricing"><a className="hover:text-primary transition-colors">Pricing</a></Link></li>
                <li><Link href="/rewards"><a className="hover:text-primary transition-colors">Rewards</a></Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Legal</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
            <p>&copy; 2025 Invoix Protocol. All rights reserved.</p>
            <p>Designed with <span className="text-primary">Stellar UI</span> on Solana.</p>
          </div>
        </div>
      </footer >
    </div >
  );
}
