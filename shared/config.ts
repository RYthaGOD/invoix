// Treasury wallet for service payments (B2B protocol)
// FIX R3-8: Read from environment variable, fallback to hardcoded for backwards compatibility
export const TREASURY_WALLET_ADDRESS =
    process.env.PLATFORM_TREASURY_WALLET || "jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38";

// Centralized fallback prices (used when price feeds unavailable)
// Should only be used as emergency fallback - prefer live price feeds
export const SOL_PRICE_FALLBACK_USD = 150; // Conservative fallback

// RPC Configuration
export const DEFAULT_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const SOLANA_NETWORK = process.env.SOLANA_NETWORK || "devnet";

// Gas/Fee Configuration
export const GAS_FEE_USDC = process.env.GAS_FEE_USDC || "0.15";

export const PRICING = {
    FREE: {
        name: "Free Tier",
        priceSOL: 0,
        features: ["Unlimited Invoices", "Basic Analytics", "Community Support"],
    },
    PREMIUM: {
        name: "Premium",
        priceSOL: 0.25,
        features: ["Priority Support", "Advanced Analytics", "Custom Branding", "API Access"],
    },
} as const;


// x402 Spam Control Fee
export const INVOICE_SERVICE_FEE_SOL = "0.0001";

// Platform Fee Rate (1%)
export const PLATFORM_FEE_RATE = "0.01";

// Supported Token Mints
export const TOKEN_MINTS: Record<string, string> = {
    "SOL": "So11111111111111111111111111111111111111112", // Native SOL wrapped mint
    "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC Mainnet
    "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT Mainnet
    "PYUSD": "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PayPal USD (Mainnet)
    "EURC": "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", // Euro Coin
};

export const DEFAULT_TOKEN_MINT = TOKEN_MINTS["USDC"];

// Devnet Mints (Circle Faucet & Standard Faucets)
export const DEVNET_TOKEN_MINTS: Record<string, string> = {
    "SOL": "So11111111111111111111111111111111111111112",
    "USDC": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Circle Devnet USDC
    "EURC": "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", // Placeholder (Mainnet address, unlikely to work on Devnet without faucet)
};

export function getTokenMint(currency: string, network: string = "devnet"): string {
    const mints = network === "mainnet-beta" ? TOKEN_MINTS : DEVNET_TOKEN_MINTS;
    return mints[currency] || mints["USDC"] || TOKEN_MINTS["USDC"];
}

export function getDecimalsForMint(mintAddress: string): number {
    // Known decimals
    if (mintAddress === TOKEN_MINTS["SOL"]) return 9;
    if (mintAddress === DEVNET_TOKEN_MINTS["SOL"]) return 9;

    // Most stablecoins (USDC, USDT) are 6
    return 6;
}

