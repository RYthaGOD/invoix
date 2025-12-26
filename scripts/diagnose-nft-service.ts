/**
 * NFT Service Diagnostic Script
 * 
 * Checks the health and readiness of the NFT minting service
 * Run with: npx tsx scripts/diagnose-nft-service.ts
 */

import 'dotenv/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { loadKeypairFromPrivateKey } from '../server/arcium-service';
import { initializeNFTService, getInvoiceNFTService } from '../server/nft-service';

const REQUIRED_SOL_BALANCE = 0.01;

async function diagnoseNFTService() {
    console.log('🔍 NFT Service Diagnostic Report\n');
    console.log('='.repeat(60));

    // 1. Check Environment Variables
    console.log('\n📋 Environment Configuration:');
    const requiredVars = [
        'PAYER_PRIVATE_KEY',
        'MERKLE_TREE_ADDRESS',
        'SOLANA_RPC_URL',
        'ENABLE_NFT_MINTING'
    ];

    let configValid = true;
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (value) {
            const displayValue = varName === 'PAYER_PRIVATE_KEY'
                ? `${value.substring(0, 20)}...`
                : value;
            console.log(`   ✅ ${varName}: ${displayValue}`);
        } else {
            console.log(`   ❌ ${varName}: NOT SET`);
            configValid = false;
        }
    }

    if (!configValid) {
        console.log('\n❌ Missing required environment variables. Cannot proceed.');
        process.exit(1);
    }

    // 2. Load Payer Keypair
    console.log('\n🔑 Payer Wallet:');
    let payerKeypair;
    try {
        payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY!);
        const publicKey = payerKeypair.publicKey.toBase58();
        console.log(`   ✅ Loaded keypair: ${publicKey}`);
    } catch (error: any) {
        console.log(`   ❌ Failed to load keypair: ${error.message}`);
        process.exit(1);
    }

    // 3. Check RPC Connection
    console.log('\n🌐 RPC Connection:');
    const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
    try {
        const version = await connection.getVersion();
        console.log(`   ✅ Connected to Solana ${version['solana-core']}`);
        console.log(`   📍 Cluster: ${process.env.SOLANA_NETWORK || 'unknown'}`);
    } catch (error: any) {
        console.log(`   ❌ RPC connection failed: ${error.message}`);
        process.exit(1);
    }

    // 4. Check Wallet Balance
    console.log('\n💰 Wallet Balance:');
    try {
        const balance = await connection.getBalance(payerKeypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        console.log(`   Balance: ${solBalance.toFixed(4)} SOL`);

        if (solBalance < REQUIRED_SOL_BALANCE) {
            console.log(`   ⚠️  WARNING: Balance below recommended minimum (${REQUIRED_SOL_BALANCE} SOL)`);
            console.log(`   💡 Fund wallet with:`);
            console.log(`      solana airdrop 0.1 ${payerKeypair.publicKey.toBase58()} --url ${process.env.SOLANA_RPC_URL}`);
        } else {
            console.log(`   ✅ Sufficient balance for NFT operations`);
        }
    } catch (error: any) {
        console.log(`   ❌ Failed to check balance: ${error.message}`);
    }

    // 5. Validate Merkle Tree
    console.log('\n🌳 Merkle Tree:');
    if (process.env.MERKLE_TREE_ADDRESS) {
        try {
            const treeAddress = new PublicKey(process.env.MERKLE_TREE_ADDRESS);
            const accountInfo = await connection.getAccountInfo(treeAddress);

            if (accountInfo) {
                console.log(`   ✅ Tree exists: ${treeAddress.toBase58()}`);
                console.log(`   📊 Account size: ${accountInfo.data.length} bytes`);
                console.log(`   👤 Owner: ${accountInfo.owner.toBase58()}`);
            } else {
                console.log(`   ❌ Tree not found on-chain: ${treeAddress.toBase58()}`);
                console.log(`   💡 The tree may need to be recreated for this network`);
            }
        } catch (error: any) {
            console.log(`   ❌ Invalid tree address: ${error.message}`);
        }
    } else {
        console.log(`   ℹ️  No tree address set - will create new tree on initialization`);
    }

    // 6. Test NFT Service Initialization
    console.log('\n🚀 NFT Service Initialization:');
    try {
        console.log('   Initializing service...');
        const initResult = await initializeNFTService(payerKeypair);

        if (initResult) {
            console.log('   ✅ Service initialized successfully');

            const nftService = getInvoiceNFTService();
            if (nftService.isReady()) {
                console.log('   ✅ Service is ready for minting');
                console.log(`   🌳 Active Merkle Tree: ${nftService.getMerkleTree()}`);

                const collectionMint = nftService.getCollectionMint();
                if (collectionMint) {
                    console.log(`   🎨 Collection NFT: ${collectionMint}`);
                }
            } else {
                console.log('   ⚠️  Service initialized but not ready');
            }
        } else {
            console.log('   ❌ Service initialization failed');
            console.log('   💡 Check the logs above for specific errors');
        }
    } catch (error: any) {
        console.log(`   ❌ Initialization error: ${error.message}`);
        if (error.stack) {
            console.log('\n📜 Stack trace:');
            console.log(error.stack);
        }
    }

    // 7. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Diagnostic Summary:');

    const nftService = getInvoiceNFTService();
    if (nftService.isReady()) {
        console.log('   ✅ NFT Service is OPERATIONAL');
        console.log('   ✅ Invoice NFTs: Ready to mint');
        console.log('   ✅ Receipt NFTs: Ready to mint');
    } else {
        console.log('   ❌ NFT Service is NOT OPERATIONAL');
        console.log('   ⚠️  Invoice NFTs: Disabled');
        console.log('   ⚠️  Receipt NFTs: Disabled');
        console.log('\n💡 Recommended Actions:');
        console.log('   1. Ensure wallet has sufficient SOL balance');
        console.log('   2. Verify Merkle tree exists on the target network');
        console.log('   3. Check RPC endpoint is accessible and not rate-limited');
        console.log('   4. Review server logs for detailed error messages');
    }

    console.log('='.repeat(60) + '\n');
}

// Run diagnostics
diagnoseNFTService()
    .then(() => {
        console.log('✅ Diagnostic complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Diagnostic failed:', error);
        process.exit(1);
    });
