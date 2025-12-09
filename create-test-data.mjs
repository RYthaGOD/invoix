/**
 * Test Data Generator for SolanaInvoice System
 * Creates sample invoices, templates, and customers for testing
 */

import Database from 'better-sqlite3';

const TEST_WALLET = '5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx';
const db = new Database('./data/invoices.db');

async function createTestData() {
    console.log('🧪 Creating test data for SolanaInvoice...\n');
    console.log(`📍 Test Wallet: ${TEST_WALLET}\n`);

    try {
        // 1. Create Business Profile
        console.log('1️⃣ Creating business profile...');
        const businessResult = db.prepare(`
      INSERT INTO business_profiles (
        id, owner_wallet_address, business_name, business_email, business_phone,
        business_address, tax_id, website, default_currency, default_payment_terms,
        default_due_days, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            crypto.randomUUID(),
            TEST_WALLET,
            'Test Business Inc',
            'test@business.com',
            '+1-555-0123',
            '123 Test Street, Test City, TC 12345',
            'TAX-123456',
            'https://testbusiness.com',
            'USDC',
            'Net 30',
            30,
            new Date().toISOString(),
            new Date().toISOString()
        );
        console.log('✅ Business profile created');

        // 2. Create Customers
        console.log('\n2️⃣ Creating customers...');
        const customers = [
            {
                name: 'Acme Corporation',
                wallet: 'AcmeWallet1111111111111111111111111111111',
                email: 'billing@acme.com',
                phone: '+1-555-0001',
                address: '456 Acme Ave, Acme City, AC 54321',
                notes: 'Large enterprise client',
            },
            {
                name: 'Tech Startup LLC',
                wallet: 'TechWallet2222222222222222222222222222222',
                email: 'finance@techstartup.io',
                phone: '+1-555-0002',
                address: null,
                notes: 'Fast-growing startup',
            },
            {
                name: 'Global Services Co',
                wallet: 'GlobalWallet333333333333333333333333333',
                email: 'ap@globalservices.com',
                phone: '+1-555-0003',
                address: '789 Global Plaza, World City, WC 99999',
                notes: null,
            },
        ];

        const customerIds = [];
        for (const customer of customers) {
            const id = crypto.randomUUID();
            db.prepare(`
        INSERT INTO customer_profiles (
          id, business_wallet_address, customer_name, customer_wallet_address,
          customer_email, customer_phone, customer_address, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                id,
                TEST_WALLET,
                customer.name,
                customer.wallet,
                customer.email,
                customer.phone,
                customer.address,
                customer.notes,
                new Date().toISOString(),
                new Date().toISOString()
            );
            customerIds.push({ id, wallet: customer.wallet, name: customer.name });
        }
        console.log(`✅ Created ${customers.length} customers`);

        // 3. Create Invoice Templates
        console.log('\n3️⃣ Creating invoice templates...');
        const templates = [
            {
                name: 'Standard Consulting Invoice',
                description: 'Template for hourly consulting services',
                lineItems: [
                    { description: 'Consulting Services', quantity: '1', unitPrice: '150', total: '150' },
                    { description: 'Project Management', quantity: '1', unitPrice: '100', total: '100' },
                ],
            },
            {
                name: 'Monthly Retainer',
                description: 'Monthly recurring service retainer',
                lineItems: [
                    { description: 'Monthly Retainer Fee', quantity: '1', unitPrice: '5000', total: '5000' },
                ],
            },
        ];

        for (const template of templates) {
            db.prepare(`
        INSERT INTO invoice_templates (
          id, owner_wallet_address, name, description, default_currency,
          default_payment_terms, default_due_days, default_line_items,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                crypto.randomUUID(),
                TEST_WALLET,
                template.name,
                template.description,
                'USDC',
                'Net 30',
                30,
                JSON.stringify(template.lineItems),
                1,
                new Date().toISOString(),
                new Date().toISOString()
            );
        }
        console.log(`✅ Created ${templates.length} templates`);

        // 4. Create Sample Invoices
        console.log('\n4️⃣ Creating sample invoices...');

        const invoiceData = [
            {
                number: 'INV-2024-001',
                customer: customerIds[0],
                description: 'Consulting services for Q4 2024',
                amount: '1500.00',
                daysUntilDue: 30,
                lineItems: [
                    { description: 'Consulting Services - 10 hours', quantity: '10', unitPrice: '150.00', total: '1500.00' },
                ],
            },
            {
                number: 'INV-2024-002',
                customer: customerIds[1],
                description: 'Monthly retainer - December 2024',
                amount: '5000.00',
                daysUntilDue: 7,
                lineItems: [
                    { description: 'Monthly Retainer Fee', quantity: '1', unitPrice: '5000.00', total: '5000.00' },
                ],
            },
        ];

        for (const invoice of invoiceData) {
            const invoiceId = crypto.randomUUID();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + invoice.daysUntilDue);

            db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, invoicer_wallet_address, invoicee_wallet_address,
          description, due_date, currency, token_mint, token_mint_address, token_decimals,
          subtotal, tax_amount, discount_amount, total_amount, remaining_amount, paid_amount,
          status, payment_terms, is_private, hide_amounts, hide_parties,
          is_arcium_encrypted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                invoiceId,
                invoice.number,
                TEST_WALLET,
                invoice.customer.wallet,
                invoice.description,
                dueDate.toISOString(),
                'USDC',
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                6,
                invoice.amount,
                '0.00',
                '0.00',
                invoice.amount,
                invoice.amount,
                '0.00',
                'pending',
                'Net 30',
                0,
                0,
                0,
                0,
                new Date().toISOString(),
                new Date().toISOString()
            );

            // Add line items
            invoice.lineItems.forEach((item, index) => {
                db.prepare(`
          INSERT INTO invoice_line_items (
            id, invoice_id, description, quantity, unit_price, total, line_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
                    crypto.randomUUID(),
                    invoiceId,
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.total,
                    index,
                    new Date().toISOString()
                );
            });
        }

        console.log('✅ Created 2 sample invoices with line items');

        console.log('\n🎉 Test data creation complete!');
        console.log('\n📊 Summary:');
        console.log(`   - Business Profiles: 1`);
        console.log(`   - Customers: ${customers.length}`);
        console.log(`   - Templates: ${templates.length}`);
        console.log(`   - Invoices: 2`);
        console.log(`\n✅ You can now test the UI with wallet: ${TEST_WALLET}`);
        console.log(`\n🔗 Open: http://localhost:5000`);

    } catch (error) {
        console.error('❌ Error creating test data:', error);
        throw error;
    } finally {
        db.close();
    }
}

createTestData();
