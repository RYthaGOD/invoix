/**
 * Simple Test Data Generator for SolanaInvoice
 * Uses API endpoints to create test data
 */

const TEST_WALLET = '5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx';
const API_BASE = 'http://localhost:5000/api';

async function createTestData() {
    console.log('🧪 Creating test data via API...\n');
    console.log(`📍 Test Wallet: ${TEST_WALLET}\n`);

    try {
        // 1. Create Business Profile
        console.log('1️⃣ Creating business profile...');
        const businessResponse = await fetch(`${API_BASE}/business-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: TEST_WALLET,
                businessName: 'Test Business Inc',
                businessEmail: 'test@business.com',
                businessPhone: '+1-555-0123',
                businessAddress: '123 Test Street, Test City, TC 12345',
                taxId: 'TAX-123456',
                website: 'https://testbusiness.com',
                defaultCurrency: 'USDC',
                defaultPaymentTerms: 'Net 30',
                defaultDueDays: 30,
            }),
        });

        if (businessResponse.ok) {
            console.log('✅ Business profile created');
        } else {
            const error = await businessResponse.text();
            console.log('⚠️  Business profile may already exist or:', error);
        }

        // 2. Create Customers
        console.log('\n2️⃣ Creating customers...');
        const customers = [
            {
                customerName: 'Acme Corporation',
                customerWalletAddress: 'AcmeWallet1111111111111111111111111111111',
                customerEmail: 'billing@acme.com',
                customerPhone: '+1-555-0001',
                customerAddress: '456 Acme Ave, Acme City, AC 54321',
                notes: 'Large enterprise client',
            },
            {
                customerName: 'Tech Startup LLC',
                customerWalletAddress: 'TechWallet2222222222222222222222222222222',
                customerEmail: 'finance@techstartup.io',
                customerPhone: '+1-555-0002',
                notes: 'Fast-growing startup',
            },
            {
                customerName: 'Global Services Co',
                customerWalletAddress: 'GlobalWallet333333333333333333333333333',
                customerEmail: 'ap@globalservices.com',
                customerPhone: '+1-555-0003',
                customerAddress: '789 Global Plaza, World City, WC 99999',
            },
        ];

        for (const customer of customers) {
            const response = await fetch(`${API_BASE}/customers?wallet=${TEST_WALLET}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer),
            });

            if (response.ok) {
                console.log(`✅ Created customer: ${customer.customerName}`);
            } else {
                console.log(`⚠️  Failed to create ${customer.customerName}`);
            }
        }

        // 3. Create Templates
        console.log('\n3️⃣ Creating invoice templates...');
        const templates = [
            {
                name: 'Standard Consulting Invoice',
                description: 'Template for hourly consulting services',
                defaultCurrency: 'USDC',
                defaultPaymentTerms: 'Net 30',
                defaultDueDays: 30,
                defaultLineItems: JSON.stringify([
                    { description: 'Consulting Services', quantity: '1', unitPrice: '150', total: '150' },
                    { description: 'Project Management', quantity: '1', unitPrice: '100', total: '100' },
                ]),
            },
            {
                name: 'Monthly Retainer',
                description: 'Monthly recurring service retainer',
                defaultCurrency: 'USDC',
                defaultPaymentTerms: 'Due on Receipt',
                defaultDueDays: 0,
                defaultLineItems: JSON.stringify([
                    { description: 'Monthly Retainer Fee', quantity: '1', unitPrice: '5000', total: '5000' },
                ]),
            },
        ];

        for (const template of templates) {
            const response = await fetch(`${API_BASE}/templates?wallet=${TEST_WALLET}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template),
            });

            if (response.ok) {
                console.log(`✅ Created template: ${template.name}`);
            } else {
                console.log(`⚠️  Failed to create ${template.name}`);
            }
        }

        // 4. Create Sample Invoices
        console.log('\n4️⃣ Creating sample invoices...');
        const invoices = [
            {
                invoiceeWalletAddress: 'AcmeWallet1111111111111111111111111111111',
                description: 'Consulting services for Q4 2024',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currency: 'USDC',
                tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                paymentTerms: 'Net 30',
                lineItems: [
                    { description: 'Consulting Services - 10 hours', quantity: 10, unitPrice: 150 },
                ],
            },
            {
                invoiceeWalletAddress: 'TechWallet2222222222222222222222222222222',
                description: 'Monthly retainer - December 2024',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                currency: 'USDC',
                tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                paymentTerms: 'Due on Receipt',
                lineItems: [
                    { description: 'Monthly Retainer Fee', quantity: 1, unitPrice: 5000 },
                ],
            },
        ];

        for (let i = 0; i < invoices.length; i++) {
            const response = await fetch(`${API_BASE}/invoices?wallet=${TEST_WALLET}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoices[i]),
            });

            if (response.ok) {
                console.log(`✅ Created invoice ${i + 1}`);
            } else {
                const error = await response.text();
                console.log(`⚠️  Failed to create invoice ${i + 1}:`, error);
            }
        }

        console.log('\n🎉 Test data creation complete!');
        console.log('\n📊 Summary:');
        console.log(`   - Business Profile: 1`);
        console.log(`   - Customers: ${customers.length}`);
        console.log(`   - Templates: ${templates.length}`);
        console.log(`   - Invoices: ${invoices.length}`);
        console.log(`\n✅ Open http://localhost:5000 and connect wallet: ${TEST_WALLET}`);

    } catch (error) {
        console.error('❌ Error creating test data:', error.message);
    }
}

createTestData();
