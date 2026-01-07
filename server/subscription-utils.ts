/**
 * Subscription ID Utilities
 * 
 * Helper functions to ensure consistent UUID-to-PDA conversion
 * across all subscription endpoints
 */

/**
 * Convert a UUID string to a Buffer suitable for on-chain PDA derivation
 * 
 * The server generates UUIDs for subscriptions (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * The smart contract expects a 16-byte seed for PDA derivation
 * 
 * @param uuid - Standard UUID string with hyphens
 * @returns Buffer of 16 bytes (raw UUID without hyphens)
 */
export function uuidToSubscriptionSeed(uuid: string): Buffer {
    // Remove hyphens and convert hex string to buffer
    const hexString = uuid.replace(/-/g, '');
    return Buffer.from(hexString, 'hex');
}

/**
 * Derive the subscription PDA from a UUID
 * 
 * @param uuid - Subscription UUID from database
 * @param authority - Merchant's public key
 * @param programId - Arcium program ID
 * @returns [PDA, bump] tuple
 */
export async function deriveSubscriptionPda(
    uuid: string,
    authority: import("@solana/web3.js").PublicKey,
    programId: import("@solana/web3.js").PublicKey
): Promise<[import("@solana/web3.js").PublicKey, number]> {
    const { PublicKey } = await import("@solana/web3.js");

    const seed = uuidToSubscriptionSeed(uuid);

    return PublicKey.findProgramAddressSync(
        [Buffer.from("subscription"), authority.toBuffer(), seed],
        programId
    );
}
