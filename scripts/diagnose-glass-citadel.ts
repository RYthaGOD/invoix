/**
 * Glass Citadel Diagnostics Script
 * 
 * Checks the status of the NFT infrastructure and attempts to fix issues.
 * Run with: npx tsx scripts/diagnose-glass-citadel.ts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import 'dotenv/config';

async function main() {
    console.log('\n🏰 Glass Citadel Diagnostics\n');
    console.log('='.repeat(50));

    // 1. Check environment
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
    const merkleTreeAddress = process.env.MERKLE_TREE_ADDRESS;
    const nftMintingEnabled = process.env.ENABLE_NFT_MINTING === 'true';

    console.log(`\n📡 RPC URL: ${rpcUrl}`);
    console.log(`🎯 NFT Minting Enabled: ${nftMintingEnabled}`);
    console.log(`🌳 Merkle Tree (env): ${merkleTreeAddress || 'Not set (will use DB)'}`);

    if (!payerPrivateKey) {
        console.error('\n❌ PAYER_PRIVATE_KEY not set in environment');
        console.log('   This is required for Glass Citadel operations.');
        process.exit(1);
    }

    // 2. Parse and validate payer keypair
    let payerKeypair: Keypair;
    try {
        // Handle both JSON array and Base58 formats
        if (payerPrivateKey.startsWith('[')) {
            const secretKey = Uint8Array.from(JSON.parse(payerPrivateKey));
            payerKeypair = Keypair.fromSecretKey(secretKey);
        } else {
            const secretKey = bs58.decode(payerPrivateKey);
            payerKeypair = Keypair.fromSecretKey(secretKey);
        }
        console.log(`\n🔐 Payer Wallet: ${payerKeypair.publicKey.toBase58()}`);
    } catch (error) {
        console.error('\n❌ Failed to parse PAYER_PRIVATE_KEY');
        console.error('   Must be a JSON array [1,2,3...] or Base58 encoded string');
        process.exit(1);
    }

    // 3. Check wallet balance
    const connection = new Connection(rpcUrl, 'confirmed');
    const balance = await connection.getBalance(payerKeypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    console.log(`💰 Wallet Balance: ${balanceSOL.toFixed(4)} SOL`);

    // Cost estimates
    const MERKLE_TREE_COST = 0.04;  // ~0.03-0.05 SOL for a 2^20 tree
    const COLLECTION_NFT_COST = 0.02;  // ~0.02 SOL for standard NFT
    const MIN_RECOMMENDED = MERKLE_TREE_COST + COLLECTION_NFT_COST + 0.02; // Buffer

    if (balanceSOL < MIN_RECOMMENDED) {
        console.log(`\n⚠️  LOW BALANCE WARNING`);
        console.log(`   Recommended minimum: ${MIN_RECOMMENDED.toFixed(2)} SOL`);
        console.log(`   Current balance: ${balanceSOL.toFixed(4)} SOL`);
        console.log(`\n   💡 Fund this wallet with devnet SOL:`);
        console.log(`      solana airdrop 2 ${payerKeypair.publicKey.toBase58()} --url devnet`);
    } else {
        console.log(`✅ Balance OK (minimum ${MIN_RECOMMENDED.toFixed(2)} SOL recommended)`);
    }

    // 4. Check if merkle tree exists on-chain
    if (merkleTreeAddress) {
        try {
            const treeInfo = await connection.getAccountInfo(new PublicKey(merkleTreeAddress));
            if (treeInfo) {
                console.log(`\n🌳 Merkle Tree: ${merkleTreeAddress}`);
                console.log(`   ✅ Exists on-chain (${treeInfo.data.length} bytes)`);
            } else {
                console.log(`\n🌳 Merkle Tree: ${merkleTreeAddress}`);
                console.log(`   ❌ NOT FOUND on current network!`);
            }
        } catch (error) {
            console.log(`\n🌳 Merkle Tree: ${merkleTreeAddress}`);
            console.log(`   ❌ Error checking: ${error}`);
        }
    }

    // 5. Check database for Genesis Collection
    console.log('\n📊 Database Check:');
    try {
        // Dynamic import to avoid module resolution issues
        const { db } = await import('../server/db');
        const { systemSettings } = await import('../shared/invoice-schema');
        const { eq } = await import('drizzle-orm');

        const storedTree = await db.select().from(systemSettings)
            .where(eq(systemSettings.key, 'merkle_tree_address')).limit(1);

        const storedCollection = await db.select().from(systemSettings)
            .where(eq(systemSettings.key, 'genesis_collection_mint')).limit(1);

        console.log(`   Merkle Tree (DB): ${storedTree[0]?.value || 'Not set'}`);
        console.log(`   Genesis Collection (DB): ${storedCollection[0]?.value || 'Not set'}`);

        if (storedCollection[0]?.value) {
            // Verify it exists on-chain
            try {
                const collectionInfo = await connection.getAccountInfo(new PublicKey(storedCollection[0].value));
                if (collectionInfo) {
                    console.log(`   ✅ Collection exists on-chain`);
                } else {
                    console.log(`   ❌ Collection NOT FOUND on current network - needs recreation!`);
                }
            } catch {
                console.log(`   ❌ Could not verify collection on-chain`);
            }
        } else {
            console.log(`   ⚠️  No Genesis Collection in DB - will be created on next init`);
        }
    } catch (error: any) {
        console.log(`   ⚠️  Could not connect to database: ${error.message}`);
        console.log(`   (This is normal when running locally without DB connection)`);
    }

    // 6. Summary and recommendations
    console.log('\n' + '='.repeat(50));
    console.log('📋 SUMMARY & RECOMMENDATIONS\n');

    if (balanceSOL < 0.02) {
        console.log('⛔ CRITICAL: Wallet has insufficient SOL for Collection NFT creation.');
        console.log('   The Collection NFT (standard Metaplex NFT) costs ~0.02 SOL.');
        console.log('\n   FIX: Airdrop devnet SOL to the payer wallet:');
        console.log(`   solana airdrop 2 ${payerKeypair.publicKey.toBase58()} --url devnet`);
    } else if (balanceSOL < MIN_RECOMMENDED) {
        console.log('⚠️  WARNING: Balance is low. Consider adding more SOL for headroom.');
        console.log('\n   RECOMMENDED: Airdrop additional SOL:');
        console.log(`   solana airdrop 2 ${payerKeypair.publicKey.toBase58()} --url devnet`);
    } else {
        console.log('✅ Wallet balance appears sufficient.');
        console.log('\n   If Glass Citadel is still degraded, try restarting the server');
        console.log('   or check Railway logs for specific errors during Collection creation.');
    }

    console.log('\n   To force re-initialization, you can:');
    console.log('   1. Restart the Railway deployment');
    console.log('   2. Wait for the 60-second self-healing cycle');
    console.log('   3. Or set GENESIS_COLLECTION_MINT env var to a valid collection address');

    console.log('\n' + '='.repeat(50) + '\n');
}

main().catch((err) => {
    console.error('Diagnostic failed:', err);
    process.exit(1);
});
