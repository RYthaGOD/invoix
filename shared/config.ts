// Treasury wallet for service payments (B2B protocol)
// FIX R3-8: Read from environment variable, fallback to hardcoded for backwards compatibility
export const TREASURY_WALLET_ADDRESS =
    process.env.PLATFORM_TREASURY_WALLET || "jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38";

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
