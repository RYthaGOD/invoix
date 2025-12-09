/**
 * Enhanced Invoice Encryption Service
 * 
 * Provides multi-party AES-256-GCM encryption for B2B invoices
 * Both invoicer and invoicee can decrypt using their wallet addresses
 * 
 * Features:
 * - Zero external dependencies (Node.js crypto module)
 * - Production-grade AES-256-GCM encryption
 * - Authenticated encryption (prevents tampering)
 * - Deterministic key derivation from wallet addresses
 * - No keys stored in database
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export interface EncryptedInvoiceData {
    encrypted: string;
    iv: string;
    authTag: string;
    salt: string;
}

export class InvoiceEncryption {
    private algorithm = 'aes-256-gcm';
    private keyLength = 32; // 256 bits
    private ivLength = 16; // 128 bits
    private saltLength = 16;

    /**
     * Derive encryption key from both parties' wallet addresses
     * This allows both invoicer and invoicee to decrypt
     * 
     * @param invoicerPubkey - Invoicer's wallet public key
     * @param invoiceePubkey - Invoicee's wallet public key
     * @param salt - Random salt for key derivation
     * @returns 32-byte encryption key
     */
    private deriveKey(invoicerPubkey: string, invoiceePubkey: string, salt: Buffer): Buffer {
        // Combine both public keys in a deterministic way
        // Sort alphabetically to ensure same key regardless of order
        const keys = [invoicerPubkey, invoiceePubkey].sort();
        const combined = `${keys[0]}:${keys[1]}`;

        // Use scrypt for key derivation (more secure than simple hash)
        return scryptSync(combined, salt, this.keyLength);
    }

    /**
     * Encrypt invoice data for two parties
     * Both invoicer and invoicee will be able to decrypt
     * 
     * @param data - Invoice data to encrypt (will be JSON stringified)
     * @param invoicerPubkey - Invoicer's wallet public key
     * @param invoiceePubkey - Invoicee's wallet public key
     * @returns Encrypted data with IV, auth tag, and salt
     */
    encrypt(
        data: any,
        invoicerPubkey: string,
        invoiceePubkey: string
    ): EncryptedInvoiceData {
        try {
            // Generate random salt and IV
            const salt = randomBytes(this.saltLength);
            const iv = randomBytes(this.ivLength);

            // Derive encryption key from both wallet addresses
            const key = this.deriveKey(invoicerPubkey, invoiceePubkey, salt);

            // Create cipher
            const cipher = createCipheriv(this.algorithm, key, iv);

            // Encrypt data
            const plaintext = JSON.stringify(data);
            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Get authentication tag
            // @ts-ignore - getAuthTag exists in Node.js crypto but TypeScript types are outdated
            const authTag = cipher.getAuthTag();

            return {
                encrypted,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                salt: salt.toString('base64'),
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt invoice data');
        }
    }

    /**
     * Decrypt invoice data
     * Works if caller provides correct invoicer and invoicee public keys
     * 
     * @param encryptedData - Encrypted invoice data
     * @param invoicerPubkey - Invoicer's wallet public key
     * @param invoiceePubkey - Invoicee's wallet public key
     * @returns Decrypted invoice data
     */
    decrypt(
        encryptedData: EncryptedInvoiceData,
        invoicerPubkey: string,
        invoiceePubkey: string
    ): any {
        try {
            // Convert base64 strings back to buffers
            const salt = Buffer.from(encryptedData.salt, 'base64');
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const authTag = Buffer.from(encryptedData.authTag, 'base64');

            // Derive the same encryption key
            const key = this.deriveKey(invoicerPubkey, invoiceePubkey, salt);

            // Create decipher
            const decipher = createDecipheriv(this.algorithm, key, iv);
            // @ts-ignore - setAuthTag exists in Node.js crypto but TypeScript types are outdated
            decipher.setAuthTag(authTag);

            // Decrypt data
            let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            // Parse JSON
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt invoice data - invalid keys or corrupted data');
        }
    }

    /**
     * Encrypt specific sensitive fields of an invoice
     * Useful for partial encryption (e.g., amounts only)
     * 
     * @param invoice - Invoice object
     * @param fieldsToEncrypt - Array of field names to encrypt
     * @param invoicerPubkey - Invoicer's wallet public key
     * @param invoiceePubkey - Invoicee's wallet public key
     * @returns Object with encrypted fields
     */
    encryptFields(
        invoice: Record<string, any>,
        fieldsToEncrypt: string[],
        invoicerPubkey: string,
        invoiceePubkey: string
    ): EncryptedInvoiceData {
        // Extract only the fields to encrypt
        const sensitiveData: Record<string, any> = {};
        for (const field of fieldsToEncrypt) {
            if (field in invoice) {
                sensitiveData[field] = invoice[field];
            }
        }

        return this.encrypt(sensitiveData, invoicerPubkey, invoiceePubkey);
    }

    /**
     * Decrypt and merge encrypted fields back into invoice object
     * 
     * @param invoice - Invoice object with public fields
     * @param encryptedData - Encrypted sensitive fields
     * @param invoicerPubkey - Invoicer's wallet public key
     * @param invoiceePubkey - Invoicee's wallet public key
     * @returns Complete invoice with decrypted fields
     */
    decryptFields(
        invoice: Record<string, any>,
        encryptedData: EncryptedInvoiceData,
        invoicerPubkey: string,
        invoiceePubkey: string
    ): Record<string, any> {
        const decryptedFields = this.decrypt(encryptedData, invoicerPubkey, invoiceePubkey);
        return { ...invoice, ...decryptedFields };
    }
}

// Singleton instance
let invoiceEncryptionInstance: InvoiceEncryption | null = null;

/**
 * Get or create InvoiceEncryption singleton
 */
export function getInvoiceEncryption(): InvoiceEncryption {
    if (!invoiceEncryptionInstance) {
        invoiceEncryptionInstance = new InvoiceEncryption();
    }
    return invoiceEncryptionInstance;
}

/**
 * Helper: Determine which fields should be encrypted
 * Based on privacy settings
 */
export function getSensitiveFields(privacySettings: {
    hideAmounts?: boolean;
    hideLineItems?: boolean;
    hideNotes?: boolean;
}): string[] {
    const fields: string[] = [];

    if (privacySettings.hideAmounts) {
        fields.push('totalAmount', 'subtotal', 'taxAmount', 'discountAmount');
    }

    if (privacySettings.hideLineItems) {
        fields.push('lineItems');
    }

    if (privacySettings.hideNotes) {
        fields.push('notes', 'paymentInstructions');
    }

    return fields;
}
