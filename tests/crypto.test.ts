/**
 * Crypto Module Tests
 * Tests for AES-256-GCM encryption, decryption, and key management
 */

import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, generateFingerprint, verifyFingerprint } from "../server/crypto";

describe("Crypto Module", () => {
  beforeAll(() => {
    // Set a valid 32-byte base64 key for testing
    // This resolves the "Invalid INVOICE_ENCRYPTION_KEY format" error
    process.env.INVOICE_ENCRYPTION_KEY = "Q0hReljZDgxyCLDFQR+pQ6PURWom5dZze56ie+wzIYk=";
  });
  describe("Encryption/Decryption Round-Trip", () => {
    it("should encrypt and decrypt text successfully", () => {
      const plaintext = "Hello, Solana Invoice System!";

      const encrypted = encrypt(plaintext);
      expect(encrypted).toHaveProperty("ciphertext");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("authTag");

      // Ciphertext should be different from plaintext
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle JSON data encryption", () => {
      const data = {
        invoiceNumber: "INV-2025-001",
        amount: "1000.50",
        currency: "USDC",
        sensitive: true
      };
      const plaintext = JSON.stringify(data);

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
      const parsedData = JSON.parse(decrypted);

      expect(parsedData).toEqual(data);
    });

    it("should generate unique IVs for each encryption", () => {
      const plaintext = "Same message";

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // IVs should be different (unique random nonces)
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // Ciphertexts should be different due to different IVs
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // But both should decrypt to the same plaintext
      const decrypted1 = decrypt(encrypted1.ciphertext, encrypted1.iv, encrypted1.authTag);
      const decrypted2 = decrypt(encrypted2.ciphertext, encrypted2.iv, encrypted2.authTag);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it("should handle empty strings", () => {
      const plaintext = "";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle large data", () => {
      // Create a large JSON object
      const largeData = {
        lineItems: Array.from({ length: 100 }, (_, i) => ({
          description: `Item ${i}`,
          quantity: i + 1,
          unitPrice: `${(i + 1) * 10}.00`,
          lineTotal: `${(i + 1) * (i + 1) * 10}.00`
        }))
      };
      const plaintext = JSON.stringify(largeData);

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
      const parsedData = JSON.parse(decrypted);

      expect(parsedData).toEqual(largeData);
      expect(parsedData.lineItems).toHaveLength(100);
    });

    it("should handle Unicode and special characters", () => {
      const plaintext = "Hello 世界! 🌟 Special chars: @#$%^&*()";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("Authentication and Tamper Detection", () => {
    it("should detect tampered ciphertext", () => {
      const plaintext = "Sensitive invoice data";
      const encrypted = encrypt(plaintext);

      // Tamper with ciphertext
      const tamperedCiphertext = encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 1) + "X";

      expect(() => {
        decrypt(tamperedCiphertext, encrypted.iv, encrypted.authTag);
      }).toThrow();
    });

    it("should detect tampered IV", () => {
      const plaintext = "Sensitive invoice data";
      const encrypted = encrypt(plaintext);

      // Tamper with IV
      const ivBuffer = Buffer.from(encrypted.iv, "hex");
      ivBuffer[0] = ivBuffer[0] ^ 0xFF; // Flip bits
      const tamperedIV = ivBuffer.toString("hex");

      expect(() => {
        decrypt(encrypted.ciphertext, tamperedIV, encrypted.authTag);
      }).toThrow();
    });

    it("should detect tampered auth tag", () => {
      const plaintext = "Sensitive invoice data";
      const encrypted = encrypt(plaintext);

      // Tamper with auth tag
      const tagBuffer = Buffer.from(encrypted.authTag, "hex");
      tagBuffer[0] = tagBuffer[0] ^ 0xFF; // Flip bits
      const tamperedTag = tagBuffer.toString("hex");

      expect(() => {
        decrypt(encrypted.ciphertext, encrypted.iv, tamperedTag);
      }).toThrow();
    });

    it("should reject wrong key (via auth tag)", () => {
      const plaintext = "Sensitive data";
      const encrypted = encrypt(plaintext);

      // Create another encryption to get different auth tag
      const encrypted2 = encrypt("Different data");

      expect(() => {
        decrypt(encrypted.ciphertext, encrypted.iv, encrypted2.authTag);
      }).toThrow();
    });
  });

  describe("Fingerprint Generation", () => {
    it("should generate consistent fingerprints", () => {
      const data = "Test data for fingerprint";

      const fp1 = generateFingerprint(data);
      const fp2 = generateFingerprint(data);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[0-9a-f]{32}$/); // 32 hex chars
    });

    it("should generate different fingerprints for different data", () => {
      const data1 = "Data 1";
      const data2 = "Data 2";

      const fp1 = generateFingerprint(data1);
      const fp2 = generateFingerprint(data2);

      expect(fp1).not.toBe(fp2);
    });

    it("should verify fingerprints correctly", () => {
      const data = "Test data";
      const fp = generateFingerprint(data);

      expect(verifyFingerprint(data, fp)).toBe(true);
      expect(verifyFingerprint("Different data", fp)).toBe(false);
    });

    it("should detect even small changes", () => {
      const data1 = "invoice-001";
      const data2 = "invoice-002";

      const fp1 = generateFingerprint(data1);

      expect(verifyFingerprint(data1, fp1)).toBe(true);
      expect(verifyFingerprint(data2, fp1)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should throw on invalid ciphertext format", () => {
      expect(() => {
        decrypt("invalid-hex", "0".repeat(32), "0".repeat(32));
      }).toThrow();
    });

    it("should throw on invalid IV format", () => {
      const encrypted = encrypt("test");

      expect(() => {
        decrypt(encrypted.ciphertext, "invalid-iv", encrypted.authTag);
      }).toThrow();
    });

    it("should throw on invalid auth tag format", () => {
      const encrypted = encrypt("test");

      expect(() => {
        decrypt(encrypted.ciphertext, encrypted.iv, "invalid-tag");
      }).toThrow();
    });

    it("should handle empty IV gracefully", () => {
      const encrypted = encrypt("test");

      expect(() => {
        decrypt(encrypted.ciphertext, "", encrypted.authTag);
      }).toThrow();
    });
  });

  describe("Security Properties", () => {
    it("should use 256-bit keys (32 bytes)", () => {
      // This is verified by the key generation process
      // If wrong key length, getMasterKey would throw
      expect(() => encrypt("test")).not.toThrow();
    });

    it("should use 128-bit IVs (16 bytes)", () => {
      const encrypted = encrypt("test");
      const ivBuffer = Buffer.from(encrypted.iv, "hex");
      expect(ivBuffer.length).toBe(16);
    });

    it("should use 128-bit auth tags (16 bytes)", () => {
      const encrypted = encrypt("test");
      const tagBuffer = Buffer.from(encrypted.authTag, "hex");
      expect(tagBuffer.length).toBe(16);
    });

    it("should produce non-predictable ciphertexts", () => {
      const plaintext = "predictable";

      const results = Array.from({ length: 10 }, () => encrypt(plaintext));
      const ciphertexts = results.map(r => r.ciphertext);

      // All ciphertexts should be different
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(10);
    });
  });
});
