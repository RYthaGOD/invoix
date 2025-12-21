import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TourGuide } from "@/components/tour-guide";

export function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Lock body scroll when menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [mobileMenuOpen]);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <>
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
                                <a className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 rounded-full transition-all" id="nav-dashboard">
                                    Dashboard
                                </a>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <TourGuide />
                            <div className="hidden md:block" id="tour-wallet-connect">
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
        </>
    );
}
