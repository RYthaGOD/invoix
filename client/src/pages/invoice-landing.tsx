import { Navbar, Hero, Features, HowItWorks, Rewards, Pricing, FAQ, Footer } from "@/components/landing";

export default function InvoiceLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-white" id="tour-welcome">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Rewards />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

