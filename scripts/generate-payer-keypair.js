#!/usr/bin/env node
/**
 * Generate NFT Service Payer Keypair with Recovery Phrase
 * Run: node scripts/generate-payer-keypair.js
 */

import { Keypair } from '@solana/web3.js';
import bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

console.log('🔐 Generating NFT Service Payer Keypair\n');

// Generate mnemonic (12 words)
const mnemonic = bip39.generateMnemonic();

// Derive keypair from mnemonic
const seed = bip39.mnemonicToSeedSync(mnemonic, "");
const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
const keypair = Keypair.fromSeed(derivedSeed);

// Also generate a simple random keypair as alternative
const randomKeypair = Keypair.generate();

console.log('═══════════════════════════════════════════════════════════');
console.log('OPTION 1: Keypair with Recovery Phrase (RECOMMENDED)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔑 RECOVERY PHRASE (12 words):');
console.log('⚠️  SAVE THIS SECURELY - You can restore the wallet with this!\n');
console.log(mnemonic);
console.log('\n');

console.log('📍 Public Key (Wallet Address):');
console.log(keypair.publicKey.toBase58());
console.log('\n');

console.log('🔐 Private Key (for .env file):');
console.log('PAYER_PRIVATE_KEY=' + JSON.stringify(Array.from(keypair.secretKey)));
console.log('\n');

console.log('💰 Fund this wallet:');
console.log('https://faucet.solana.com/?address=' + keypair.publicKey.toBase58());
console.log('\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('OPTION 2: Simple Random Keypair (No Recovery Phrase)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📍 Public Key:');
console.log(randomKeypair.publicKey.toBase58());
console.log('\n');

console.log('🔐 Private Key (for .env file):');
console.log('PAYER_PRIVATE_KEY=' + JSON.stringify(Array.from(randomKeypair.secretKey)));
console.log('\n');

console.log('💰 Fund this wallet:');
console.log('https://faucet.solana.com/?address=' + randomKeypair.publicKey.toBase58());
console.log('\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('NEXT STEPS:');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('1. Copy the PAYER_PRIVATE_KEY line to your .env file');
console.log('2. Save the recovery phrase in a secure location (Option 1 only)');
console.log('3. Fund the wallet using the faucet URL');
console.log('4. Add SOLANA_RPC_URL=https://api.devnet.solana.com to .env');
console.log('5. Restart your server: npm run dev');
console.log('\n');

