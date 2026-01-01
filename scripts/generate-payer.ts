import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

console.log('🔐 Generating Invoix "Glass Citadel" Admin Key\n');

try {
    // Generate simple keypair
    const keypair = Keypair.generate();
    const secretKeyJSON = JSON.stringify(Array.from(keypair.secretKey));
    const publicKey = keypair.publicKey.toBase58();

    console.log('✅ Keypair Generated Successfully!');
    console.log('---------------------------------------------------------');
    console.log('📍 Public Address (Fund this):', publicKey);
    console.log('---------------------------------------------------------');
    console.log('\n👇 ADD THIS TO YOUR .env FILE:');
    console.log('PAYER_PRIVATE_KEY=' + secretKeyJSON);
    console.log('ENABLE_NFT_MINTING=true');
    console.log('\n---------------------------------------------------------');

    // Auto-create a snippet file for easy copying
    const snippetPath = path.resolve(process.cwd(), '.env.snippet');
    const snippetContent = `\n# Invoix Glass Citadel Keys\nPAYER_PRIVATE_KEY=${secretKeyJSON}\nENABLE_NFT_MINTING=true\n`;
    fs.writeFileSync(snippetPath, snippetContent);
    console.log(`📄 Saved credentials to: ${snippetPath}`);
    console.log('💡 Tip: You can append this to your .env using: cat .env.snippet >> .env');

} catch (error) {
    console.error('❌ Failed to generate keypair:', error);
}
