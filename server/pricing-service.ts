import axios from "axios";

// Pyth Stream / Hermes API (Public)
const PYTH_HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
// SOL/USD Price Feed ID (Mainnet)
const SOL_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

interface CachedPrice {
    price: number;
    timestamp: number;
}

let priceCache: CachedPrice | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function getSolPrice(): Promise<number> {
    // 1. Check Cache
    if (priceCache && (Date.now() - priceCache.timestamp < CACHE_TTL_MS)) {
        return priceCache.price;
    }

    // 2. Fetch from Pyth Hermes
    try {
        const response = await axios.get(PYTH_HERMES_URL, {
            params: {
                "ids[]": SOL_FEED_ID
            }
        });

        // Response format is complex binary-mapped-json, usually "parsed" array
        // Example: { binary: { ... }, parsed: [ { id, price: { price, conf, expo, publish_time } } ] }

        const data = response.data;
        if (data && data.parsed && data.parsed.length > 0) {
            const priceData = data.parsed[0].price;
            // Pyth Price = price * 10^expo
            const rawPrice = Number(priceData.price);
            const expo = Number(priceData.expo);
            const realPrice = rawPrice * Math.pow(10, expo);

            // Update Cache
            priceCache = {
                price: realPrice,
                timestamp: Date.now()
            };

            return realPrice;
        }

        console.warn("[Pricing] Invalid response format from Pyth", JSON.stringify(data).slice(0, 100));
        return 0;

    } catch (error) {
        console.error("[Pricing] Failed to fetch SOL price:", error);
        // Return stale cache if available, else 0
        return priceCache ? priceCache.price : 0;
    }
}
