import { Link } from "wouter";
import { FileText, Globe, Monitor } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black/40 py-20 backdrop-blur-lg">
            <div className="container mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-12 text-sm">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/">
                            <a className="flex items-center space-x-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                                    <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-xl font-bold font-heading">Invoix</span>
                            </a>
                        </Link>
                        <p className="text-muted-foreground max-w-sm leading-relaxed mb-6">
                            The next generation of B2B payments. Fast, secure, and rewarding.
                            Built on the Solana blockchain.
                        </p>
                        <div className="flex gap-4">
                            {/* Socials */}
                            <a href="https://x.com/InvoixSola24238" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                                <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                            <div className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                                <Globe className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 cursor-pointer transition-colors">
                                <Monitor className="w-5 h-5 text-muted-foreground" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Product</h4>
                        <ul className="space-y-4 text-muted-foreground">
                            <li><Link href="/invoices"><a className="hover:text-primary transition-colors">Dashboard</a></Link></li>
                            <li><Link href="/invoices/create"><a className="hover:text-primary transition-colors">Create Invoice</a></Link></li>
                            <li><button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-primary transition-colors">Pricing</button></li>
                            <li><button onClick={() => document.getElementById('rewards')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-primary transition-colors">Rewards</button></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-xs">Legal</h4>
                        <ul className="space-y-4 text-muted-foreground">
                            <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Invoix Protocol. All rights reserved.</p>
                    <p>Built on Solana blockchain.</p>
                </div>
            </div>
        </footer>
    );
}
