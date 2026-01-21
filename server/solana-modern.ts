/**
 * Modern Solana SDK Layer (The Bridge)
 * 
 * This file introduces the modern `@solana/kit` and `@solana/client` stack.
 * It is designed to co-exist with `solana-sdk.ts` (Legacy v1) during the migration phase.
 * 
 * Usage:
 * Import `modernRpc` or `modernClient` for new features or optimized reads.
 */

import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { Connection, clusterApiUrl } from "@solana/web3.js"; // Legacy v1
import { logger } from "./logger";

// Configuration
const NETWORK = process.env.SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl(NETWORK);
const WSS_URL = RPC_URL.replace("https", "wss").replace("http", "ws");

/**
 * Modern RPC Client (v2)
 * Optimized for lightweight queries and concurrent requests.
 */
export const modernRpc = createSolanaRpc(RPC_URL);

/**
 * Modern Subscription Client (v2)
 */
export const modernSubscriptions = createSolanaRpcSubscriptions(WSS_URL);

/**
 * Compatibility Bridge: Get a legacy Connection from the modern configuration
 * Useful if we migrate config management here eventually.
 */
export function getLegacyCompatibleConnection(): Connection {
    // For now, we just instantiate v1 Connection directly to ensure 100% compatibility
    // In later phases, we might wrap a modern transport
    return new Connection(RPC_URL, "confirmed");
}

/**
 * RPC Optimization Wrapper
 * Example of how we will migrate methods: atomic getBlockhash using modern stack
 */
export async function getModernBlockhash() {
    try {
        const { value: { blockhash, lastValidBlockHeight } } = await modernRpc.getLatestBlockhash({ commitment: "confirmed" }).send();
        return { blockhash, lastValidBlockHeight };
    } catch (e) {
        logger.error("Modern blockhash fetch failed", "solana-modern", { error: e });
        throw e;
    }
}
