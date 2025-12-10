import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// SECURITY: Never commit private keys to version control!
// This script expects a private key via environment variable only.
// 
// IMPORTANT: Do NOT pass private keys as command-line arguments!
// Command-line arguments are visible in process lists and shell history.
// 
// Usage: PRIVATE_KEY=<base58-private-key> node get-pubkey.mjs
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
    console.error('Error: No private key provided');
    console.error('Usage: PRIVATE_KEY=<base58-private-key> node get-pubkey.mjs');
    console.error('');
    console.error('⚠️  WARNING: Do NOT use command-line arguments for private keys!');
    console.error('   They are visible in process lists and shell history.');
    process.exit(1);
}

try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    console.log('Public Key:', keypair.publicKey.toBase58());
} catch (error) {
    console.error('Error deriving public key:', error.message);
    process.exit(1);
}
