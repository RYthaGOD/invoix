/**
 * Complete Test Data Generator for SolanaInvoice
 * Creates test data with all required fields
 */

const TEST_WALLET = '5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx';
const API_BASE = 'http://localhost:5000/api';

async function createTestData() {
    console.log('🧪 Creating complete test data...\n');
    console.log(`📍 Test Wallet: ${TEST_WALLET}\n`);

    try {
        // 1. Business Profile (already created)
        console.log('1️⃣ Business profile already exists ✅\n');

        // 2. Create Customers
        console.log('2️⃣ Creating customers...');
        const customers = [
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
        ];

        for (const customer of customers) {
            const response = await fetch(`${API_BASE}/customers?wallet=${TEST_WALLET}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer),
            });

            if (response.ok) {
                console.log(`✅ Created: ${customer.customerName}`);
            } else {
                const error = await response.json();
                console.log(`⚠️  ${customer.customerName}: ${error.message || 'Failed'}`);
            }
        }

        // 3. Create Templates
        console.log('\n3️⃣ Creating templates...');
        const templates = [
            {
                ownerWalletAddress: TEST_WALLET,
                name: 'Standard Consulting',
                description: 'Hourly consulting services',
                defaultCurrency: 'USDC',
                defaultTokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                defaultPaymentTerms: 'Net 30',
                defaultDueDays: 30,
                defaultLineItems: JSON.stringify([
                    { description: 'Consulting Services', quantity: '1', unitPrice: '150', total: '150' },
                ]),
                isActive: true,
            },
            {
                ownerWalletAddress: TEST_WALLET,
                name: 'Monthly Retainer',
                description: 'Monthly service retainer',
                defaultCurrency: 'USDC',
                defaultTokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                defaultPaymentTerms: 'Due on Receipt',
                defaultDueDays: 0,
                defaultLineItems: JSON.stringify([
                    { description: 'Monthly Fee', quantity: '1', unitPrice: '5000', total: '5000' },
                ]),
                isActive: true,
            },
        ];

        for (const template of templates) {
            const response = await fetch(`${API_BASE}/templates?wallet=${TEST_WALLET}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template),
            });

            if (response.ok) {
                console.log(`✅ Created: ${template.name}`);
            } else {
                const error = await response.json();
                console.log(`⚠️  ${template.name}: ${error.message || 'Failed'}`);
            }
        }

        // 4. Create Invoices with ALL required fields
        console.log('\n4️⃣ Creating invoices...');

        const dueDate1 = new Date();
        dueDate1.setDate(dueDate1.getDate() + 30);

        const dueDate2 = new Date();
        dueDate2.setDate(dueDate2.getDate() + 7);

        const invoices = [
            {
                invoiceNumber: 'INV-2024-001',
                invoicerWalletAddress: TEST_WALLET,
                invoiceeWalletAddress: 'AcmeWallet1111111111111111111111111111111',
                description: 'Consulting services Q4 2024',
                dueDate: dueDate1.toISOString(),
                currency: 'USDC',
                tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
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
                lineItems: [
                    { description: 'Consulting - 10 hours', quantity: 10, unitPrice: 150 },
                ],
            },
            {
                invoiceNumber: 'INV-2024-002',
                invoicerWalletAddress: TEST_WALLET,
                invoiceeWalletAddress: 'TechWallet2222222222222222222222222222222',
                description: 'Monthly retainer Dec 2024',
                dueDate: dueDate2.toISOString(),
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
                lineItems: [
                    { description: 'Monthly Retainer', quantity: 1, unitPrice: 5000 },
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
                const data = await response.json();
                console.log(`✅ Created: ${invoices[i].invoiceNumber}`);
            } else {
                const error = await response.json();
                console.log(`⚠️  ${invoices[i].invoiceNumber}: ${error.message || 'Failed'}`);
            }
        }

        console.log('\n🎉 Test data creation complete!');
        console.log('\n📊 Summary:');
        console.log(`   ✅ Business Profile: 1`);
        console.log(`   ✅ Customers: 3`);
        console.log(`   ✅ Templates: 2`);
        console.log(`   ✅ Invoices: 2`);
        console.log(`\n🌐 Open: http://localhost:5000`);
        console.log(`🔑 Wallet: ${TEST_WALLET}`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

createTestData();
