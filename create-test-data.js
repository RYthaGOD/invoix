/**
 * Test Data Generator for SolanaInvoice System
 * Creates sample invoices, templates, and customers for testing
 */

import { db } from './server/db.js';
import {
    invoices,
    invoiceLineItems,
    invoiceTemplates,
    customerProfiles,
    businessProfiles
} from './shared/invoice-schema.js';

const TEST_WALLET = 'WALLET_ADDRESS_HERE'; // Will be replaced

async function createTestData() {
    console.log('🧪 Creating test data for SolanaInvoice...\n');

    try {
        // 1. Create Business Profile
        console.log('1️⃣ Creating business profile...');
        const [businessProfile] = await db.insert(businessProfiles).values({
            ownerWalletAddress: TEST_WALLET,
            businessName: 'Test Business Inc',
            businessEmail: 'test@business.com',
            businessPhone: '+1-555-0123',
            businessAddress: '123 Test Street, Test City, TC 12345',
            taxId: 'TAX-123456',
            website: 'https://testbusiness.com',
            defaultCurrency: 'USDC',
            defaultPaymentTerms: 'Net 30',
            defaultDueDays: 30,
        }).returning();
        console.log('✅ Business profile created:', businessProfile.id);

        // 2. Create Customers
        console.log('\n2️⃣ Creating customers...');
        const customers = await db.insert(customerProfiles).values([
            {
                businessWalletAddress: TEST_WALLET,
                customerName: 'Acme Corporation',
                customerWalletAddress: 'AcmeWallet1111111111111111111111111111111',
                customerEmail: 'billing@acme.com',
                customerPhone: '+1-555-0001',
                customerAddress: '456 Acme Ave, Acme City, AC 54321',
                notes: 'Large enterprise client',
            },
            {
                businessWalletAddress: TEST_WALLET,
                customerName: 'Tech Startup LLC',
                customerWalletAddress: 'TechWallet2222222222222222222222222222222',
                customerEmail: 'finance@techstartup.io',
                customerPhone: '+1-555-0002',
                notes: 'Fast-growing startup',
            },
            {
                businessWalletAddress: TEST_WALLET,
                customerName: 'Global Services Co',
                customerWalletAddress: 'GlobalWallet333333333333333333333333333',
                customerEmail: 'ap@globalservices.com',
                customerPhone: '+1-555-0003',
                customerAddress: '789 Global Plaza, World City, WC 99999',
            },
        ]).returning();
        console.log(`✅ Created ${customers.length} customers`);

        // 3. Create Invoice Templates
        console.log('\n3️⃣ Creating invoice templates...');
        const templates = await db.insert(invoiceTemplates).values([
            {
                ownerWalletAddress: TEST_WALLET,
                name: 'Standard Consulting Invoice',
                description: 'Template for hourly consulting services',
                defaultCurrency: 'USDC',
                defaultPaymentTerms: 'Net 30',
                defaultDueDays: 30,
                defaultLineItems: JSON.stringify([
                    { description: 'Consulting Services', quantity: '1', unitPrice: '150', total: '150' },
                    { description: 'Project Management', quantity: '1', unitPrice: '100', total: '100' },
                ]),
                isActive: true,
            },
            {
                ownerWalletAddress: TEST_WALLET,
                name: 'Monthly Retainer',
                description: 'Monthly recurring service retainer',
                defaultCurrency: 'USDC',
                defaultPaymentTerms: 'Due on Receipt',
                defaultDueDays: 0,
                defaultLineItems: JSON.stringify([
                    { description: 'Monthly Retainer Fee', quantity: '1', unitPrice: '5000', total: '5000' },
                ]),
                isActive: true,
            },
        ]).returning();
        console.log(`✅ Created ${templates.length} templates`);

        // 4. Create Sample Invoices
        console.log('\n4️⃣ Creating sample invoices...');

        const invoice1 = await db.insert(invoices).values({
            invoiceNumber: 'INV-2024-001',
            invoicerWalletAddress: TEST_WALLET,
            invoiceeWalletAddress: customers[0].customerWalletAddress,
            description: 'Consulting services for Q4 2024',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            currency: 'USDC',
            tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
            tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            tokenDecimals: 6,
            subtotal: '1500.00',
            taxAmount: '0.00',
            discountAmount: '0.00',
            totalAmount: '1500.00',
            remainingAmount: '1500.00',
            paidAmount: '0.00',
            status: 'pending',
            paymentTerms: 'Net 30',
            isPrivate: false,
            hideAmounts: false,
            hideParties: false,
            isArciumEncrypted: false,
        }).returning();

        // Add line items for invoice 1
        await db.insert(invoiceLineItems).values([
            {
                invoiceId: invoice1[0].id,
                description: 'Consulting Services - 10 hours',
                quantity: '10',
                unitPrice: '150.00',
                total: '1500.00',
                lineOrder: 0,
            },
        ]);

        const invoice2 = await db.insert(invoices).values({
            invoiceNumber: 'INV-2024-002',
            invoicerWalletAddress: TEST_WALLET,
            invoiceeWalletAddress: customers[1].customerWalletAddress,
            description: 'Monthly retainer - December 2024',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            currency: 'USDC',
            tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            tokenDecimals: 6,
            subtotal: '5000.00',
            taxAmount: '0.00',
            discountAmount: '0.00',
            totalAmount: '5000.00',
            remainingAmount: '5000.00',
            paidAmount: '0.00',
            status: 'pending',
            paymentTerms: 'Due on Receipt',
            isPrivate: false,
            hideAmounts: false,
            hideParties: false,
            isArciumEncrypted: false,
        }).returning();

        await db.insert(invoiceLineItems).values([
            {
                invoiceId: invoice2[0].id,
                description: 'Monthly Retainer Fee',
                quantity: '1',
                unitPrice: '5000.00',
                total: '5000.00',
                lineOrder: 0,
            },
        ]);

        console.log('✅ Created 2 sample invoices with line items');

        console.log('\n🎉 Test data creation complete!');
        console.log('\n📊 Summary:');
        console.log(`   - Business Profiles: 1`);
        console.log(`   - Customers: ${customers.length}`);
        console.log(`   - Templates: ${templates.length}`);
        console.log(`   - Invoices: 2`);
        console.log(`\n✅ You can now test the UI with wallet: ${TEST_WALLET}`);

    } catch (error) {
        console.error('❌ Error creating test data:', error);
        throw error;
    }
}

createTestData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
