import axios from "axios";
import { logger } from "./logger";

/**
 * DAS Service
 * Handles interaction with ReadAPI (Digital Asset Standard)
 * Required for fetching Merkle Proofs for cNFT transfers
 */

interface DASProof {
    root: string;
    proof: string[];
    node_index: number;
    leaf: string;
    tree_id: string;
}

interface DASError {
    error: {
        code: number;
        message: string;
    };
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

async function withRetry<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const err = error as any;
            const isRateLimit = err.response?.status === 429;
            const isServerErr = err.response?.status >= 500;

            if (!isRateLimit && !isServerErr && attempt < MAX_RETRIES - 1) {
                // If it's a 400 or other client error, don't retry unless it's a network glitch
                if (err.response) throw error;
            }

            const delay = BASE_DELAY * Math.pow(2, attempt);
            logger.warn(`DAS Retry ${attempt + 1}/${MAX_RETRIES} for ${operationName}`, "das", { error: error.message });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

export const dasService = {
    /**
     * Get Asset Data
     * Required for Data Hash and Creator Hash
     */
    async getAsset(assetId: string): Promise<any> {
        return withRetry(async () => {
            const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

            try {
                const response = await axios.post(rpcUrl, {
                    jsonrpc: "2.0",
                    id: "get-asset",
                    method: "getAsset",
                    params: {
                        id: assetId
                    }
                });

                if (response.data.error) {
                    throw new Error(`DAS Error: ${response.data.error.message}`);
                }

                return response.data.result;
            } catch (error: any) {
                // Don't log here, let wrapper log retry warnings. catch only to rethrow if needed
                throw error;
            }
        }, `getAsset:${assetId}`).catch(err => {
            logger.error("Failed to fetch asset", "das", { assetId, error: err.message });
            throw err;
        });
    },

    /**
     * Get Asset Proof from ReadAPI
     * @param assetId - The Compressed NFT Asset ID
     */
    async getAssetProof(assetId: string): Promise<DASProof> {
        return withRetry(async () => {
            const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
            const response = await axios.post(rpcUrl, {
                jsonrpc: "2.0",
                id: "get-asset-proof",
                method: "getAssetProof",
                params: { id: assetId }
            });

            if (response.data.error) {
                throw new Error(`DAS Error: ${response.data.error.message}`);
            }

            if (!response.data.result) {
                throw new Error("No result returned from getAssetProof");
            }

            return response.data.result;
        }, `getAssetProof:${assetId}`).catch(err => {
            logger.error("Failed to fetch asset proof", "das", { assetId, error: err.message });
            throw err;
        });
    },

    /**
     * Get multiple asset proofs via batch request
     */
    async getBatchAssetProofs(assetIds: string[]): Promise<DASProof[]> {
        return withRetry(async () => {
            const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

            const batch = assetIds.map((id, idx) => ({
                jsonrpc: "2.0",
                id: `proof-${idx}`,
                method: "getAssetProof",
                params: { id }
            }));

            const response = await axios.post(rpcUrl, batch);

            if (!Array.isArray(response.data)) {
                throw new Error("DAS Batch Error: Response is not an array");
            }

            return response.data.map((res: any) => {
                if (res.error) throw new Error(`DAS Error in batch: ${res.error.message}`);
                return res.result;
            });
        }, `getBatchAssetProofs:${assetIds.length}`).catch(err => {
            logger.error("Failed to fetch batch asset proofs", "das", { count: assetIds.length, error: err.message });
            throw err;
        });
    }
};
