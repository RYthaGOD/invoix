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
            try {
                // DexScreener API for Solana (Live Data)
                const response = await fetch(
                    `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch token stats");
                }

                const data = await response.json();

                // Get the most active pair (usually the first one)
                const pair = data.pairs?.[0];

                if (!pair) {
                    return {
                        priceUsd: "0",
                        priceNative: "0",
                        volume24h: "0",
                        priceChange24h: "0",
                        marketCap: "0",
                        fdv: "0",
                    };
                }

                return {
                    priceUsd: pair.priceUsd || "0",
                    priceNative: pair.priceNative || "0",
                    volume24h: String(pair.volume?.h24 || 0),
                    priceChange24h: String(pair.priceChange?.h24 || 0),
                    marketCap: String(pair.marketCap || pair.fdv || 0),
                    fdv: String(pair.fdv || 0),
                };
            } catch (error) {
                console.error("Error fetching token stats:", error);
                return {
                    priceUsd: "0",
                    priceNative: "0",
                    volume24h: "0",
                    priceChange24h: "0",
                    marketCap: "0",
                    fdv: "0",
                };
            }
        },
        refetchInterval: 30000, // Refetch every 30s
        staleTime: 10000,
    });
}
