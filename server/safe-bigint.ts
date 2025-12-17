/**
 * Safe BigInt Utilities
 * 
 * Mitigates bigint-buffer vulnerability (GHSA-3gc7-fjrx-p6mg)
 * by adding input validation and bounds checking for large integer operations.
 * 
 * The vulnerability allows buffer overflow via toBigIntLE() when processing
 * maliciously crafted large buffers. This module provides safe wrappers.
 */

// Maximum safe values for Solana operations
const MAX_LAMPORTS = BigInt("18446744073709551615"); // u64 max (2^64 - 1)
const MAX_TOKEN_AMOUNT = BigInt("18446744073709551615"); // u64 max
const MAX_BUFFER_SIZE = 32; // Maximum buffer size for bigint conversion (256 bits)

/**
 * Safely parse a string amount to lamports with bounds checking
 * Prevents overflow attacks by validating input before conversion
 */
export function safeParseToLamports(amount: string | number, decimals: number = 9): bigint {
    // Validate input type
    if (typeof amount !== "string" && typeof amount !== "number") {
        throw new Error("Invalid amount type: must be string or number");
    }

    // Convert to string and validate format
    const amountStr = amount.toString();

    // Check for malicious input patterns
    if (amountStr.length > 50) {
        throw new Error("Amount string too long: potential overflow attack");
    }

    if (!/^-?\d*\.?\d+$/.test(amountStr)) {
        throw new Error("Invalid amount format: must be a valid number");
    }

    // Parse the number
    const numAmount = parseFloat(amountStr);

    // Check for infinity or NaN
    if (!Number.isFinite(numAmount)) {
        throw new Error("Invalid amount: must be a finite number");
    }

    // Check for negative amounts
    if (numAmount < 0) {
        throw new Error("Invalid amount: must be non-negative");
    }

    // Convert to base units (lamports/smallest unit)
    const multiplier = Math.pow(10, decimals);
    const baseUnits = BigInt(Math.floor(numAmount * multiplier));

    // Bounds check
    if (baseUnits > MAX_LAMPORTS) {
        throw new Error(`Amount exceeds maximum allowed: ${MAX_LAMPORTS.toString()}`);
    }

    return baseUnits;
}

/**
 * Safely convert a buffer to BigInt with size validation
 * Prevents buffer overflow by checking buffer size before conversion
 */
export function safeBufferToBigInt(buffer: Buffer | Uint8Array): bigint {
    // Validate buffer size
    if (buffer.length > MAX_BUFFER_SIZE) {
        throw new Error(`Buffer too large for safe BigInt conversion: ${buffer.length} > ${MAX_BUFFER_SIZE}`);
    }

    if (buffer.length === 0) {
        return BigInt(0);
    }

    // Convert buffer to BigInt manually (safe implementation)
    let result = BigInt(0);
    for (let i = buffer.length - 1; i >= 0; i--) {
        result = (result << BigInt(8)) | BigInt(buffer[i]);
    }

    return result;
}

/**
 * Safely convert BigInt to buffer with size validation
 */
export function safeBigIntToBuffer(value: bigint, size: number = 8): Buffer {
    // Validate size
    if (size > MAX_BUFFER_SIZE) {
        throw new Error(`Requested buffer size too large: ${size} > ${MAX_BUFFER_SIZE}`);
    }

    // Validate value is non-negative
    if (value < BigInt(0)) {
        throw new Error("Cannot convert negative BigInt to buffer");
    }

    // Check if value fits in requested size
    const maxValue = (BigInt(1) << BigInt(size * 8)) - BigInt(1);
    if (value > maxValue) {
        throw new Error(`Value ${value} exceeds maximum for ${size}-byte buffer`);
    }

    // Convert to buffer (little-endian)
    const buffer = Buffer.alloc(size);
    let tempValue = value;
    for (let i = 0; i < size; i++) {
        buffer[i] = Number(tempValue & BigInt(0xff));
        tempValue >>= BigInt(8);
    }

    return buffer;
}

/**
 * Validate a Solana public key string
 */
export function validatePublicKey(address: string): boolean {
    // Base58 character set
    const base58Chars = /^[1-9A-HJ-NP-Za-km-z]+$/;

    // Solana public keys are 32-44 characters in base58
    if (!address || address.length < 32 || address.length > 44) {
        return false;
    }

    return base58Chars.test(address);
}

/**
 * Validate and sanitize a token amount for Solana operations
 */
export function validateTokenAmount(amount: string | number, decimals: number = 6): {
    isValid: boolean;
    sanitized: string;
    error?: string;
} {
    try {
        const lamports = safeParseToLamports(amount, decimals);
        return {
            isValid: true,
            sanitized: lamports.toString(),
        };
    } catch (error) {
        return {
            isValid: false,
            sanitized: "0",
            error: error instanceof Error ? error.message : "Unknown validation error",
        };
    }
}

export {
    MAX_LAMPORTS,
    MAX_TOKEN_AMOUNT,
    MAX_BUFFER_SIZE,
};
