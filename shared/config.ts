// Treasury wallet for service payments (B2B protocol)
// FIX R3-8: Read from environment variable, fallback to hardcoded for backwards compatibility
export const TREASURY_WALLET_ADDRESS =
    process.env.PLATFORM_TREASURY_WALLET || "jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38";

export const PRICING = {
    STARTER: {
        name: "Starter Tier",
        priceSOL: 0.5, // Verify actual pricing requirements
    },
    PRO: {
        name: "Pro Tier",
        priceSOL: 1.0,
    },
} as const;


// x402 Spam Control Fee
export const INVOICE_SERVICE_FEE_SOL = "0.0001";
