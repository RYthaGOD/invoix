// Solana SDK integration or wallet signature verification
// Optimized for B2B Invoicing Protocol

import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

/**
 * Verify a wallet signature to prove ownership
 * Used for authenticating manual buyback requests
 */
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureBase58: string
): Promise<boolean> {
  try {
    // Convert the wallet address to a PublicKey
    const publicKey = new PublicKey(walletAddress);

    // Decode the signature from base58
    const signatureBytes = bs58.decode(signatureBase58);

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature using nacl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    return isValid;
  } catch (error) {
    console.error("Error verifying wallet signature:", error);
    return false;
  }
}

// Singleton Connection Configuration
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { logger } from "./logger";

let sharedConnection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!sharedConnection) {
    const network = process.env.SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);

    logger.info(`Initializing shared Solana connection to ${network}`, "solana");
    sharedConnection = new Connection(rpcUrl, 'confirmed');
  }
  return sharedConnection;
}
