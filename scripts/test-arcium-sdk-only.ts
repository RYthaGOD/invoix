/**
 * Test script for Arcium SDK-Only Encryption
 * Verifies the refactored service works without on-chain MXE
 */

import { Keypair } from "@solana/web3.js";
import { ArciumService } from "../server/arcium-service.js";

console.log("🧪 Testing Arcium SDK-Only Encryption...\n");

async function runTest() {
    // 1. Initialize the service
    const service = new ArciumService();
    const testKeypair = Keypair.generate();

    console.log("1️⃣ Initializing ArciumService with test keypair...");
    const initialized = await service.initialize(testKeypair);

    if (!initialized) {
        console.error("❌ Failed to initialize service!");
        process.exit(1);
    }
    console.log("   ✅ Service initialized successfully\n");

    // 2. Check availability
    console.log("2️⃣ Checking service availability...");
    if (!service.isAvailable()) {
        console.error("❌ Service not available!");
        process.exit(1);
    }
    console.log("   ✅ Service is available\n");

    // 3. Test encryption
    console.log("3️⃣ Testing encryption...");
    const testData = {
        amount: "1500.00",
        tokenAmount: "1500",
        fromAddress: "SENDER_WALLET_ABC123",
        toAddress: "RECEIVER_WALLET_XYZ789",
        txSignature: "test_signature_12345",
        timestamp: Date.now(),
        items: [
            { description: "Consulting Services Q4", quantity: 1, price: 1500 },
        ],
    };

    const encrypted = await service.encryptTransaction(testData, []);

    if (!encrypted.success) {
        console.error("❌ Encryption failed!");
        process.exit(1);
    }
    console.log("   ✅ Encryption successful");
    console.log("   📦 Encrypted data length:", encrypted.encryptedData.length, "chars");
    console.log("   🔑 Encryption key (ephemeral pubkey):", encrypted.encryptionKey.substring(0, 20) + "...\n");

    // 4. Test decryption
    console.log("4️⃣ Testing decryption...");
    const decrypted = await service.decryptTransaction(
        encrypted.encryptedData,
        encrypted.encryptionKey
    );

    if (!decrypted) {
        console.error("❌ Decryption failed!");
        process.exit(1);
    }
    console.log("   ✅ Decryption successful\n");

    // 5. Verify data integrity
    console.log("5️⃣ Verifying data integrity...");
    const originalStr = JSON.stringify(testData);
    const decryptedStr = JSON.stringify(decrypted);

    if (originalStr === decryptedStr) {
        console.log("   ✅ Data integrity verified - decrypted matches original!\n");
    } else {
        console.error("❌ Data integrity FAILED!");
        console.log("   Original:", originalStr.substring(0, 100));
        console.log("   Decrypted:", decryptedStr.substring(0, 100));
        process.exit(1);
    }

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ALL TESTS PASSED!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✅ Arcium SDK-Only Encryption is working correctly.");
    console.log("   - Uses x25519 ECDH for key exchange");
    console.log("   - Uses RescueCipher for symmetric encryption");
    console.log("   - No on-chain MXE account required!\n");
}

runTest().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
