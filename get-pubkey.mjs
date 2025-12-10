import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// SECURITY: Never commit private keys to version control!
// This script expects a private key as a command-line argument or environment variable.
const privateKey = process.argv[2] || process.env.PRIVATE_KEY;

if (!privateKey) {
    console.error('Error: No private key provided');
    console.error('Usage: node get-pubkey.mjs <base58-private-key>');
    console.error('   or: PRIVATE_KEY=<base58-private-key> node get-pubkey.mjs');
    process.exit(1);
}

try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    console.log('Public Key:', keypair.publicKey.toBase58());
} catch (error) {
    console.error('Error deriving public key:', error.message);
    process.exit(1);
}
