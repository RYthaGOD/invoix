import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";

// Standard Test Constants
export const TEST_TIMEOUT = 30000;
export const COMPRESSION_PROGRAM_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
export const BUBBLEGUM_PROGRAM_ID = new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

/**
 * Helper to get or create a provider for testing
 */
export function getProvider(): anchor.AnchorProvider {
    // fast-path: if env vars are set, use them
    if (process.env.ANCHOR_PROVIDER_URL && process.env.ANCHOR_WALLET) {
        try {
            const provider = anchor.AnchorProvider.env();
            anchor.setProvider(provider);
            return provider;
        } catch (e) {
            // fall through
        }
    }

    const url = process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899";
    const connection = new anchor.web3.Connection(url, "confirmed");
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());

    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);
    return provider;
}

/**
 * Helper to check if a program is deployed on the current cluster
 */
export async function isProgramDeployed(connection: anchor.web3.Connection, programId: PublicKey): Promise<boolean> {
    try {
        const info = await connection.getAccountInfo(programId);
        return info !== null && info.executable;
    } catch (e) {
        return false;
    }
}
