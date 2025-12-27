import { Link } from "wouter";
import { FileText, Github, Globe, Twitter, ArrowRight } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/5 bg-[#020617] relative overflow-hidden">
            {/* Horizon Glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="absolute top-0 inset-x-0 h-[100px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

            <div className="container mx-auto px-6 py-20 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">

                    {/* Brand Column */}
                    <div className="lg:col-span-2 space-y-6">
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

                        {/* Newsletter Input */}
                        <div className="relative max-w-sm">
                            <input
                                type="email"
                                placeholder="Enter email for updates"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-white placeholder:text-muted-foreground/50 pr-12"
                            />
                            <button className="absolute right-1 top-1 bottom-1 w-10 bg-primary/20 hover:bg-primary text-primary hover:text-white rounded-md flex items-center justify-center transition-all">
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Links Columns */}
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Product</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/invoices"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Dashboard</a></Link></li>
                            <li><Link href="/invoices/create"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Create Invoice</a></Link></li>
                            <li><a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors block hover:translate-x-1 duration-200 cursor-pointer">Pricing</a></li>
                            <li><a href="#rewards" onClick={(e) => { e.preventDefault(); document.getElementById('rewards')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-primary transition-colors block hover:translate-x-1 duration-200 cursor-pointer">Rewards</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Decentralization</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/docs"><a className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Documentation</a></Link></li>
                            <li><a href="#" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Protocol Governance</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Treasury Stats</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">Smart Contracts</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Community</h4>
                        <ul className="flex flex-col gap-4">
                            <li>
                                <a href="https://x.com/InvoixSola24238" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-white group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#1DA1F2]/20 transition-colors">
                                        <Twitter className="w-4 h-4 group-hover:text-[#1DA1F2]" />
                                    </div>
                                    <span className="text-sm">Twitter / X</span>
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/RYthaGOD/invoix" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-white group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                        <Github className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm">GitHub</span>
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-3 text-muted-foreground hover:text-white group">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#5865F2]/20 transition-colors">
                                        <Globe className="w-4 h-4 group-hover:text-[#5865F2]" />
                                    </div>
                                    <span className="text-sm">Discord</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground/50">
                    <p>&copy; {new Date().getFullYear()} Invoix Protocol. Built with ❤️ on Solana.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Cookies</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
