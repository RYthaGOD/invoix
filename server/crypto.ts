import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

// Get master encryption key from environment or generate for development
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  
  if (envKey) {
    // Convert from hex or base64
    try {
      return Buffer.from(envKey, "hex");
    } catch {
      return Buffer.from(envKey, "base64");
    }
  }
  
  // Development fallback - NOT FOR PRODUCTION
  if (process.env.NODE_ENV !== "production") {
    console.warn("⚠️  WARNING: Using development encryption key. Set ENCRYPTION_MASTER_KEY for production!");
    return crypto.scryptSync("solanainvoice-dev-key-insecure", "salt", KEY_LENGTH);
  }
  
  throw new Error("ENCRYPTION_MASTER_KEY environment variable is required in production");
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
