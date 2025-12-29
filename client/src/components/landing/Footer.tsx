import { Link } from "wouter";
import { FileText, Github, Twitter, ArrowRight, MessageCircle } from "lucide-react";

export function Footer() {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <footer className="border-t border-white/5 bg-[#020617] relative overflow-hidden">
            {/* Horizon Glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="absolute top-0 inset-x-0 h-[100px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

            <div className="container mx-auto px-6 py-20 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">

                    {/* Brand Column */}
                    <div className="lg:col-span-1 space-y-6">
                        <Link href="/">
                            <a className="flex items-center space-x-3 group w-fit">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                                    <FileText className="w-5 h-5 text-white group-hover:text-primary transition-colors" />
                                </div>
                                <span className="text-2xl font-bold font-heading tracking-tight group-hover:text-white transition-colors">Invoix</span>
                            </a>
                        </Link>
                        <p className="text-muted-foreground max-w-sm leading-relaxed text-sm">
                            The industrial standard for decentralized B2B settlement.
                            Powered by Solana and Arcium for speed and confidentiality.
                        </p>

                        {/* Social Links - Moved here for better layout */}
                        <div className="flex gap-3">
                            <a href="https://x.com/Invoix_Solana" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#1DA1F2]/20 group transition-colors border border-white/5 hover:border-[#1DA1F2]/30">
                                <Twitter className="w-4 h-4 text-muted-foreground group-hover:text-[#1DA1F2]" />
                            </a>
                            <a href="https://github.com/RYthaGOD/invoix" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 group transition-colors border border-white/5 hover:border-white/20">
                                <Github className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                            </a>
                            <a href="https://x.com/Invoix_Solana" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 group transition-colors border border-white/5 hover:border-primary/30">
                                <MessageCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </a>
                        </div>
                    </div>

                    {/* Links Columns */}
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Product</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/invoices"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Dashboard</a></Link></li>
                            <li><Link href="/invoices/create"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Create Invoice</a></Link></li>
                            <li>
                                <button
                                    onClick={() => scrollToSection('pricing')}
                                    className="hover:text-primary transition-colors block hover:translate-x-1 duration-200 cursor-pointer text-left"
                                >
                                    Pricing
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => scrollToSection('rewards')}
                                    className="hover:text-primary transition-colors block hover:translate-x-1 duration-200 cursor-pointer text-left"
                                >
                                    Rewards
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Resources</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/docs"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Documentation</a></Link></li>
                            <li><Link href="/developers"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">API Access</a></Link></li>
                            <li><Link href="/community-nft"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">NFT Collection</a></Link></li>
                            <li><Link href="/stats"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Analytics</a></Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Community</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li>
                                <a href="https://x.com/Invoix_Solana" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">
                                    Twitter / X
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/RYthaGOD/invoix" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a href="https://x.com/Invoix_Solana" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">
                                    X Community
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground/50">
                    <p>&copy; {new Date().getFullYear()} Invoix Protocol. Built with ❤️ on Solana.</p>
                    <div className="flex gap-6">
                        <Link href="/docs"><a className="hover:text-white transition-colors">Documentation</a></Link>
                        <a href="https://github.com/RYthaGOD/invoix" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Open Source</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
