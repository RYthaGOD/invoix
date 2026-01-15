import { Link } from "wouter";
import { FileText, Github, Twitter } from "lucide-react";

export function Footer() {
    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <footer className="border-t border-border bg-background">
            <div className="container-custom py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link href="/">
                            <a className="flex items-center gap-2 group w-fit">
                                <div className="w-8 h-8 flex items-center justify-center gradient-primary rounded-lg group-hover:scale-105 transition-transform">
                                    <span className="font-bold text-white text-lg">I</span>
                                </div>
                                <span className="text-xl font-bold text-foreground">Invoix</span>
                            </a>
                        </Link>
                        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                            Modern invoicing platform powered by Solana. Get paid faster with blockchain technology.
                        </p>

                        {/* Social Links */}
                        <div className="flex gap-3 pt-2">
                            <a
                                href="https://x.com/Invoix_Solana"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-md bg-muted hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                                aria-label="Twitter"
                            >
                                <Twitter className="w-4 h-4" />
                            </a>
                            <a
                                href="https://github.com/RYthaGOD/invoix"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-md bg-muted hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                                aria-label="GitHub"
                            >
                                <Github className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Product</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link href="/invoices">
                                    <a className="text-muted-foreground hover:text-primary transition-colors">
                                        Dashboard
                                    </a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/invoices/create">
                                    <a className="text-muted-foreground hover:text-primary transition-colors">
                                        Create Invoice
                                    </a>
                                </Link>
                            </li>
                            <li>
                                <button
                                    onClick={() => scrollToSection('pricing')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    Pricing
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => scrollToSection('features')}
                                    className="text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    Features
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Company</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link href="/docs">
                                    <a className="text-muted-foreground hover:text-primary transition-colors">
                                        Documentation
                                    </a>
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/RYthaGOD/invoix"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a
                                    href="mailto:support@invoix.io"
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Support
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Legal</h4>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Privacy Policy
                                </a>
                            </li>
                            <li>
                                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Terms of Service
                                </a>
                            </li>
                            <li>
                                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                    Cookie Policy
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Invoix. All rights reserved.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Built with ❤️ on Solana
                    </p>
                </div>
            </div>
        </footer>
    );
}
