import * as dotenv from "dotenv";
import { getArciumService } from "../server/arcium-service";
import { Keypair } from "@solana/web3.js";

dotenv.config();

async function main() {
    console.log("🔒 Verifying Refactored Arcium Service (v0.5.2 Primitives)...");

    const service = getArciumService();

    // Initialize
    console.log("1. Initializing Service...");
    const initialized = await service.initialize();

    if (!initialized) {
        console.error("❌ Failed to initialize service.");
        return;
    }
    console.log("✅ Service Initialized.");

    // Mock Data
    const mockData = {
        amount: "100.00",
        tokenAmount: "100000000",
        fromAddress: "11111111111111111111111111111111",
        toAddress: "11111111111111111111111111111111",
        txSignature: "mock_signature",
        timestamp: Date.now(),
        items: [{ description: "Test Item", quantity: 1, price: 100 }]
    };

    // Mock Recipient (Devnet dummy)
    const allowedParties = ["11111111111111111111111111111111"];

    console.log("2. Testing Encryption (Client-Side)...");
    try {
        const result = await service.encryptTransaction(mockData, allowedParties);
        console.log("✅ Encryption Successful!");
        console.log("   Ciphertext Length:", result.encryptedData.length);
        console.log("   Ephemeral Key:", result.encryptionKey);

        console.log("ℹ️  Decryption skipped (Requires MXE Private Key).");
        console.log("🚀 Refactoring Verified Successfully.");

    } catch (e) {
        console.error("❌ Encryption Failed:", e);
    }
}

main().catch(console.error);
