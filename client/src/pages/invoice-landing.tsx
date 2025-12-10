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
  ChevronRight
} from "lucide-react";

export default function InvoiceLanding() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant Payments",
      description: "Get paid in seconds, not days. Solana's speed means your cash flow never waits."
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "End-to-End Encryption",
      description: "Your financial data stays private. Only you and your client can see invoice details."
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Multi-Currency",
      description: "Accept USDC, USDT, EURC, or SOL. Stablecoins for predictable payments."
    },
    {
      icon: <Receipt className="w-6 h-6" />,
      title: "NFT Receipts",
      description: "Every payment generates an on-chain receipt. Perfect for taxes and audits."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Customer CRM",
      description: "Track payment history, set custom terms, and manage all your clients."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Smart Analytics",
      description: "Real-time insights on cash flow, payment trends, and overdue invoices."
    }
  ];

  const stats = [
    { value: "<1s", label: "Payment Speed" },
    { value: "$0.00025", label: "Transaction Cost" },
    { value: "0.5%", label: "Platform Fee" },
    { value: "24/7", label: "Availability" }
  ];

  const steps = [
    {
      step: "01",
      title: "Connect Wallet",
      description: "Sign in with your Solana wallet. No email, no password, no hassle."
    },
    {
      step: "02",
      title: "Create Invoice",
      description: "Fill in the details or use a template. Takes less than a minute."
    },
    {
      step: "03",
      title: "Share & Get Paid",
      description: "Send the link to your client. They pay, you receive instantly."
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="glass border-b border-border/50 sticky top-0 z-50 transition-all duration-300">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <a className="flex items-center space-x-2.5 group">
                <img src="/invoix-logo.jpg" alt="Invoix Logo" className="w-9 h-9 object-contain rounded-xl glow-sm transition-transform group-hover:scale-105" />
                <span className="text-2xl font-bold tracking-tight">
                  <span className="text-foreground">Inv</span>
                  <span className="gradient-text">oix</span>
                </span>
              </a>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/invoices">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-2 rounded-md">
                  Dashboard
                </a>
              </Link>
              <button
                onClick={() => scrollToSection("features")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-2 rounded-md"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-2 rounded-md"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover-elevate px-3 py-2 rounded-md"
              >
                How it Works
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Token Address */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => {
                  navigator.clipboard.writeText('AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump');
                }}>
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs group-hover:bg-primary/20 transition-colors">🔷</div>
                <code className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">AMFB...pump</code>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-primary transition-colors">Copy</span>
              </div>

              <WalletButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-36">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8 border-primary/20 bg-primary/5">
              <Sparkles className="w-4 h-4 mr-2 text-primary animate-pulse" {...({} as any)} />
              <span className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">B2B Invoicing, Reinvented</span>
            </div>
          </motion.div>

          <motion.h1
            className="heading-xl mb-6 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Create invoices.{" "}
            <span className="gradient-text">Get paid instantly.</span>
          </motion.h1>

          <motion.p
            className="body-lg mb-10 max-w-2xl mx-auto text-balance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            The simplest way to invoice on Solana. Free to use—we only earn when you do.
            Create unlimited invoices and pay just 0.5% when you get paid.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/invoices/create">
              <button className="btn-primary flex items-center justify-center group h-12 px-8 text-lg">
                Create Your First Invoice
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" {...({} as any)} />
              </button>
            </Link>

            <Link href="/invoices">
              <button className="btn-secondary h-12 px-8 text-lg hover:bg-muted/50">
                View Dashboard
              </button>
            </Link>
          </motion.div>

          {/* Trust badge */}
          <motion.p
            className="text-sm text-muted-foreground mt-8 flex items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <span className="flex items-center"><Check className="w-4 h-4 mr-1.5 text-primary" /> No signup required</span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="flex items-center"><Check className="w-4 h-4 mr-1.5 text-primary" /> Free forever</span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="flex items-center"><Check className="w-4 h-4 mr-1.5 text-primary" /> 0.5% on payments</span>
          </motion.p>
        </div>

        {/* Stats Grid */}
        <motion.div
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="glass-card p-6 rounded-2xl text-center card-hover border-t border-t-white/10"
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <div className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-primary to-accent mb-2 font-mono tracking-tight">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-24 border-t border-border/50 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute left-0 top-1/3 w-64 h-64 bg-accent/5 blur-[80px] rounded-full -z-10" />

        <div className="text-center mb-16">
          <motion.div {...fadeInUp}>
            <h2 className="heading-lg mb-6">Everything you need</h2>
            <p className="body-lg max-w-2xl mx-auto text-balance">
              Professional invoicing tools built for the modern business, powered by the speed of Solana.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card group"
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <div className="icon-wrapper group-hover:scale-110 transition-transform duration-300">
                <div className="text-primary">{feature.icon}</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Rewards Program Section - Redesigned */}
      <section className="container mx-auto px-6 py-24 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="glass-strong rounded-[2.5rem] p-8 md:p-16 border border-primary/20 relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-primary/10 to-transparent blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <div className="text-center mb-12">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20">
                  <Sparkles className="w-4 h-4 mr-2" {...({} as any)} />
                  REWARDS PROGRAM
                </div>
                <h2 className="heading-md mb-6">Earn While You Invoice</h2>
                <p className="body-lg text-muted-foreground max-w-2xl mx-auto">
                  50% of all protocol fees are used to buy back $B2B tokens and distribute them to early users.
                </p>
              </div>

              {/* Token Address Card - Improved */}
              <div className="glass-card bg-background/40 backdrop-blur-xl p-8 rounded-2xl mb-12 max-w-2xl mx-auto border-primary/10 shadow-lg shadow-primary/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center glow-sm shadow-inner shadow-white/20">
                      <div className="text-3xl text-white drop-shadow-md">🔷</div>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                        $B2B Token
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold tracking-wider">OFFICIAL</span>
                      </h3>
                      <code className="text-xs md:text-sm font-mono text-muted-foreground break-all bg-background/50 px-2 py-1 rounded border border-white/5">
                        AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump
                      </code>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump');
                    }}
                    className="btn-secondary whitespace-nowrap hover:border-primary/50 hover:text-primary active:scale-95"
                  >
                    Copy Address
                  </button>
                </div>
              </div>

              {/* Rewards Breakdown Cards */}
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { val: "50%", label: "Protocol Fees", sub: "Used for buybacks" },
                  { val: "0.5%", label: "Per Transaction", sub: "Platform fee" },
                  { val: "100%", label: "Early Users", sub: "Rewards distributed" }
                ].map((item, i) => (
                  <div key={i} className="text-center p-6 rounded-2xl bg-background/20 border border-white/5 hover:bg-background/40 transition-colors">
                    <div className="text-4xl font-bold text-primary mb-2 gradient-text">{item.val}</div>
                    <div className="font-medium text-foreground">{item.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-6 py-24 border-t border-border/50 bg-background/50">
        <div className="text-center mb-20">
          <motion.div {...fadeInUp}>
            <h2 className="heading-lg mb-6">How it works</h2>
            <p className="body-lg max-w-2xl mx-auto">
              Get started in under a minute. No account creation needed.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -z-10" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="text-center group relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
            >
              <div className="w-20 h-20 mx-auto bg-background border-4 border-background rounded-full flex items-center justify-center mb-6 relative z-10 shadow-xl">
                <div className="w-full h-full rounded-full bg-muted/30 flex items-center justify-center text-2xl font-bold font-mono text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors border border-border group-hover:border-primary/30">
                  {step.step}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed px-4">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <Link href="/invoices/create">
            <button className="btn-primary px-10 py-4 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40">
              Try it now — it's free
              <ChevronRight className="inline ml-2 w-5 h-5" />
            </button>
          </Link>
        </motion.div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-6 py-24 border-t border-border/50">
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="heading-lg mb-6">Simple, fair pricing</h2>
            <p className="body-lg mb-8 text-balance">
              We believe in aligning our incentives with yours. We only make money when your business succeeds.
            </p>

            <div className="space-y-6">
              {[
                { title: "No Subscription Fees", desc: "No monthly charges, ever." },
                { title: "Pay-As-You-Go", desc: "Just 0.5% per successful transaction." },
                { title: "Free Utilities", desc: "Templates, CRM, and Analytics are completely free." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{item.title}</h4>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Pricing Card */}
          <motion.div
            className="glass-strong p-10 rounded-[2rem] text-center glow-sm border-t border-t-white/10 relative"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
              <CreditCard className="w-64 h-64 text-primary" {...({} as any)} />
            </div>

            <div className="relative z-10">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider mb-8 uppercase">
                Pay Per Use
              </div>

              <div className="mb-8">
                <span className="text-7xl font-bold gradient-text tracking-tighter">0.5%</span>
                <span className="text-muted-foreground block mt-2 text-lg">per transaction</span>
              </div>

              <div className="space-y-4 mb-10 text-left bg-background/30 p-6 rounded-xl border border-white/5">
                {[
                  "Unlimited invoices & customers",
                  "All currency support (USDC, SOL)",
                  "NFT payment receipts",
                  "Priority Email Support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center text-sm font-medium">
                    <Check className="w-4 h-4 text-primary mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </div>

              <Link href="/invoices/create">
                <button className="btn-primary w-full py-4 text-lg">
                  Start for Free
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-6 py-24 text-center">
        <motion.div
          className="max-w-4xl mx-auto glass-strong p-16 rounded-[3rem] glow-md"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Building2 className="w-16 h-16 text-primary mx-auto mb-8 opacity-80" />
          <h2 className="heading-md mb-6">Ready to simplify your invoicing?</h2>
          <p className="body-lg mb-10 max-w-xl mx-auto text-muted-foreground">
            Join businesses that get paid faster with Invoix.
            No signup, no commitment—just connect and create.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/invoices/create">
              <button className="btn-primary w-full sm:w-auto px-10">
                Create Invoice
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 glass-strong py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2.5 mb-6">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold">Invoix</span>
              </div>
              <p className="text-muted-foreground max-w-xs leading-relaxed">
                B2B invoicing, simplified. Built on Solana for instant, secure payments with automated on-chain receipts.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-6">Product</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><Link href="/invoices"><a className="hover:text-primary transition-colors">Dashboard</a></Link></li>
                <li><Link href="/invoices/create"><a className="hover:text-primary transition-colors">Create Invoice</a></Link></li>
                <li><Link href="/templates"><a className="hover:text-primary transition-colors">Templates</a></Link></li>
                <li><Link href="/customers"><a className="hover:text-primary transition-colors">Customers</a></Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-6">Connect</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li>
                  <a href="https://x.com/InvoixSola24238" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    Twitter/X
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2025 Invoix. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span>Built with ❤️ on</span>
              <span className="font-bold text-foreground">Solana</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
