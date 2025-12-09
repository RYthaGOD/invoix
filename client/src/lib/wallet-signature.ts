/**
 * Wallet signature utilities for authenticating key management operations
 * 
 * Integrated with Solana Wallet Adapter for production use
 */

import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export interface SignatureResult {
  signature: string;
  message: string;
  publicKey: string;
}

// Store wallet reference - will be set by the hook that calls this
let walletInstance: any = null;

export function setWalletInstance(wallet: any) {
  walletInstance = wallet;
}

/**
 * Sign a message using the connected Solana wallet
 * 
 * Uses Solana Wallet Adapter's signMessage method
 */
export async function signMessageWithWallet(message: string): Promise<SignatureResult> {
  // Check if wallet is available
  if (!walletInstance) {
    throw new Error("Wallet not initialized. Please connect your wallet first.");
  }

  if (!walletInstance.connected || !walletInstance.publicKey) {
    throw new Error("Wallet not connected. Please connect your wallet first.");
  }

  if (!walletInstance.signMessage) {
    throw new Error("Wallet does not support message signing. Please use a wallet that supports signMessage (e.g., Phantom, Solflare).");
  }

  try {
    // Encode message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);
    
    // Sign with wallet
    const signatureBytes = await walletInstance.signMessage(messageBytes);
    
    // Convert to base58
    const signature = bs58.encode(signatureBytes);
    const publicKey = walletInstance.publicKey.toBase58();
    
    return {
      signature,
      message,
      publicKey,
    };
  } catch (error) {
    console.error("Wallet signing error:", error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
    
    throw new Error("Failed to sign message. Please try again.");
  }
}

/**
 * Helper to verify a signature locally (optional, backend also verifies)
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Format message for wallet signing
 */
export function createSignatureMessage(action: string, projectId: string): string {
  return `${action} for project ${projectId} at ${Date.now()}`;
}
