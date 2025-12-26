/**
 * Create Merkle Tree for NFT Minting (Devnet)
 * 
 * This script creates a new Merkle tree on devnet for compressed NFT minting.
 * The tree address can then be set in Railway environment variables.
 * 
 * Run with: npx tsx scripts/create-merkle-tree.ts
 */

import 'dotenv/config';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { loadKeypairFromPrivateKey } from '../server/arcium-service';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createTree } from '@metaplex-foundation/mpl-bubblegum';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';

// Merkle tree configuration (same as NFT service defaults)
const TREE_CONFIG = {
    maxDepth: 14,        // Supports 16,384 NFTs
    maxBufferSize: 64,   // Buffer size for concurrent mints
    canopyDepth: 11,     // Cheaper transfers (reduces proof size)
};

async function createMerkleTree() {
    console.log('🌳 Creating New Merkle Tree on Devnet\n');
    console.log('='.repeat(60));

    // 1. Load payer keypair
    console.log('\n🔑 Loading Payer Keypair...');
    if (!process.env.PAYER_PRIVATE_KEY) {
        console.error('❌ PAYER_PRIVATE_KEY not set in .env');
        process.exit(1);
    }

    const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
    console.log(`   Payer: ${payerKeypair.publicKey.toBase58()}`);

    // 2. Check connection and balance
    console.log('\n🌐 Connecting to Devnet...');
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    try {
        const version = await connection.getVersion();
        console.log(`   ✅ Connected to Solana ${version['solana-core']}`);
    } catch (error: any) {
        console.error(`   ❌ Connection failed: ${error.message}`);
        process.exit(1);
    }

    console.log('\n💰 Checking Wallet Balance...');
    const balance = await connection.getBalance(payerKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`   Balance: ${solBalance.toFixed(4)} SOL`);

    if (solBalance < 0.01) {
        console.error('\n❌ Insufficient balance for tree creation');
        console.error(`   Required: ~0.01 SOL`);
        console.error(`   Current: ${solBalance.toFixed(4)} SOL`);
        console.error('\n💡 Fund your wallet:');
        console.error(`   solana airdrop 0.1 ${payerKeypair.publicKey.toBase58()} --url devnet`);
        process.exit(1);
    }

    // 3. Initialize Umi
    console.log('\n⚙️  Initializing Metaplex Umi...');
    const umi = createUmi(rpcUrl).use(mplTokenMetadata());

    // Convert Solana keypair to Umi format
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payerKeypair.secretKey);
    umi.use(keypairIdentity(umiKeypair));
    console.log('   ✅ Umi initialized');

    // 4. Create Merkle Tree
    console.log('\n🌳 Creating Merkle Tree...');
    console.log(`   Max Depth: ${TREE_CONFIG.maxDepth} (supports ${Math.pow(2, TREE_CONFIG.maxDepth).toLocaleString()} NFTs)`);
    console.log(`   Max Buffer Size: ${TREE_CONFIG.maxBufferSize}`);
    console.log(`   Canopy Depth: ${TREE_CONFIG.canopyDepth}`);
    console.log('\n   ⏳ Submitting transaction...');

    try {
        const merkleTreeSigner = generateSigner(umi);

        const createTreeIx = await createTree(umi, {
            merkleTree: merkleTreeSigner,
            maxDepth: TREE_CONFIG.maxDepth,
            maxBufferSize: TREE_CONFIG.maxBufferSize,
            canopyDepth: TREE_CONFIG.canopyDepth,
        });

        const signature = await createTreeIx.sendAndConfirm(umi);

        const treeAddress = merkleTreeSigner.publicKey.toString();

        console.log('\n' + '='.repeat(60));
        console.log('✅ SUCCESS! Merkle Tree Created\n');
        console.log(`🌳 Tree Address: ${treeAddress}`);
        console.log(`📝 Transaction: ${signature}`);
        console.log('='.repeat(60));

        // 5. Provide next steps
        console.log('\n📋 Next Steps:\n');
        console.log('1. Update Railway environment variable:');
        console.log(`   railway variables --set MERKLE_TREE_ADDRESS="${treeAddress}"`);
        console.log('\n2. Or add to your .env file:');
        console.log(`   MERKLE_TREE_ADDRESS=${treeAddress}`);
        console.log('\n3. Verify on Solana Explorer:');
        console.log(`   https://explorer.solana.com/address/${treeAddress}?cluster=devnet`);
        console.log('\n4. Redeploy your service to use the new tree');
        console.log('\n💡 The tree address will also be automatically saved to the database on next deployment.');

        // 6. Save to file for reference
        const fs = await import('fs');
        const outputFile = 'merkle-tree-devnet.txt';
        fs.writeFileSync(outputFile, `MERKLE_TREE_ADDRESS=${treeAddress}\nTransaction: ${signature}\nCreated: ${new Date().toISOString()}\n`);
        console.log(`\n💾 Tree details saved to: ${outputFile}`);

    } catch (error: any) {
        console.error('\n❌ Failed to create Merkle tree:');
        console.error(`   ${error.message}`);
        if (error.logs) {
            console.error('\n📜 Transaction logs:');
            error.logs.forEach((log: string) => console.error(`   ${log}`));
        }
        process.exit(1);
    }

    console.log('\n✅ Merkle tree creation complete!\n');
}

// Run the script
createMerkleTree()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
