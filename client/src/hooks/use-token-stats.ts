import { useQuery } from "@tanstack/react-query";

interface TokenStats {
    priceUsd: string;
    priceNative: string;
    volume24h: string;
    priceChange24h: string;
    marketCap: string;
    fdv: string;
}

const TOKEN_ADDRESS = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";

export function useTokenStats() {
    return useQuery<TokenStats>({
        queryKey: ["token-stats", TOKEN_ADDRESS],
        queryFn: async () => {
            // GeckoTerminal API for Solana
            const response = await fetch(
                `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${TOKEN_ADDRESS}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch token stats");
            }

            const data = await response.json();
            const attributes = data.data.attributes;

            return {
                priceUsd: attributes.price_usd || "0",
                priceNative: attributes.price_native || "0",
                volume24h: attributes.volume_usd?.h24 || "0",
                priceChange24h: attributes.price_change_percentage?.h24 || "0",
                marketCap: attributes.market_cap_usd || "0",
                fdv: attributes.fdv_usd || "0",
            };
        },
        refetchInterval: 30000, // Refetch every 30s
        staleTime: 10000,
    });
}
