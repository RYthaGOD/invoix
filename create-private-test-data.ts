
import { db } from "./server/db";
import { invoices, payments, customers, invoiceLineItems, businessProfiles } from "./shared/invoice-schema";
import crypto from "crypto";
import { Keypair } from "@solana/web3.js";

async function createPrivateTestData() {
    console.log("🔒 Creating Private Test Data...");

    // 1. Setup Test Wallet (Invoicer) working with existing test data
    const TEST_WALLET = '5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx'; // From existing script
    const CUSTOMER_WALLET = 'AcmeWallet1111111111111111111111111111111';

    // 2. Create Private Invoice
    console.log("Creating private invoice...");
    const privacySalt = crypto.randomBytes(32).toString('hex');
    const invoiceNum = `INV-PRIV-${Date.now().toString().slice(-4)}`;

    const [newInvoice] = await db.insert(invoices).values({
        invoiceNumber: invoiceNum,
        invoicerWalletAddress: TEST_WALLET,
        invoiceeWalletAddress: CUSTOMER_WALLET,
        description: "Confidential Project - Top Secret",
        dueDate: new Date(Date.now() + 86400000 * 30), // 30 days
        currency: "USDC",
        totalAmount: "10000.00",
        subtotal: "10000.00",
        remainingAmount: "0.00", // Paid
        paidAmount: "10000.00",
        status: "paid", // Already paid
        isPrivate: true,
        privacySalt: privacySalt,
        invoiceDate: new Date(),
    }).returning();

    // Create Line Items
    await db.insert(invoiceLineItems).values({
        invoiceId: newInvoice.id,
        description: "Stealth Consultation",
        quantity: "1",
        unitPrice: "10000.00",
        lineTotal: "10000.00",
        lineNumber: 1
    });

    console.log(`✅ Created Private Invoice: ${invoiceNum} (ID: ${newInvoice.id})`);
    console.log(`   Salt: ${privacySalt}`);

    // 3. Simulate Payment
    console.log("Simulating payment...");
    const txSignature = `5simulatedTx${crypto.randomBytes(40).toString('hex')}`; // Fake signature

    const [newPayment] = await db.insert(payments).values({
        invoiceId: newInvoice.id,
        amount: "10000.00",
        currency: "USDC",
        txSignature: txSignature,
        fromAddress: CUSTOMER_WALLET,
        toAddress: TEST_WALLET,
        paymentMethod: "solana_transfer",
        status: "completed",
        paidAt: new Date()
    }).returning();

    console.log(`✅ Recorded Payment: ${newPayment.id}`);

    // 4. Receipt Logic Skipped (Requires Full Env)
    console.log("⚠️ Receipt NFT Minting skipped in standalone script.");
    console.log("   (requires full server environment with path aliases).");
    console.log("   Please use the App UI to verify receipt generation if needed.");

    console.log("\n🎉 Private Test Data Generation Complete!");
    process.exit(0);
}

createPrivateTestData();
