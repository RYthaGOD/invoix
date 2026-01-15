import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

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
            {/* Devnet Banner */}
            <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-400 text-amber-900 py-2 px-4 text-center text-sm font-semibold">
                <span className="inline-flex items-center gap-2">
                    <span>⚠️</span>
                    DEVNET ONLY — This is a testnet deployment. Do not use real funds.
                    <span>⚠️</span>
                </span>
            </div>

            {/* Main Navigation */}
            <nav className={`
                fixed w-full top-14 z-50 transition-all duration-300
                bg-white/80 backdrop-blur-xl
                ${scrolled ? "shadow-md" : "shadow-sm"}
                border-b border-border/50
            `}>
                <div className="container-custom">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/">
                            <a className="flex items-center gap-2 cursor-pointer group">
                                <div className="w-8 h-8 flex items-center justify-center gradient-primary rounded-lg group-hover:scale-105 transition-transform">
                                    <span className="font-bold text-white text-lg">I</span>
                                </div>
                                <span className="font-heading font-bold text-xl text-foreground">
                                    Invoix
                                </span>
                                <span className="text-[10px] uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    Beta
                                </span>
                            </a>
                        </Link>

                        {/* Nav Links - Desktop */}
                        <div className="hidden md:flex items-center space-x-1">
                            {[
                                { label: "Features", id: "features" },
                                { label: "Rewards", id: "rewards" },
                                { label: "Pricing", id: "pricing" }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-3">
                                <Link href="/docs">
                                    <a className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                        Docs
                                    </a>
                                </Link>
                                <Link href="/invoices">
                                    <button className="btn-primary text-sm px-6 py-2">
                                        Launch App
                                    </button>
                                </Link>
                            </div>

                            {/* Mobile Menu Toggle */}
                            <button
                                className="md:hidden w-10 h-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                                onClick={() => setMobileMenuOpen(true)}
                            >
                                <Menu className="w-5 h-5 text-foreground" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-white/95 backdrop-blur-xl md:hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 flex items-center justify-center gradient-primary rounded-lg">
                                    <span className="font-bold text-white text-lg">I</span>
                                </div>
                                <span className="font-heading font-bold text-xl text-foreground">
                                    Invoix
                                </span>
                            </div>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                            >
                                <X className="w-6 h-6 text-foreground" />
                            </button>
                        </div>

                        {/* Menu Items */}
                        <nav className="flex flex-col p-6 gap-2">
                            {[
                                { label: "Features", id: "features" },
                                { label: "Rewards", id: "rewards" },
                                { label: "Pricing", id: "pricing" },
                                { label: "Docs", href: "/docs" }
                            ].map((item) => (
                                item.href ? (
                                    <Link key={item.label} href={item.href}>
                                        <a
                                            className="block px-4 py-3 text-lg font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            {item.label}
                                        </a>
                                    </Link>
                                ) : (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            setTimeout(() => scrollToSection(item.id!), 300);
                                        }}
                                        className="text-left px-4 py-3 text-lg font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                )
                            ))}

                            <div className="mt-6 px-4">
                                <Link href="/invoices">
                                    <button
                                        className="btn-primary w-full"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Launch App
                                    </button>
                                </Link>
                            </div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
