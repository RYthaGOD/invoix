import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (GCM standard)
const AUTH_TAG_LENGTH = 16; // 128 bits (GCM standard)
const SALT_LENGTH = 32; // 256 bits for scrypt
const SCRYPT_N = 16384; // CPU/memory cost parameter (2^14)
const SCRYPT_R = 8; // Block size parameter
const SCRYPT_P = 1; // Parallelization parameter

/**
 * Get master encryption key from environment
 * Supports multiple key sources with fallback hierarchy:
 * 1. INVOICE_ENCRYPTION_KEY (base64-encoded 32 bytes) - preferred
 * 2. INVOICE_ENCRYPTION_PASSPHRASE + SALT (scrypt derivation)
 * 3. ENCRYPTION_MASTER_KEY (legacy, hex or base64)
 * 4. Development fallback (insecure, dev only)
 */
function getMasterKey(): Buffer {
  // Priority 1: Direct key from INVOICE_ENCRYPTION_KEY
  const invoiceKey = process.env.INVOICE_ENCRYPTION_KEY;
  if (invoiceKey) {
    try {
      const keyBuffer = Buffer.from(invoiceKey, "base64");
      if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(`INVOICE_ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes, got ${keyBuffer.length} bytes`);
      }
      return keyBuffer;
    } catch (error: any) {
      console.error("Failed to parse INVOICE_ENCRYPTION_KEY:", error instanceof Error ? error.message : "Unknown error");
      throw new Error("Invalid INVOICE_ENCRYPTION_KEY format. Must be base64-encoded 32 bytes. Generate with: openssl rand -base64 32");
    }
  }

  // Priority 2: Passphrase-based key derivation
  const passphrase = process.env.INVOICE_ENCRYPTION_PASSPHRASE;
  const salt = process.env.INVOICE_ENCRYPTION_SALT;
  if (passphrase && salt) {
    try {
      // Use scrypt for secure key derivation
      return crypto.scryptSync(passphrase, salt, KEY_LENGTH, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
      });
    } catch (error: any) {
      console.error("Failed to derive key from passphrase:", error instanceof Error ? error.message : "Unknown error");
      throw new Error("Failed to derive encryption key from INVOICE_ENCRYPTION_PASSPHRASE");
    }
  }

  // Priority 3: Legacy ENCRYPTION_MASTER_KEY
  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  if (envKey) {
    try {
      // Try hex first (64 characters)
      if (envKey.length === 64) {
        const keyBuffer = Buffer.from(envKey, "hex");
        if (keyBuffer.length === KEY_LENGTH) {
          return keyBuffer;
        }
      }
      // Try base64 (44 characters)
      const keyBuffer = Buffer.from(envKey, "base64");
      if (keyBuffer.length === KEY_LENGTH) {
        return keyBuffer;
      }
      throw new Error(`Key length mismatch: expected ${KEY_LENGTH} bytes, got ${keyBuffer.length} bytes`);
    } catch (error: any) {
      console.error("Failed to parse ENCRYPTION_MASTER_KEY:", error instanceof Error ? error.message : "Unknown error");
      throw new Error("Invalid ENCRYPTION_MASTER_KEY format");
    }
  }

  // No fallback allowed - Set INVOICE_ENCRYPTION_KEY for all environments
  if (process.env.NODE_ENV !== "production") {
    console.warn("⚠️  WARNING: No encryption key configured in environment!");
    console.warn("⚠️  Set INVOICE_ENCRYPTION_KEY (base64 32 bytes)");
    console.warn("⚠️  Generate with: openssl rand -base64 32");
  }

  throw new Error(
    "No encryption key configured. Set INVOICE_ENCRYPTION_KEY (base64 32 bytes) or " +
    "INVOICE_ENCRYPTION_PASSPHRASE + INVOICE_ENCRYPTION_SALT. " +
    "Generate key with: openssl rand -base64 32"
  );
}

interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns ciphertext, IV, and authentication tag separately
 */
export function encrypt(plaintext: string): EncryptedData {
  try {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Securely wipe the master key from memory
    masterKey.fill(0);

    return {
      ciphertext,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error: any) {
    console.error("Encryption error:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 * Requires ciphertext, IV, and authentication tag
 */
export function decrypt(ciphertext: string, iv: string, authTag: string): string {
  try {
    const masterKey = getMasterKey();
    const ivBuffer = Buffer.from(iv, "hex");
    const authTagBuffer = Buffer.from(authTag, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, ivBuffer, {
      authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAuthTag(authTagBuffer);

    let plaintext = decipher.update(ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");

    // Securely wipe the master key from memory
    masterKey.fill(0);

    return plaintext;
  } catch (error: any) {
    console.error("Decryption error:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to decrypt data - invalid key or corrupted data");
  }
}

/**
 * Generates a non-reversible fingerprint for change detection
 * Uses HMAC-SHA256 and truncates to 16 bytes
 */
export function generateFingerprint(data: string): string {
  try {
    const masterKey = getMasterKey();
    const hmac = crypto.createHmac("sha256", masterKey);
    hmac.update(data);
    const hash = hmac.digest("hex");

    // Securely wipe the master key from memory
    masterKey.fill(0);

    // Return first 16 bytes (32 hex chars) for compact storage
    return hash.substring(0, 32);
  } catch (error: any) {
    console.error("Fingerprint generation error:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to generate fingerprint");
  }
}

/**
 * Verifies that a plaintext string matches a fingerprint
 */
export function verifyFingerprint(data: string, fingerprint: string): boolean {
  try {
    const newFingerprint = generateFingerprint(data);
    return newFingerprint === fingerprint;
  } catch (error: any) {
    console.error("Fingerprint verification error:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

/**
 * Securely wipes a string or buffer from memory
 */
export function secureWipe(data: Buffer | string): void {
  if (Buffer.isBuffer(data)) {
    data.fill(0);
  } else {
    // For strings, we can't directly wipe memory, but we can help GC
    // In production, use Buffer for sensitive data
    data = "";
  }
}

/**
 * Validates that a private key is in base58 format and reasonable length
 */
export function validatePrivateKey(key: string): boolean {
  // Solana private keys are typically 88 characters in base58
  // Allow some flexibility for different formats
  if (key.length < 32 || key.length > 128) {
    console.error(`Key validation failed: Invalid length ${key.length} (expected 32-128)`);
    return false;
  }

  // Check that it only contains valid base58 characters
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  if (!base58Regex.test(key)) {
    // Find the invalid character
    const invalidChars = key.split('').filter(char =>
      !'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.includes(char)
    );
    const uniqueInvalidChars = Array.from(new Set(invalidChars)).join(', ');
    console.error(`Key validation failed: Contains invalid base58 characters: ${uniqueInvalidChars}`);
    return false;
  }

  return true;
}
