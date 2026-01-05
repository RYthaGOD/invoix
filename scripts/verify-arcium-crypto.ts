
import { Keypair } from "@solana/web3.js";
import { ArciumService } from "../server/arcium-service";
import { x25519, RescueCipher } from "@arcium-hq/client";
import { createHash, randomBytes } from "crypto";
import { strict as assert } from "assert";

console.log("🔒 Running Arcium Crypto Verification (Offline Mode)...");

async function manualEncrypt(payload: any, receiverX25519PubKey: Uint8Array) {
    const plaintext = JSON.stringify(payload);
    const bufferData = Buffer.from(plaintext, "utf-8");

    // 1. Ephemeral Sender
    const ephemeralSecret = x25519.utils.randomSecretKey();
    const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);

    // 2. ECDH
    const sharedSecret = x25519.getSharedSecret(ephemeralSecret, receiverX25519PubKey);
    const cipher = new RescueCipher(sharedSecret);
    const nonce = randomBytes(16);

    // 3. Encrypt
    const payloadArr = Array.from(bufferData);
    const payloadBigInts = payloadArr.map(b => BigInt(b));
    const ciphertext = cipher.encrypt(payloadBigInts, nonce);

    const flatCiphertext = Buffer.concat(ciphertext.map(block => Uint8Array.from(block)));
    const packedData = Buffer.concat([nonce, flatCiphertext]);

    return {
        encryptedData: packedData.toString("base64"),
        encryptionKey: Buffer.from(ephemeralPublic).toString("base64"),
    };
}

async function runTest() {
    console.log("✅ Initialization skipped (Testing pure crypto)");

    // 1. Generate Identity
    const wallet = Keypair.generate();
    console.log(`   Testing with Wallet: ${wallet.publicKey.toBase58()}`);

    // 2. Derive X25519 Public Key from Wallet (Simulating the destination)
    // We do this by deriving the X25519 Private Key first, then Public
    const edSecret = wallet.secretKey.subarray(0, 32);
    const hash = createHash("sha512").update(edSecret).digest();
    const xSecret = hash.subarray(0, 32);
    xSecret[0] &= 248; xSecret[31] &= 127; xSecret[31] |= 64;

    const xPub = x25519.getPublicKey(xSecret);
    console.log("   Derived X25519 Recipient Key");

    // 3. Encrypt (Manually)
    const payload = { amount: "100.00", note: "Secret Payment" };
    console.log("   Encrypting payload manually...");

    const encrypted = await manualEncrypt(payload, xPub);
    console.log("✅ Encryption Successful");

    // 4. Decrypt (Using Service Logic)
    console.log("   Attempting Decryption with Service Fix...");
    const service = new ArciumService();
    // @ts-ignore
    service.initialized = true; // Bypass checks
    // @ts-ignore
    service.serverX25519Public = new Uint8Array(32); // Pass isAvailable() check

    try {
        const decrypted = await service.decryptTransaction(
            encrypted.encryptedData,
            encrypted.encryptionKey,
            wallet // Passing original Ed25519 wallet!
        );

        // 5. Assert
        assert.deepEqual(decrypted, payload, "Decrypted data mismatch!");
        console.log("✅ Decryption Matched Original Payload!");
        console.log("🎉 CRITICAL FIX VERIFIED: Ed25519 -> X25519 conversion is working.");

    } catch (error) {
        console.error("❌ Decryption Failed:", error);
        process.exit(1);
    }
}

runTest().catch(console.error);
