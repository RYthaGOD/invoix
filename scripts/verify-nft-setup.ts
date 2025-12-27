
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { db } from "../server/db";
import { systemSettings } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import 'dotenv/config';

async function main() {
    console.log("🎨 Verifying NFT Infrastructure...");

    const rpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const umi = createUmi(rpc);

    console.log(`   RPC: ${rpc}`);

    // 1. Check DB for Config
    console.log("\n1. Database Configuration:");

    // Configs to key
    const configs = {
        "Merkle Tree": "merkle_tree_address",
        "Genesis Collection": "genesis_collection_mint",
    };

    for (const [label, key] of Object.entries(configs)) {
        const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
        const val = result[0]?.value;

        console.log(`   ${label}: ${val || "❌ Not Found"}`);

        if (val) {
            // Verify on-chain
            try {
                const exists = await umi.rpc.accountExists(publicKey(val));
                console.log(`      ↳ On-Chain: ${exists ? "✅ Exists" : "❌ Account Not Found (Invalid)"}`);
            } catch (e) {
                console.log(`      ↳ On-Chain: ❓ Error checking (${e.message})`);
            }
        }
    }

    // 2. Check Wallet
    // Only if we have a keypair loaded (usually via Env or file, straightforward server check)
    // We'll skip deep wallet check here to avoid leaking keys, but we can check balance if we knew public key? 
    // Usually server logs it.

    console.log("\n✅ Verification Complete.");
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
