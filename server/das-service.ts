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

export const dasService = {
    /**
     * Get Asset Proof from ReadAPI
     * @param assetId - The Compressed NFT Asset ID
     */
    async getAssetProof(assetId: string): Promise<DASProof> {
        const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

        try {
            const response = await axios.post(rpcUrl, {
                jsonrpc: "2.0",
                id: "get-asset-proof",
                method: "getAssetProof",
                params: {
                    id: assetId
                }
            });

            if (response.data.error) {
                throw new Error(`DAS Error: ${response.data.error.message}`);
            }

            if (!response.data.result) {
                throw new Error("No result returned from getAssetProof");
            }

            return response.data.result;
        } catch (error: any) {
            logger.error("Failed to fetch asset proof", "das", { assetId, error: error.message });
            throw error;
        }
    },

    /**
     * Get multiple asset proofs via batch request
     */
    async getBatchAssetProofs(assetIds: string[]): Promise<DASProof[]> {
        const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

        const batch = assetIds.map((id, idx) => ({
            jsonrpc: "2.0",
            id: `proof-${idx}`,
            method: "getAssetProof",
            params: { id }
        }));

        try {
            const response = await axios.post(rpcUrl, batch);

            return response.data.map((res: any) => {
                if (res.error) throw new Error(`DAS Error in batch: ${res.error.message}`);
                return res.result;
            });
        } catch (error: any) {
            logger.error("Failed to fetch batch asset proofs", "das", { count: assetIds.length, error: error.message });
            throw error;
        }
    }
};
