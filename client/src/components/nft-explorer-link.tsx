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
    const baseUrl = `https://solscan.io/${type}/${value}?cluster=${cluster}`;

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
