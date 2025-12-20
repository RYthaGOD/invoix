// Treasury wallet for service payments (B2B protocol)
export const TREASURY_WALLET_ADDRESS = "jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38";

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
