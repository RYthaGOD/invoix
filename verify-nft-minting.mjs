
const TEST_WALLET = '5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx';
const API_BASE = 'http://localhost:5000/api';

async function verifyNftMinting() {
    console.log('🧪 Verifying NFT Minting...\n');

    try {
        // 1. Create Business Profile (if not exists)
        console.log('1️⃣ Ensuring business profile exists...');
        await fetch(`${API_BASE}/business-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: TEST_WALLET,
                businessName: 'NFT Test Corp',
                businessEmail: 'nft@test.com',
                defaultCurrency: 'USDC',
            }),
        });

        // 2. Create Invoice
        console.log('2️⃣ Creating invoice with NFT minting...');
        const invoiceData = {
            invoiceeWalletAddress: 'AcmeWallet1111111111111111111111111111111',
            description: 'NFT Verification Invoice',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            currency: 'USDC',
            paymentTerms: 'Due on Receipt',
            lineItems: [
                { description: 'NFT Verification Item', quantity: 1, unitPrice: 100 },
            ],
            mintNFT: true // Explicitly requesting NFT
        };

        const response = await fetch(`${API_BASE}/invoices?wallet=${TEST_WALLET}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoiceData),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create invoice: ${error}`);
        }

        const data = await response.json();
        const invoice = data.invoice;

        console.log(`✅ Invoice created: ${invoice.invoiceNumber}`);
        console.log(`   ID: ${invoice.id}`);

        if (invoice.nftMint) {
            console.log(`\n🎉 SUCCESS! NFT Minted successfully.`);
            console.log(`   Mint Address: ${invoice.nftMint}`);
            console.log(`   Merkle Tree: ${invoice.nftMerkleTree}`);
            console.log(`   Leaf Index: ${invoice.nftLeafIndex}`);
            console.log(`   Minted At: ${invoice.nftMintedAt}`);
        } else {
            console.log(`\n⚠️  WARNING: Invoice created but NO NFT was minted.`);
            console.log(`   Possible reasons:`);
            console.log(`   - NFT service not initialized (check .env MERKLE_TREE_ADDRESS)`);
            console.log(`   - Server logs might show errors.`);
            console.log(`   - 'mintNFT' flag ignored.`);
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

verifyNftMinting();
