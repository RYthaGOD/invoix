import React from "react";
import { ExternalLink } from "lucide-react";

interface NftExplorerLinkProps {
    type: "tx" | "token" | "account";
    value: string;
    children?: React.ReactNode;
    className?: string;
}

export function NftExplorerLink({ type, value, children, className }: NftExplorerLinkProps) {
    const cluster = "mainnet"; // Or use env variable
    // Orb uses /address/ for accounts, /tx/ for transactions, and /token/ for tokens (usually).
    // Mapping generic 'account' to Orb's 'address' if needed, though often interchangeable in some explorers, Orb prefers address.
    const pathType = type === 'account' ? 'address' : type;
    const baseUrl = `https://orb.solana.com/${pathType}/${value}?cluster=${cluster}`;

    if (children) {
        return (
            <a
                href={baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {children}
            </a>
        );
    }

    return (
        <a
            href={baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1 ${className}`}
        >
            <ExternalLink className="w-3 h-3" />
        </a>
    );
}
