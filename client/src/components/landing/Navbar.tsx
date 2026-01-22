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

            {/* Midnight Purple Glass Island Navbar */}
            <div className="fixed w-full top-14 z-50 flex justify-center px-6 pointer-events-none">
                <motion.nav
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`
                        pointer-events-auto transition-all duration-500 ease-in-out
                        flex items-center justify-between gap-8 py-4 px-8 rounded-3xl
                        max-w-7xl w-full
                        ${scrolled
                            ? "shadow-[0_8px_32px_rgba(139,92,246,0.3),0_0_80px_rgba(139,92,246,0.15)] translate-y-0"
                            : "shadow-[0_8px_24px_rgba(139,92,246,0.2)] translate-y-2"}
                        bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40
                        backdrop-blur-2xl
                        border border-purple-500/20
                        relative overflow-hidden
                    `}
                >
                    {/* Glass Island Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-tl from-purple-400/5 via-transparent to-transparent pointer-events-none" />

                    {/* Logo with 3D Glass Effect */}
                    <Link href="/">
                        <div className="flex items-center gap-3 cursor-pointer group relative z-10">
                            {/* 3D Glass Logo Icon */}
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

                                {/* Glass container */}
                                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/80 to-purple-700/80 border border-purple-400/30 shadow-[0_4px_16px_rgba(139,92,246,0.4)] group-hover:shadow-[0_6px_24px_rgba(139,92,246,0.6)] transition-all duration-500 overflow-hidden">
                                    {/* Inner glow */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />

                                    {/* Letter I */}
                                    <span className="absolute inset-0 flex items-center justify-center font-bold text-white text-xl drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)] group-hover:scale-110 transition-transform duration-500">
                                        I
                                    </span>

                                    {/* Reflection */}
                                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
                                </div>
                            </div>

                            {/* Text Logo */}
                            <div className="hidden sm:flex items-center gap-2">
                                <span className="font-heading font-bold text-xl tracking-tight bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent">
                                    Invoix
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                    Beta
                                </span>
                            </div>
                        </div>
                    </Link>

                    {/* Nav Links - Desktop */}
                    <div className="hidden md:flex items-center space-x-1 relative z-10">
                        {[
                            { label: "Features", id: "features" },
                            { label: "Pricing", id: "pricing" }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className="px-4 py-2 text-sm font-medium text-purple-100/80 hover:text-white transition-all relative group rounded-lg hover:bg-white/5"
                            >
                                {item.label}
                                <span className="absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
                            </button>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="hidden md:flex items-center gap-3">
                            <Link href="/docs">
                                <a className="px-4 py-2 text-sm font-medium text-purple-100/80 hover:text-white transition-all rounded-lg hover:bg-white/5">
                                    Docs
                                </a>
                            </Link>
                            <Link href="/invoices">
                                <a className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-full transition-all shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_24px_rgba(139,92,246,0.6)] hover:scale-105 border border-purple-400/30" id="nav-dashboard">
                                    Launch
                                </a>
                            </Link>
                        </div>

                        <div className="md:hidden">
                            <WalletButton />
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-purple-400/20"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </motion.nav>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="fixed inset-0 z-[60] bg-gradient-to-br from-purple-950/95 via-purple-900/95 to-black/95 md:hidden flex flex-col pt-32 px-10"
                    >
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-400/30 text-white hover:bg-purple-500/30 transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <nav className="flex flex-col gap-8 text-3xl font-heading font-bold">
                            {[
                                { label: "Features", id: "features" },
                                { label: "Pricing", id: "pricing" },
                                { label: "Docs", href: "/docs" }
                            ].map((item) => (
                                item.href ? (
                                    <Link key={item.label} href={item.href}>
                                        <a className="text-white hover:text-purple-300 transition-colors" onClick={() => setMobileMenuOpen(false)}>
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
                                        className="text-left text-white hover:text-purple-300 transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                )
                            ))}
                            <Link href="/invoices">
                                <a className="text-purple-400 mt-4 py-2 hover:text-purple-300 transition-colors" onClick={() => setMobileMenuOpen(false)}>
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
