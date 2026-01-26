/**
 * Arcium SDK-Only Encryption Service
 * 
 * Uses Arcium's crypto primitives (x25519 + RescueCipher) directly
 * without requiring an on-chain MXE account. This provides:
 * - ECDH key exchange for secure key derivation
 * - RescueCipher (Poseidon-based) symmetric encryption
 * 
 * Each encryption generates an ephemeral keypair. The recipient
 * uses their private key to derive the shared secret and decrypt.
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { RescueCipher, x25519 } from "@arcium-hq/client";
import { createHash, randomBytes } from "crypto";

interface ConfidentialTransactionData {
  amount: string;
  tokenAmount: string;
  fromAddress: string;
  toAddress: string;
  txSignature: string;
  timestamp: number;
  description?: string;
  paymentTerms?: string;
  notes?: string;
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

/**
 * Derives an x25519 private key from an Ed25519 secret key.
 * Standard conversion per RFC 8032.
 */
function ed25519ToX25519PrivateKey(ed25519Secret: Uint8Array): Uint8Array {
  // Hash the 32-byte private key with SHA-512
  const hash = createHash("sha512").update(ed25519Secret.subarray(0, 32)).digest();
  const xSecret = hash.subarray(0, 32);

  // Clamp (per X25519 spec)
  xSecret[0] &= 248;
  xSecret[31] &= 127;
  xSecret[31] |= 64;

  return xSecret;
}

/**
 * Derives an x25519 public key from an Ed25519 keypair.
 */
function ed25519ToX25519PublicKey(ed25519Secret: Uint8Array): Uint8Array {
  const xPrivate = ed25519ToX25519PrivateKey(ed25519Secret);
  return x25519.getPublicKey(xPrivate);
}

export class ArciumService {
  private serverKeypair: Keypair | null = null;
  private serverX25519Public: Uint8Array | null = null;
  private serverX25519Private: Uint8Array | null = null;
  private initialized: boolean = false;

  constructor() {
    // No connection needed for SDK-only mode
  }

  /**
   * Initialize with a server keypair for decryption capabilities.
   * The server's x25519 public key is derived and used as the "MXE" key.
   */
  async initialize(keypair?: Keypair): Promise<boolean> {
    try {
      console.log("🔒 Initializing Arcium SDK-Only Encryption Service...");

      if (keypair) {
        this.serverKeypair = keypair;
      } else if (process.env.ARCIUM_PRIVATE_KEY || process.env.PAYER_PRIVATE_KEY) {
        // Load from environment
        const privateKey = process.env.ARCIUM_PRIVATE_KEY || process.env.PAYER_PRIVATE_KEY!;
        this.serverKeypair = loadKeypairFromPrivateKey(privateKey);
      } else {
        // Generate ephemeral keypair (server restart = new keys)
        console.log("   ⚠️ No keypair provided, generating ephemeral keys...");
        this.serverKeypair = Keypair.generate();
      }

      // Derive x25519 keys from Ed25519 keypair
      this.serverX25519Private = ed25519ToX25519PrivateKey(this.serverKeypair.secretKey);
      this.serverX25519Public = ed25519ToX25519PublicKey(this.serverKeypair.secretKey);

      console.log("   ✅ Server Ed25519 Pubkey:", this.serverKeypair.publicKey.toBase58());
      console.log("   ✅ Derived X25519 Pubkey:", Buffer.from(this.serverX25519Public).toString("hex").substring(0, 32) + "...");
      console.log("✅ Arcium SDK-Only Mode Active (Local x25519 + RescueCipher)");

      this.initialized = true;
      return true;
    } catch (error: any) {
      console.error("❌ Failed to initialize Arcium SDK-Only Service:", error);
      this.initialized = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized && !!this.serverX25519Public;
  }

  /**
   * Get the server's x25519 public key for encryption.
   * This is equivalent to what the on-chain MXE would provide.
   */
  getServerPublicKey(): Uint8Array | null {
    return this.serverX25519Public;
  }

  /**
   * Validate a Solana address format (base58, 32-44 characters)
   */
  private isValidSolanaAddress(address: string): boolean {
    if (typeof address !== 'string') return false;
    if (address.length < 32 || address.length > 44) return false;
    // Base58 character set (no 0, O, I, l)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  /**
   * Encrypt transaction data using x25519 ECDH + RescueCipher.
   *
   * The flow:
   * 1. Validate input parameters
   * 2. Generate ephemeral x25519 keypair
   * 3. Derive shared secret with server's public key
   * 4. Use RescueCipher to encrypt the data
   * 5. Return encrypted data + ephemeral public key
   */
  async encryptTransaction(
    transactionData: ConfidentialTransactionData,
    allowedParties: string[]
  ): Promise<EncryptedTransactionResult> {

    // Input validation
    if (!transactionData || typeof transactionData !== 'object') {
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        error: "Invalid transaction data: must be a non-null object",
      };
    }

    // Validate required fields
    if (!transactionData.amount || !transactionData.fromAddress || !transactionData.toAddress) {
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        error: "Missing required fields: amount, fromAddress, and toAddress are required",
      };
    }

    // Validate fromAddress and toAddress are valid Solana addresses
    if (!this.isValidSolanaAddress(transactionData.fromAddress)) {
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        error: "Invalid fromAddress: must be a valid Solana address (base58, 32-44 chars)",
      };
    }

    if (!this.isValidSolanaAddress(transactionData.toAddress)) {
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        error: "Invalid toAddress: must be a valid Solana address (base58, 32-44 chars)",
      };
    }

    // Validate allowed parties (at least 2 for multi-party encryption)
    if (!Array.isArray(allowedParties) || allowedParties.length < 2) {
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        error: "Invalid allowedParties: must be an array with at least 2 parties",
      };
    }

    for (const party of allowedParties) {
      if (!this.isValidSolanaAddress(party)) {
        return {
          encryptedData: "",
          encryptionKey: "",
          success: false,
          error: `Invalid party address: ${party.substring(0, 10)}... is not a valid Solana address`,
        };
      }
    }

    if (!this.isAvailable()) {
      console.error("⛔ Arcium SDK not initialized. Cannot encrypt.");
      throw new Error("Arcium encryption service not available.");
    }

    try {
      const plaintext = JSON.stringify(transactionData);
      const bufferData = Buffer.from(plaintext, "utf-8");

      // 1. Generate ephemeral keypair for this encryption
      const ephemeralSecret = x25519.utils.randomSecretKey();
      const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);

      // 2. Derive shared secret with server's public key
      const sharedSecret = x25519.getSharedSecret(ephemeralSecret, this.serverX25519Public!);

      // 3. Encrypt with RescueCipher
      const cipher = new RescueCipher(sharedSecret);
      const nonce = randomBytes(16);

      const payload = Array.from(bufferData);
      const payloadBigInts = payload.map(b => BigInt(b));
      const ciphertext = cipher.encrypt(payloadBigInts, nonce);

      // Flatten ciphertext blocks
      const flatCiphertext = Buffer.concat(ciphertext.map(block => Uint8Array.from(block)));
      const packedData = Buffer.concat([nonce, flatCiphertext]);

      return {
        encryptedData: packedData.toString("base64"),
        encryptionKey: Buffer.from(ephemeralPublic).toString("base64"),
        success: true,
      };

    } catch (error: any) {
      console.error("Arcium Encryption Failed:", error);
      return {
        encryptedData: "",
        encryptionKey: "",
        success: false,
        // Sanitize error messages in production to prevent information leakage
        error: process.env.NODE_ENV === "production"
          ? "Encryption service temporarily unavailable"
          : (error instanceof Error ? error.message : "Unknown encryption error"),
      };
    }
  }

  /**
   * Decrypt transaction data using the server's private key.
   * 
   * The flow:
   * 1. Extract ephemeral public key from encryptionKey
   * 2. Derive shared secret with server's private key
   * 3. Use RescueCipher to decrypt
   */
  async decryptTransaction(
    encryptedData: string,
    encryptionKey: string,
    decryptorKeypair?: Keypair // Optional: use specific keypair instead of server's
  ): Promise<ConfidentialTransactionData | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const packedData = Buffer.from(encryptedData, "base64");
      const senderPublicKey = Buffer.from(encryptionKey, "base64");
      const nonce = Array.from(packedData.subarray(0, 16));
      const ciphertextFlat = packedData.subarray(16);

      // Determine which private key to use
      let x25519PrivateKey: Uint8Array;
      if (decryptorKeypair) {
        x25519PrivateKey = ed25519ToX25519PrivateKey(decryptorKeypair.secretKey);
      } else {
        x25519PrivateKey = this.serverX25519Private!;
      }

      // Derive shared secret
      const sharedSecret = x25519.getSharedSecret(x25519PrivateKey, Uint8Array.from(senderPublicKey));
      const cipher = new RescueCipher(sharedSecret);

      // Parse ciphertext into 32-byte chunks
      const CHUNK_SIZE = 32;
      const numChunks = ciphertextFlat.length / CHUNK_SIZE;
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < numChunks; i++) {
        chunks.push(ciphertextFlat.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }

      const chunksAsNumbers = chunks.map(chunk => Array.from(chunk));
      const decryptedBigInts = cipher.decrypt(chunksAsNumbers, Uint8Array.from(nonce));
      const decryptedBytes = decryptedBigInts.map(bi => Number(bi));
      const plaintext = Buffer.from(decryptedBytes).toString("utf-8");

      return JSON.parse(plaintext);
    } catch (error: any) {
      console.error("Arcium Decryption Failed:", error);
      return null;
    }
  }

  /**
   * Encrypt arbitrary data (not just transactions).
   */
  async encryptData(data: any): Promise<EncryptedTransactionResult> {
    return this.encryptTransaction(data as ConfidentialTransactionData, []);
  }

  /**
   * Decrypt arbitrary data.
   */
  async decryptData(encryptedData: string, encryptionKey: string): Promise<any | null> {
    return this.decryptTransaction(encryptedData, encryptionKey);
  }
}

// Singleton
let arciumServiceInstance: ArciumService | null = null;

export function getArciumService(): ArciumService {
  if (!arciumServiceInstance) {
    arciumServiceInstance = new ArciumService();
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
  } catch (error: any) {
    throw new Error("Invalid private key format");
  }
}
