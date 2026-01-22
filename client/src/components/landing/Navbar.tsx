import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TourGuide } from "@/components/tour-guide";

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
            <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-yellow-500/90 via-orange-500/90 to-yellow-500/90 text-black py-2 px-4 text-center text-sm font-bold backdrop-blur-sm">
                <span className="inline-flex items-center gap-2">
                    <span className="animate-pulse">⚠️</span>
                    DEVNET ONLY — This is a testnet deployment. Do not use real funds.
                    <span className="animate-pulse">⚠️</span>
                </span>
            </div>
            <div className="fixed w-full top-14 z-50 flex justify-center px-6 pointer-events-none">
                <nav className={`
                    pointer-events-auto transition-all duration-500 ease-in-out
                    flex items-center justify-between gap-8 py-3 px-6 rounded-full
                    ${scrolled
                        ? "glass border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] translate-y-0"
                        : "bg-white/5 border-white/5 translate-y-2"}
                    border backdrop-blur-xl max-w-7xl w-full
                `}>
                    {/* Logo */}
                    <Link href="/">
                        <div className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-tr from-primary to-accent rounded-lg shadow-lg group-hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-500">
                                <span className="font-bold text-white text-lg group-hover:scale-110 transition-transform">I</span>
                            </div>
                            <span className="font-heading font-bold text-xl tracking-tight hidden sm:block">
                                Invoix
                                <span className="ml-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/20 align-top relative -top-1">
                                    Beta
                                </span>
                            </span>
                        </div>
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
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-all relative group"
                            >
                                {item.label}
                                <span className="absolute bottom-1 left-4 right-4 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2">
                            <Link href="/docs">
                                <a className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-all">
                                    Docs
                                </a>
                            </Link>
                            <Link href="/invoices">
                                <a className="px-5 py-2 text-sm font-bold bg-white text-black rounded-full hover:bg-white/90 transition-all shadow-lg" id="nav-dashboard">
                                    Launch
                                </a>
                            </Link>
                        </div>

                        <div className="md:hidden">
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
                </nav>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="fixed inset-0 z-[60] bg-black/80 md:hidden flex flex-col pt-32 px-10"
                    >
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full glass text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <nav className="flex flex-col gap-8 text-3xl font-heading font-bold">
                            {[
                                { label: "Features", id: "features" },
                                { label: "Rewards", id: "rewards" },
                                { label: "Pricing", id: "pricing" },
                                { label: "Docs", href: "/docs" }
                            ].map((item) => (
                                item.href ? (
                                    <Link key={item.label} href={item.href}>
                                        <a className="text-white hover:text-primary transition-colors" onClick={() => setMobileMenuOpen(false)}>
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
                                        className="text-left text-white hover:text-primary transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                )
                            ))}
                            <Link href="/invoices">
                                <a className="text-primary mt-4 py-2" onClick={() => setMobileMenuOpen(false)}>
                                    Dashboard →
                                </a>
                            </Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
