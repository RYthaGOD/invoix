import { Navbar, Hero, Features, HowItWorks, Rewards, Pricing, Footer } from "@/components/landing";

const TOKEN_ADDRESS = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";

export default function InvoiceLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-white" id="tour-welcome">
      <Navbar />
      <Hero tokenAddress={TOKEN_ADDRESS} />
      <HowItWorks />
      <Features />
      <Rewards />
      <Pricing />
      <Footer />
    </div>
  );
}
