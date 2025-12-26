#!/usr/bin/env node
/**
 * NFT Service Diagnostic Script
 * Checks NFT service configuration and initialization status
 */

import 'dotenv/config';
import { getInvoiceNFTService } from './server/nft-service.js';
import { loadKeypairFromPrivateKey } from './server/arcium-service.js';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function diagnose() {
    console.log('🔍 NFT Service Diagnostic\n');

    // 1. Check Environment Variables
    console.log('📋 Environment Configuration:');
    console.log('  PAYER_PRIVATE_KEY:', process.env.PAYER_PRIVATE_KEY ? '✅ SET' : '❌ NOT SET');
    console.log('  SOLANA_RPC_URL:', process.env.SOLANA_RPC_URL || '❌ NOT SET');
    console.log('  MERKLE_TREE_ADDRESS:', process.env.MERKLE_TREE_ADDRESS || '(will auto-create)');
    console.log('  GENESIS_COLLECTION_MINT:', process.env.GENESIS_COLLECTION_MINT || '(will auto-create)');
    console.log('');

    if (!process.env.PAYER_PRIVATE_KEY) {
        console.error('❌ PAYER_PRIVATE_KEY not configured. NFT service cannot initialize.');
        console.log('\n💡 Run this to generate a keypair:');
        console.log('   node -e "const {Keypair} = require(\'@solana/web3.js\'); const kp = Keypair.generate(); console.log(\'PAYER_PRIVATE_KEY=\' + JSON.stringify(Array.from(kp.secretKey))); console.log(\'Public Key:\', kp.publicKey.toBase58());"');
        process.exit(1);
    }

    if (!process.env.SOLANA_RPC_URL) {
        console.error('❌ SOLANA_RPC_URL not configured.');
        process.exit(1);
    }

    // 2. Check Payer Wallet Balance
    try {
        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
        const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

        console.log('💰 Payer Wallet:');
        console.log('  Address:', payerKeypair.publicKey.toBase58());

        const balance = await connection.getBalance(payerKeypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        console.log('  Balance:', solBalance, 'SOL');

        if (solBalance < 0.01) {
            console.warn('  ⚠️  Low balance! Need at least 0.01 SOL to create merkle tree.');
            console.log('  💡 Fund at: https://faucet.solana.com/?address=' + payerKeypair.publicKey.toBase58());
        } else {
            console.log('  ✅ Sufficient balance');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Failed to check payer wallet:', error.message);
        process.exit(1);
    }

    // 3. Initialize NFT Service
    try {
        console.log('🎨 Initializing NFT Service...');
        const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
        const nftService = getInvoiceNFTService();

        const initialized = await nftService.initialize(payerKeypair);

        if (initialized) {
            console.log('✅ NFT Service initialized successfully!');
            console.log('');
            console.log('📊 Service Status:');
            console.log('  Ready:', nftService.isReady());
            console.log('  Merkle Tree:', nftService.getMerkleTree());
            console.log('  Collection Mint:', nftService.getCollectionMint() || '(none)');
        } else {
            console.error('❌ NFT Service initialization failed');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ NFT Service Error:', error.message);
        console.error(error);
        process.exit(1);
    }

    console.log('\n✅ All checks passed! NFT minting should work.');
}

diagnose().catch(console.error);
