
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, generateSigner } from "@metaplex-foundation/umi";
import { createTree } from "@metaplex-foundation/mpl-bubblegum";
import { db } from "../server/db";
import { systemSettings } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import 'dotenv/config';

// Load Server Keypair
// Note: This script assumes "server-wallet.json" exists or ARCIUM_PRIVATE_KEY is usable
// We'll try to use ARCIUM_PRIVATE_KEY since it's likely the server authority
const PRIVATE_KEY_BS58 = process.env.ARCIUM_PRIVATE_KEY || process.env.SERVER_PRIVATE_KEY;

if (!PRIVATE_KEY_BS58) {
    console.error("❌ No Private Key found in env (ARCIUM_PRIVATE_KEY or SERVER_PRIVATE_KEY)");
    process.exit(1);
}

// Config for NEW Tree (Production Scale)
const NEW_TREE_CONFIG = {
    maxDepth: 20, // 1,048,576 Compressed NFTs
    maxBufferSize: 64,
    canopyDepth: 11, // Optimized for rent vs composed size
    public: false,
};

async function rotateTree() {
    console.log("🔄 Rotating Merkle Tree to Production Scale (Depth 20)...");

    const rpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const umi = createUmi(rpc);

    // Setup Wallet
    const secretKey = new Uint8Array(require("bs58").decode(PRIVATE_KEY_BS58));
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(keypair));

    console.log(`   Wallet: ${keypair.publicKey.toString()}`);

    // Create New Tree Signer
    const merkleTreeSigner = generateSigner(umi);
    const merkleTreeParams = {
        merkleTree: merkleTreeSigner,
        maxDepth: NEW_TREE_CONFIG.maxDepth,
        maxBufferSize: NEW_TREE_CONFIG.maxBufferSize,
        canopyDepth: NEW_TREE_CONFIG.canopyDepth,
        public: NEW_TREE_CONFIG.public,
    };

    console.log(`   Creating new tree: ${merkleTreeSigner.publicKey.toString()}`);
    console.log(`   Config: Depth ${NEW_TREE_CONFIG.maxDepth}, Buffer ${NEW_TREE_CONFIG.maxBufferSize}, Canopy ${NEW_TREE_CONFIG.canopyDepth}`);
    console.log(`   (This costs ~1.1 SOL for rent)`);

    try {
        const builder = await createTree(umi, merkleTreeParams);
        await builder.sendAndConfirm(umi);

        console.log("✅ Tree Created On-Chain!");

        // Update Database
        const newAddress = merkleTreeSigner.publicKey.toString();

        // Check if exists manually to safely update or insert
        // (shared schema approach)
        const entries = await db.select().from(systemSettings).where(eq(systemSettings.key, "merkle_tree_address"));

        if (entries.length > 0) {
            await db.update(systemSettings)
                .set({
                    value: newAddress,
                    description: `Merkle Tree v2 (Depth 20) - Rotated ${new Date().toISOString()}`
                })
                .where(eq(systemSettings.key, "merkle_tree_address"));
            console.log("💾 Database Updated (Updated existing record)");
        } else {
            await db.insert(systemSettings).values({
                key: "merkle_tree_address",
                value: newAddress,
                description: `Merkle Tree v2 (Depth 20)`,
            });
            console.log("💾 Database Updated (Inserted new record)");
        }

        console.log("\n⚠️  ACTION REQUIRED:");
        console.log(`Please update your .env file locally/remote if you use MERKLE_TREE_ADDRESS override:`);
        console.log(`MERKLE_TREE_ADDRESS=${newAddress}`);

    } catch (error) {
        console.error("❌ Failed to create tree:", error);
    }

    process.exit(0);
}

rotateTree().catch(e => {
    console.error(e);
    process.exit(1);
});
