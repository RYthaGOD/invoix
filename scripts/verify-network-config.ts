
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('--- Network Configuration Verification ---');
console.log(`SOLANA_NETWORK: ${process.env.SOLANA_NETWORK || 'undefined'} (Should be 'devnet' for Devnet)`);
console.log(`SOLANA_RPC_URL: ${process.env.SOLANA_RPC_URL || 'undefined'}`);

const isDevnet = process.env.SOLANA_NETWORK === 'devnet';
console.log(`Is Devnet?: ${isDevnet}`);

if (!isDevnet) {
    console.warn('⚠️  WARNING: SOLANA_NETWORK is not set to "devnet". Please update your .env file.');
} else {
    console.log('✅ Configuration looks correct for Devnet deployment.');
}
