// Solana SDK integration or wallet signature verification
// Optimized for B2B Invoicing Protocol

import { PublicKey, Connection, clusterApiUrl, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
const { Program, AnchorProvider, Wallet } = anchor;
import type { Idl, Program as ProgramType } from "@coral-xyz/anchor";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

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

export async function getArciumProgram(): Promise<any> {
  const connection = getSolanaConnection();

  // Use a dummy wallet for the provider (we purely read state)
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Load IDL
  // Assuming IDL is at root level or copied to server build
  const idlPath = path.resolve(process.cwd(), "..", "arcium_idl.json"); // During dev, root is one level up from server
  // Fallback for production structure if needed

  let idl: Idl;
  try {
    const idlFile = fs.readFileSync(idlPath, "utf-8");
    idl = JSON.parse(idlFile);
  } catch (error) {
    // Try local path if running from root
    try {
      const localIdlPath = path.resolve(process.cwd(), "arcium_idl.json");
      const idlFile = fs.readFileSync(localIdlPath, "utf-8");
      idl = JSON.parse(idlFile);
    } catch (e) {
      logger.error("Failed to load arcium_idl.json", "solana", { error: e });
      throw new Error("IDL not found");
    }
  }

  // @ts-ignore - Provider type mismatch between packages sometimes occurs
  return new Program(idl, provider);
}
