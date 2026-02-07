
/**
 * Hybrid Privacy Encryption Core
 * 
 * Implements AES-GCM encryption for client-side privacy.
 * Key derivation uses PBKDF2 based on a signature from the user's wallet.
 * This ensures only the user (and those they share the key with) can decrypt data.
 */

// We use the Web Crypto API which is available in modern browsers
// No external dependencies required for basic AES-GCM

export interface EncryptedData {
    iv: string;         // Initialization Vector (Base64)
    data: string;       // Encrypted Ciphertext (Base64)
}

/**
 * Derives a consistent AES-GCM key from a wallet signature.
 * 
 * @param signature - The signature string (base58 or hex) from signing a deterministic message
 * @param salt - A salt (can be the invoice ID or a fixed app salt)
 */
export async function deriveKeyFromSignature(signature: string, salt: string = "invoix-salt-v1"): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(signature),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode(salt),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a JSON object or string using AES-GCM.
 */
export async function encryptData(data: any, key: CryptoKey): Promise<EncryptedData> {
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    // Generate a random IV (12 bytes is standard for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedData
    );

    return {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(ciphertext)
    };
}

/**
 * Decrypts data using AES-GCM.
 */
export async function decryptData(encrypted: EncryptedData, key: CryptoKey): Promise<any> {
    const iv = base64ToArrayBuffer(encrypted.iv);
    const ciphertext = base64ToArrayBuffer(encrypted.data);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decrypted));
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Failed to decrypt data. Invalid key or corrupted data.");
    }
}

/**
 * Export key to raw format (for sharing via URL hash)
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return arrayBufferToBase64(exported);
}

/**
 * Import key from raw format (from URL hash)
 */
export async function importKey(keyStr: string): Promise<CryptoKey> {
    const keyData = base64ToArrayBuffer(keyStr);
    return window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// Utility Helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
