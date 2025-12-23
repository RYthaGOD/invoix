/**
 * Arcium v0.5 Integration for Confidential Computing
 * 
 * Provides privacy-preserving encryption for B2B invoicing transactions
 * using Arcium's Multi-party eXecution Environment (MXE)
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import {
  getArciumEnv,
  getMXEPublicKey,
  RescueCipher,
  x25519,
  deserializeLE,
  getArciumProgram
} from "@arcium-hq/client";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback Crypto (for environments without proper Arcium config)
import { encrypt as aesEncrypt, decrypt as aesDecrypt } from "./crypto";

// Arcium configuration
const ARCIUM_CONFIG = {
  // MXE Network cluster (devnet/mainnet)
  cluster: process.env.SOLANA_NETWORK || "devnet",
};

interface ConfidentialTransactionData {
  amount: string;
  tokenAmount: string;
  fromAddress: string;
  toAddress: string;
  txSignature: string;
  timestamp: number;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
}

interface EncryptedTransactionResult {
  encryptedData: string; // Base64 (nonce + ciphertext)
  encryptionKey: string; // Base64 (Ephemeral Public Key)
  mxeComputationId?: string;
  success: boolean;
  error?: string;
}

export class ArciumService {
  private connection: Connection;
  private initialized: boolean = false;
  private mxePublicKey: Uint8Array | null = null;
  private provider: anchor.AnchorProvider | null = null;
  private program: anchor.Program<any> | null = null;

  constructor(rpcEndpoint?: string) {
    // Arcium is currently DEVNET ONLY.
    // We must force a Devnet connection for this service, regardless of the main app's network.
    // Using the mainnet RPC (process.env.SOLANA_RPC_URL) causes "Account Not Found" errors.
    const arciumEndpoint = rpcEndpoint || "https://api.devnet.solana.com";
    console.log(`🔒 ArciumService connecting to: ${arciumEndpoint} (Devnet Required)`);
    this.connection = new Connection(arciumEndpoint, "confirmed");
  }

  /**
   * Initialize service with Real Arcium SDK (v0.5.2)
   */
  async initialize(keypair?: Keypair): Promise<boolean> {
    try {
      console.log("🔒 Initializing Arcium Confidential Computing Service (v0.5.2)...");

      // Setup Anchor Provider (Read-only if no keypair provided)
      const wallet = keypair ? new anchor.Wallet(keypair) : new anchor.Wallet(Keypair.generate());
      this.provider = new anchor.AnchorProvider(this.connection, wallet, { commitment: "confirmed" });

      // Get Environment
      const env = getArciumEnv();
      console.log(`   Cluster Offset: ${env.arciumClusterOffset}`);

      // Initialize Program via local IDL for consistency
      console.log("   🔄 USING STANDARD ARCIUM SDK (PUBLIC DEVNET) - FORCED BY CONFIG");

      try {
        // DIRECT: Use Standard SDK
        this.program = getArciumProgram(this.provider);
        console.log(`   Program ID: ${this.program.programId.toBase58()}`);

        // Fetch Metadata for Standard Program
        const [stdMxeAccountPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("MXEAccount"), this.program.programId.toBuffer()],
          this.program.programId
        );

        console.log(`   MXE PDA: ${stdMxeAccountPda.toBase58()}`);
        const mxeAccount = await (this.program.account as any).mxeAccount.fetch(stdMxeAccountPda);

        if (mxeAccount.utilityPubkeys) {
          const keys = mxeAccount.utilityPubkeys.set ? (Array.isArray(mxeAccount.utilityPubkeys.set) ? mxeAccount.utilityPubkeys.set[0] : mxeAccount.utilityPubkeys.set) : mxeAccount.utilityPubkeys;

          const x25519Pub = keys.x25519Pubkey || keys.x25519_pubkey;
          if (!x25519Pub) throw new Error("MXE Public Key missing in Standard SDK metadata.");

          this.mxePublicKey = Uint8Array.from(x25519Pub);
          console.log("✅ Arcium SDK Initialized Successfully (Standard Devnet).");
          this.initialized = true;
          return true;
        }
        throw new Error("Standard SDK MXE found but keys missing.");

      } catch (err: any) {
        console.error(`❌ FATAL: Standard Arcium Initialization Failed: ${err.message}`);
        throw new Error(`Arcium Service Unavailable. Connection Refused.`);
      }
    } catch (error) {
      console.error("❌ Failed to initialize Arcium SDK:", error);
      this.initialized = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized && !!this.mxePublicKey;
  }

  /**
   * Encrypt transaction data using Arcium MXE
   */
  async encryptTransaction(
    transactionData: ConfidentialTransactionData,
    allowedParties: string[]
  ): Promise<EncryptedTransactionResult> {

    if (!this.isAvailable()) {
      console.error("⛔ Arcium TEE not available. Cannot encrypt transaction safely.");
      throw new Error("Arcium TEE unavailable. Transaction rejected for privacy.");
    }

    try {
      const plaintext = JSON.stringify(transactionData);
      const bufferData = Buffer.from(plaintext, "utf-8");

      const ephemeralSecret = x25519.utils.randomSecretKey();
      const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
      const sharedSecret = x25519.getSharedSecret(ephemeralSecret, this.mxePublicKey!);
      const cipher = new RescueCipher(sharedSecret);
      const nonce = randomBytes(16);

      const payload = Array.from(bufferData);
      const payloadBigInts = payload.map(b => BigInt(b));
      const ciphertext = cipher.encrypt(payloadBigInts, nonce);

      // ciphertext is number[][], convert to Uint8Array before concat
      const flatCiphertext = Buffer.concat(ciphertext.map(block => Uint8Array.from(block)));
      const packedData = Buffer.concat([nonce, flatCiphertext]);

      return {
        encryptedData: packedData.toString("base64"),
        encryptionKey: Buffer.from(ephemeralPublic).toString("base64"),
        success: true,
      };

    } catch (error) {
      console.error("Arcium Encryption Failed:", error);
      throw error;
    }
  }

  async decryptTransaction(
    encryptedData: string,
    encryptionKey: string,
    decryptorKeypair: Keypair
  ): Promise<ConfidentialTransactionData | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const packedData = Buffer.from(encryptedData, "base64");
      const senderPublicKey = Buffer.from(encryptionKey, "base64");
      const nonce = Array.from(packedData.subarray(0, 16)); // Convert to array
      const ciphertextFlat = packedData.subarray(16);
      const receiverSecret = Array.from(decryptorKeypair.secretKey.subarray(0, 32)); // Convert to array
      const sharedSecret = x25519.getSharedSecret(Uint8Array.from(receiverSecret), Uint8Array.from(senderPublicKey)); // Ensure Uint8Array for x25519
      const cipher = new RescueCipher(sharedSecret);

      const CHUNK_SIZE = 32;
      const numChunks = ciphertextFlat.length / CHUNK_SIZE;
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < numChunks; i++) {
        chunks.push(ciphertextFlat.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }

      // Fix: cipher.decrypt expects number[][] but chunks is Uint8Array[]
      const chunksAsNumbers = chunks.map(chunk => Array.from(chunk));
      const decryptedBigInts = cipher.decrypt(chunksAsNumbers, Uint8Array.from(nonce));
      const decryptedBytes = decryptedBigInts.map(bi => Number(bi));
      const plaintext = Buffer.from(decryptedBytes).toString("utf-8");

      return JSON.parse(plaintext);
    } catch (error) {
      console.error("Arcium Decryption Failed:", error);
      return null;
    }
  }

}

// Singleton
let arciumServiceInstance: ArciumService | null = null;
export function getArciumService(rpcEndpoint?: string): ArciumService {
  if (!arciumServiceInstance) {
    arciumServiceInstance = new ArciumService(rpcEndpoint);
  }
  return arciumServiceInstance;
}

export async function initializeArciumService(keypair?: Keypair): Promise<boolean> {
  const service = getArciumService();
  return await service.initialize(keypair);
}

export function loadKeypairFromPrivateKey(privateKey: string): Keypair {
  try {
    if (privateKey.startsWith("[")) {
      const secretKey = Uint8Array.from(JSON.parse(privateKey));
      return Keypair.fromSecretKey(secretKey);
    } else {
      const secretKey = bs58.decode(privateKey);
      return Keypair.fromSecretKey(secretKey);
    }
  } catch (error) {
    throw new Error("Invalid private key format");
  }
}
