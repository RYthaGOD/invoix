import { Keypair } from '@solana/web3.js';
import fs from 'fs';

console.log('🔐 Generating NFT Service Payer Keypair\n');

// Generate a random keypair
const keypair = Keypair.generate();
const secretArray = Array.from(keypair.secretKey);
const publicKey = keypair.publicKey.toBase58();

console.log('═══════════════════════════════════════════════════════════');
console.log('NFT SERVICE PAYER KEYPAIR GENERATED');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📍 Public Key (Wallet Address):');
console.log(publicKey);
console.log('\n');

console.log('🔐 Private Key (Secret Key - KEEP SECURE!):');
console.log('⚠️  Save this in a secure location - you cannot recover it!\n');
console.log(JSON.stringify(secretArray));
console.log('\n');

console.log('📝 For .env file, add this line:');
console.log(`PAYER_PRIVATE_KEY=${JSON.stringify(secretArray)}`);
console.log('\n');

console.log('💰 Fund this wallet with devnet SOL:');
console.log(`https://faucet.solana.com/?address=${publicKey}`);
console.log('\n');

console.log('Or use Solana CLI:');
console.log(`solana airdrop 1 ${publicKey} --url devnet`);
console.log('\n');

// Save to a secure file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `payer-keypair-${timestamp}.json`;
const keypairData = {
    publicKey,
    secretKey: secretArray,
    network: 'devnet',
    purpose: 'NFT Service Payer',
    createdAt: new Date().toISOString(),
    faucetUrl: `https://faucet.solana.com/?address=${publicKey}`,
    envVariable: `PAYER_PRIVATE_KEY=${JSON.stringify(secretArray)}`
};

fs.writeFileSync(filename, JSON.stringify(keypairData, null, 2));

console.log('═══════════════════════════════════════════════════════════');
console.log('KEYPAIR SAVED');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`✅ Keypair details saved to: ${filename}`);
console.log('⚠️  KEEP THIS FILE SECURE - Delete after copying to .env\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('NEXT STEPS:');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('1. Copy the PAYER_PRIVATE_KEY line to your .env file');
console.log('2. Fund the wallet using the faucet URL above');
console.log('3. Ensure SOLANA_RPC_URL=https://api.devnet.solana.com in .env');
console.log('4. Restart your server: npm run dev');
console.log('5. DELETE the keypair JSON file after setup\n');
