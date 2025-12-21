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
    const endpoint = rpcEndpoint || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(endpoint, "confirmed");
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
      const idlPath = path.resolve(__dirname, "../arcium_idl.json");
      if (!fs.existsSync(idlPath)) {
        throw new Error(`Critical: Arcium IDL not found at ${idlPath}`);
      }
      const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

      const envProgramId = process.env.ARCIUM_PROGRAM_ID ? new PublicKey(process.env.ARCIUM_PROGRAM_ID) : undefined;

      if (envProgramId) {
        console.log(`   Using Program ID: ${envProgramId.toBase58()}`);
        idl.address = envProgramId.toBase58();
        if (idl.metadata) idl.metadata.address = envProgramId.toBase58();
        this.program = new anchor.Program(idl, this.provider);
      } else {
        console.log("   Using default SDK Program.");
        this.program = getArciumProgram(this.provider);
      }

      console.log(`   Program ID: ${this.program.programId.toBase58()}`);

      // 3. Manually Fetch MXE Public Key
      // We do this manually because the SDK helper 'getMXEPublicKey' is hardcoded 
      // to derivation base 'BpaW2Zm...', while our deployment is user-defined.
      console.log("   Fetching MXE Metadata Account...");

      const [mxeAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("MXEAccount"), this.program.programId.toBuffer()],
        this.program.programId
      );
      console.log(`   MXE PDA: ${mxeAccountPda.toBase58()}`);

      try {
        // Use our local IDL-based program instance to fetch the metadata
        // We define the expected shape to avoid @ts-ignore
        type MxeAccountData = {
          utilityPubkeys: {
            set?: Array<{ x25519Pubkey?: number[], x25519_pubkey?: number[] }> | { x25519Pubkey?: number[], x25519_pubkey?: number[] };
          }
        };

        const mxeAccount = (await (this.program.account as any).mxeAccount.fetch(mxeAccountPda)) as unknown as MxeAccountData;

        // Extract Utility Keys from SetUnset enum
        // Anchor transforms Rust enum SetUnset::Set(T) into { set: T }
        // Tuple variants are indexed: Set(T) -> set: { "0": T }
        if (mxeAccount.utilityPubkeys && mxeAccount.utilityPubkeys.set) {
          const keys = mxeAccount.utilityPubkeys.set;
          // Handle both array (tuple) or direct object structure depending on anchor version
          const target = Array.isArray(keys) ? keys[0] : keys;
          const x25519Pub = target.x25519Pubkey || target.x25519_pubkey;

          if (!x25519Pub) {
            throw new Error("X25519 Key not found in utility keys metadata.");
          }

          this.mxePublicKey = Uint8Array.from(x25519Pub);
        } else {
          throw new Error("MXE Public Key state is 'Unset' on-chain.");
        }
      } catch (err: any) {
        console.error(`❌ Arcium Initialization Error: ${err.message}`);
        throw new Error(`Failed to retrieve MXE metadata from ${mxeAccountPda.toBase58()}.`);
      }

      this.initialized = true;
      console.log("✅ Arcium SDK Initialized Successfully.");
      return true;

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

      const decryptedBigInts = cipher.decrypt(chunks, nonce);
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
