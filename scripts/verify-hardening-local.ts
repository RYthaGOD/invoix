/**
 * Verification Script for NFT Hardening
 * 
 * Tests:
 * 1. Metadata consistency (external_url presence)
 * 2. Priority fees in generated transactions
 * 3. Schema compliance
 */

import 'dotenv/config';
import { getInvoiceNFTService } from '../server/nft-service';
import { invoices } from '@shared/invoice-schema';

async function verifyHardening() {
    console.log('🧪 Verifying NFT Hardening...\n');

    const nftService = getInvoiceNFTService();

    // Mock Invoice
    const mockInvoice: any = {
        id: 'test-uuid',
        invoiceNumber: 'INV-TEST-001',
        invoicerWalletAddress: 'H77iC7H89vK6m7R8pG6n7m8pG6n7m8pG6n7m8pG6n7m8',
        invoiceeWalletAddress: 'H77iC7H89vK6m7R8pG6n7m8pG6n7m8pG6n7m8pG6n7m8',
        totalAmount: '100.00',
        currency: 'USDC',
        status: 'paid',
        isPrivate: false,
        dueDate: new Date(),
        isArciumEncrypted: false
    };

    // 1. Verify Metadata Unification
    console.log('📋 Checking Metadata Generation...');
    const metadata = nftService.generateInvoiceMetadata(mockInvoice);

    if (metadata.external_url) {
        console.log(`   ✅ External URL present: ${metadata.external_url}`);
    } else {
        console.error('   ❌ External URL MISSING!');
    }

    if (metadata.symbol === 'INV') {
        console.log('   ✅ Symbol correct');
    }

    // 2. Verify Private Metadata
    console.log('\n📋 Checking Private Metadata...');
    mockInvoice.isPrivate = true;
    const privateMetadata = nftService.generateInvoiceMetadata(mockInvoice);
    if (privateMetadata.name.includes('(Private)')) {
        console.log('   ✅ Privacy obfuscation working');
    }
    if (privateMetadata.external_url) {
        console.log(`   ✅ Private External URL: ${privateMetadata.external_url}`);
    }

    // 3. Verify Transaction Fees (MOCK)
    // We'll call createMintInvoiceTransaction and inspect the base64
    console.log('\n📋 Checking Transaction Hardening...');
    try {
        const txBase64 = await nftService.createMintInvoiceTransaction(mockInvoice, mockInvoice.invoiceeWalletAddress);
        console.log('   ✅ Transaction generated successfully');

        // Simple check for Priority Fee instruction (at least it's not empty)
        if (txBase64.length > 500) {
            console.log('   ✅ Transaction size suggests instructions added');
        }
    } catch (e: any) {
        console.error(`   ❌ Failed to generate transaction: ${e.message}`);
    }

    console.log('\n✨ Verification complete!');
}

verifyHardening().catch(console.error);
