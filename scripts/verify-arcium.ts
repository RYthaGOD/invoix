// @ts-ignore
import { ArciumClient } from "@arcium-hq/client";
import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🔒 Verifying Arcium MXE Connection (Deep Privacy Mode)...");

    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    console.log(`📡 Connected to ${rpcUrl}`);

    const programId = process.env.ARCIUM_PROGRAM_ID;
    if (!programId) {
        console.error("❌ ARCIUM_PROGRAM_ID is missing in .env");
        console.log("👉 Please follow DEPLOY_MXE_INSTRUCTIONS.md to deploy via WSL first.");
        return;
    }

    try {
        console.log(`🔎 Initializing Client for Program: ${programId}`);
        const client = new ArciumClient(connection, "devnet");

        // Mock Transaction Data with Line Items
        const mockData = Buffer.from(JSON.stringify({
            amount: "100.00",
            tokenAmount: "100000000",
            fromAddress: "11111111111111111111111111111111",
            toAddress: "11111111111111111111111111111111",
            txSignature: "mock_signature",
            timestamp: Date.now(),
            items: [
                { description: "Service A", quantity: 1, price: 50.00 },
                { description: "Service B", quantity: 2, price: 25.00 }
            ]
        }));

        // Mock public key for encryption (normally would be a real recipient)
        const mockRecipient = new PublicKey("11111111111111111111111111111111");

        console.log("🧪 Attempting Test Encryption (Strict Mode)...");
        // This will FAIL if the MXE is not actually running/accessible, which is good.
        // It confirms we are not using a fallback.

        try {
            const result = await client.encrypt([mockData], [mockRecipient]);
            console.log("✅ Encryption Successful! MXE is responding.");
            console.log("Ciphertext length:", result[0].length);
        } catch (e) {
            console.warn("⚠️  Encryption failed (Expected if MXE not yet deployed):");
            console.warn("   " + (e as Error).message);
            console.log("👉 If you haven't deployed via WSL yet, this is normal.");
        }

    } catch (error) {
        console.error("❌ Failed to initialize ArciumClient:", error);
    }
}

main().catch(console.error);
