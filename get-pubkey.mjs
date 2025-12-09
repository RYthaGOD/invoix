import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const privateKey = '2kVgx6xbijWa1yVXD16A4iVb4CqM1XWCqX5dw5AjvYGvTqLkgGLmEhcRRF346vhHHUjFhnu1cakCyYLLN5U3jTiz';

try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    console.log('Public Key:', keypair.publicKey.toBase58());
} catch (error) {
    console.error('Error deriving public key:', error.message);
}
