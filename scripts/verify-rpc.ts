
import axios from "axios";
import dotenv from "dotenv";
import { Connection } from "@solana/web3.js";

// Load env vars
dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL;

if (!RPC_URL) {
    console.error("❌ Error: SOLANA_RPC_URL is not defined in .env");
    process.exit(1);
}

console.log(`🔍 Verifying RPC URL: ${RPC_URL.slice(0, 20)}...`);

async function verifyDAS() {
    try {
        // 1. Basic Connection Check
        const connection = new Connection(RPC_URL!);
        const version = await connection.getVersion();
        console.log(`✅ Basic RPC Connection Successful (Solana Version: ${version["solana-core"]})`);

        // 2. DAS Method Check: getAsset
        // We try to fetch a known valid Mainnet or Devnet asset, or just check if the method exists.
        // Since we don't know the network for sure, we'll try a generic "getAsset" with a dummy ID
        // expecting a "Asset not found" error, NOT a "Method not found" error.

        // Using a random ID (will fail validation or not found, but checks method existence)
        const dummyAssetId = "11111111111111111111111111111111";

        console.log("Testing DAS 'getAsset' method...");

        const response = await axios.post(RPC_URL!, {
            jsonrpc: "2.0",
            id: "test-das",
            method: "getAsset",
            params: {
                id: dummyAssetId
            }
        });

        if (response.data.error) {
            const msg = response.data.error.message;
            // If error is "Method not found", then DAS is NOT supported
            if (msg.toLowerCase().includes("method not found")) {
                console.error("❌ DAS VERIFICATION FAILED: 'getAsset' method is not supported by this RPC.");
                console.error("   Please ensure your Triton RPC has the DAS/Read API plugin enabled.");
                process.exit(1);
            }

            // "Asset not found" or "Invalid param" means the method IS supported
            console.log(`✅ DAS 'getAsset' is supported (Server responded: ${msg})`);
        } else {
            console.log("✅ DAS 'getAsset' returned a result.");
        }

        // 3. DAS Method Check: getAssetProof
        console.log("Testing DAS 'getAssetProof' method...");
        const proofResponse = await axios.post(RPC_URL!, {
            jsonrpc: "2.0",
            id: "test-proof",
            method: "getAssetProof",
            params: {
                id: dummyAssetId
            }
        });

        if (proofResponse.data.error && proofResponse.data.error.message.toLowerCase().includes("method not found")) {
            console.error("❌ DAS VERIFICATION FAILED: 'getAssetProof' method is not supported.");
            process.exit(1);
        }
        console.log("✅ DAS 'getAssetProof' is supported.");

        console.log("\n🎉 SUCCESS: This RPC URL supports the Digital Asset Standard (DAS) required for Invoix cNFTs.");

    } catch (error: any) {
        console.error("\n❌ RPC Verification Failed:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", JSON.stringify(error.response.data));
        }
        process.exit(1);
    }
}

verifyDAS();
