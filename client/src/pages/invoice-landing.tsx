import { useState } from "react";
import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";
import {
  FileText,
  Lock,
  Zap,
  Shield,
  ArrowRight,
  Check,
  CreditCard,
  Users,
  BarChart3,
  Globe,
  Sparkles,
  Clock,
  Receipt,
  Building2
} from "lucide-react";

export default function InvoiceLanding() {
  const [activeTab, setActiveTab] = useState("features");

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
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="glass border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <a className="flex items-center space-x-2.5 group">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center glow-sm">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight">
                  <span className="text-foreground">Inv</span>
                  <span className="gradient-text">oix</span>
                </span>
              </a>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/invoices">
                <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </a>
              </Link>
              <button
                onClick={() => setActiveTab("features")}
                className={`text-sm font-medium transition-colors ${activeTab === "features"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Features
              </button>
              <button
                onClick={() => setActiveTab("pricing")}
                className={`text-sm font-medium transition-colors ${activeTab === "pricing"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Pricing
              </button>
              <button
                onClick={() => setActiveTab("how-it-works")}
                className={`text-sm font-medium transition-colors ${activeTab === "how-it-works"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                How it Works
              </button>
            </div>

            <WalletButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full glass-card mb-8">
            <Sparkles className="w-4 h-4 mr-2 text-primary" />
            <span className="text-sm font-medium">B2B Invoicing, Reinvented</span>
          </div>

          {/* Headline */}
          <h1 className="heading-xl mb-6">
            Create invoices.{" "}
            <span className="gradient-text">Get paid instantly.</span>
          </h1>

          {/* Subheadline */}
          <p className="body-lg mb-10 max-w-2xl mx-auto text-balance">
            The simplest way to invoice on Solana. Free to use—we only earn when you do.
            Create unlimited invoices and pay just 0.5% when you get paid.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/invoices/create">
              <button className="btn-primary flex items-center justify-center group">
                Create Your First Invoice
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>

            <Link href="/invoices">
              <button className="btn-secondary">
                View Dashboard
              </button>
            </Link>
          </div>

          {/* Trust badge */}
          <p className="text-sm text-muted-foreground mt-8">
            <Check className="inline w-4 h-4 mr-1 text-primary" />
            No signup required •
            <Check className="inline w-4 h-4 mx-1 text-primary" />
            Free forever •
            <Check className="inline w-4 h-4 mx-1 text-primary" />
            0.5% on payments only
          </p>

          {/* Native Token */}
          <div className="mt-10 inline-block glass-strong p-6 rounded-2xl smoke-shadow">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="text-2xl">🔷</div>
              <h3 className="text-lg font-semibold">B2B Native Token</h3>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <code className="text-sm md:text-base font-mono bg-background/50 px-4 py-2 rounded-lg border border-border/50">
                AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump');
                }}
                className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors font-medium"
              >
                Copy Address
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-6 rounded-2xl text-center card-hover">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      {activeTab === "features" && (
        <section className="container mx-auto px-6 py-24 border-t border-border/50">
          <div className="text-center mb-16">
            <h2 className="heading-lg mb-4">Everything you need</h2>
            <p className="body-lg max-w-2xl mx-auto">
              Professional invoicing tools built for the modern business
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="icon-wrapper">
                  <div className="text-primary">{feature.icon}</div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How it Works Section */}
      {activeTab === "how-it-works" && (
        <section className="container mx-auto px-6 py-24 border-t border-border/50">
          <div className="text-center mb-16">
            <h2 className="heading-lg mb-4">How it works</h2>
            <p className="body-lg max-w-2xl mx-auto">
              Get started in under a minute. No account creation needed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="text-6xl font-bold text-primary/20 mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Demo CTA */}
          <div className="mt-16 text-center">
            <Link href="/invoices/create">
              <button className="btn-primary">
                Try it now — it's free
                <ArrowRight className="inline ml-2 w-5 h-5" />
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      {activeTab === "pricing" && (
        <section className="container mx-auto px-6 py-24 border-t border-border/50">
          <div className="text-center mb-16">
            <h2 className="heading-lg mb-4">Simple, fair pricing</h2>
            <p className="body-lg max-w-2xl mx-auto">
              Free to use. We only earn when you get paid.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            {/* Single Pricing Card */}
            <div className="glass-strong p-10 rounded-3xl text-center glow-sm">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                FREEMIUM
              </div>

              <div className="mb-8">
                <span className="text-6xl font-bold gradient-text">0.5%</span>
                <span className="text-muted-foreground ml-2">per payment</span>
              </div>

              <ul className="space-y-4 mb-10 text-left">
                {[
                  "Unlimited invoices",
                  "Unlimited customers",
                  "All payment currencies",
                  "Invoice templates",
                  "NFT payment receipts",
                  "Analytics dashboard",
                  "End-to-end encryption",
                  "Priority support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <Check className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/invoices/create">
                <button className="btn-primary w-full py-4">
                  Start for Free
                  <ArrowRight className="inline ml-2 w-5 h-5" />
                </button>
              </Link>

              <p className="text-sm text-muted-foreground mt-4">
                No credit card • No signup • Start invoicing now
              </p>
            </div>

            {/* Fee Breakdown */}
            <div className="mt-8 glass-card p-6 rounded-2xl">
              <h4 className="font-semibold mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-primary" />
                Fee breakdown
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creating invoices</span>
                  <span className="font-medium text-primary">Free</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer management</span>
                  <span className="font-medium text-primary">Free</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Templates & analytics</span>
                  <span className="font-medium text-primary">Free</span>
                </div>
                <div className="border-t border-border/50 pt-3 flex justify-between">
                  <span className="text-muted-foreground">Payment processing</span>
                  <span className="font-medium">0.5% of amount</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solana network fee</span>
                  <span className="font-medium">~$0.00025</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto glass-strong p-12 md:p-16 rounded-3xl text-center glow-md">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="heading-md mb-4">Ready to simplify your invoicing?</h2>
          <p className="body-lg mb-10 max-w-xl mx-auto">
            Join businesses that get paid faster with Invoix.
            No signup, no commitment—just connect and create.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/invoices/create">
              <button className="btn-primary flex items-center justify-center group">
                Create Invoice
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>

            <Link href="/templates">
              <button className="btn-secondary">
                Browse Templates
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 glass">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold">Invoix</span>
              </div>
              <p className="text-sm text-muted-foreground">
                B2B invoicing, simplified. Built on Solana for instant, secure payments.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/invoices"><a className="hover:text-foreground transition-colors">Dashboard</a></Link></li>
                <li><Link href="/invoices/create"><a className="hover:text-foreground transition-colors">Create Invoice</a></Link></li>
                <li><Link href="/templates"><a className="hover:text-foreground transition-colors">Templates</a></Link></li>
                <li><Link href="/customers"><a className="hover:text-foreground transition-colors">Customers</a></Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><Link href="/stats"><a className="hover:text-foreground transition-colors">Platform Stats</a></Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 Invoix. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Built on</span>
              <span className="font-medium text-foreground">Solana</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
