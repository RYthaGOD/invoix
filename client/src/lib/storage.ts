
/**
 * Decentralized Storage Layer (Arweave via Irys)
 * 
 * Handles uploading encrypted invoice blobs to the Arweave network.
 * Uses Irys for instant finality and easier payment via Solana.
 */

import { WebUploader } from "@irys/upload";
import { SolanaWebIrys } from "@irys/upload-solana";
import { Connection } from "@solana/web3.js";

const IRYS_NODE = "https://node2.irys.xyz"; // Mainnet
const IRYS_DEV_NODE = "https://devnet.irys.xyz"; // Devnet

// Initialize Irys Uploader
export async function getIrysUploader(wallet: any, connection: Connection) {
    // Determine network based on connection
    // Simple heuristic: if connection is devnet, use devnet Irys
    const isDevnet = connection.rpcEndpoint.includes("devnet");
    const nodeUrl = isDevnet ? IRYS_DEV_NODE : IRYS_NODE;

    // Irys requires a provider that mimics the Solana Wallet Adapter standard
    const irys = await SolanaWebIrys.init({
        url: nodeUrl,
        token: "solana",
        wallet: {
            rpcUrl: connection.rpcEndpoint,
            name: "solana",
            provider: wallet
        },
    });

    return irys;
}

/**
 * Uploads data to Arweave via Irys
 * @param data JSON object or string to upload
 * @param wallet Solana Wallet Adapter object
 * @param connection Solana Connection object
 * @returns Transaction ID (Arweave Hash)
 */
export async function uploadToArweave(data: any, wallet: any, connection: Connection): Promise<string> {
    try {
        const irys = await getIrysUploader(wallet, connection);

        // Ensure user has enough funds on Irys node
        // For now, we assume user might need to fund. 
        // In a polished UX, we'd check balance and prompt funding.
        // const loadedBalance = await irys.getLoadedBalance();

        const dataToUpload = JSON.stringify(data);
        const receipt = await irys.upload(dataToUpload, {
            tags: [
                { name: "App-Name", value: "Invoix-B2B" },
                { name: "Content-Type", value: "application/json" },
                { name: "Version", value: "1.0.0" }
            ]
        });

        return receipt.id;
    } catch (error) {
        console.error("Irys Upload Failed:", error);
        throw new Error("Failed to upload data to decentralized storage.");
    }
}

/**
 * Fetches data from Arweave/Irys Gateway
 * @param txId Arweave Transaction ID
 */
export async function fetchFromArweave(txId: string): Promise<any> {
    const gateway = "https://gateway.irys.xyz/";
    const response = await fetch(`${gateway}${txId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    return response.json();
}
