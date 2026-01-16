
/**
 * Manual Collection NFT Creator
 * 
 * Usage: npx tsx scripts/create-collection-manual.ts
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, createNft, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { keypairIdentity, generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import 'dotenv/config';

console.log("Script starting...");

// Mock DB for the script
const mockDb = {
    insert: () => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) })
};

async function main() {
    console.log("🛠️  Manual Collection NFT Creation Tool\n");

    // 1. Setup
    const rpcEndpoints = [
        process.env.SOLANA_RPC_URL,
        "https://api.devnet.solana.com",
        "https://devnet.genesysgo.net/",
    ].filter(Boolean) as string[];

    const privateKey = process.env.PAYER_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error("PAYER_PRIVATE_KEY is missing in .env");
    }

    let umi: any;
    let umiKeypair: any;
    let connectedRpc = "";

    // Try connecting to RPCs
    for (const rpc of rpcEndpoints) {
        try {
            console.log(`Trying RPC: ${rpc}...`);
            const u = createUmi(rpc).use(mplTokenMetadata());

            // Parse Key
            let keypair: Keypair;
            if (privateKey.startsWith('[')) {
                keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
            } else {
                keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
            }

            const uk = u.eddsa.createKeypairFromSecretKey(keypair.secretKey);
            u.use(keypairIdentity(uk));

            // Test connection
            await u.rpc.getBalance(uk.publicKey);

            umi = u;
            umiKeypair = uk;
            connectedRpc = rpc;
            console.log(`✅ Connected to ${rpc}`);
            break;
        } catch (e) {
            console.log(`❌ Failed ${rpc}: ${(e as Error).message}`);
        }
    }

    if (!umi) {
        throw new Error("Could not connect to any RPC endpoint");
    }

    console.log(`🔐 Wallet: ${umiKeypair.publicKey.toString()}`);


    // Balance Check
    const balance = await umi.rpc.getBalance(umiKeypair.publicKey);
    console.log(`💰 Balance: ${(Number(balance.basisPoints) / 1e9).toFixed(4)} SOL`);

    if (balance.basisPoints < BigInt(25000000)) {
        throw new Error("Insufficient funds (< 0.025 SOL)");
    }

    // 2. Metadata (Hardcoded for reliability)
    const collectionMetadata = {
        name: "INVOIX Genesis Collection",
        symbol: "INVX",
        uri: "https://api.solanainvoice.com/uploads/invoix-exclusive.jpg", // Simple placeholder URI for now or legitimate metadata
        sellerFeeBasisPoints: 500, // 5%
        isCollection: true,
    };

    // Note: In the real service, we upload to Arweave/API. 
    // Here we'll use a generic URI or try to upload if we had the service.
    // For manual restoration, let's use a static URI if possible, or just the image URI.
    // Ideally we want proper metadata. 

    // Let's create a minimal valid metadata JSON and upload it to a temporary spot? 
    // Or just use a data URI? Data URIs are too long for on-chain.
    // We will use a placeholder URI that points to the website for now, 
    // as fixing the record is more important than perfect metadata for the "container".
    const metadataUri = "https://invoix.railway.app/api/nft-metadata/genesis-collection";

    console.log("\n🚀 Creating Collection NFT...");
    console.log(`   Name: ${collectionMetadata.name}`);
    console.log(`   URI: ${metadataUri}`);

    const collectionMint = generateSigner(umi);
    console.log(`   Mint Address: ${collectionMint.publicKey.toString()}`);

    const tx = createNft(umi, {
        mint: collectionMint,
        name: collectionMetadata.name,
        symbol: collectionMetadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5, 2),
        isCollection: true,
        tokenStandard: TokenStandard.NonFungible,
        creators: [
            {
                address: umiKeypair.publicKey,
                verified: true,
                share: 100,
            }
        ],
    } as any);

    console.log("⏳ Sending transaction...");
    const sig = await tx.sendAndConfirm(umi);
    const sigString = bs58.encode(sig.signature);

    console.log(`\n✅ Success!`);
    console.log(`   Signature: ${sigString}`);
    console.log(`   Collection Mint: ${collectionMint.publicKey.toString()}`);

    console.log("\n📋 NEXT STEPS:");
    console.log("1. Add this variable to Railway:");
    console.log(`   GENESIS_COLLECTION_MINT=${collectionMint.publicKey.toString()}`);
    console.log("2. Restart the server.");
}

main().catch(err => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
});
