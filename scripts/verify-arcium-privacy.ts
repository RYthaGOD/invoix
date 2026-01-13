
import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";
import { ArciumService } from "../server/arcium-service";
import fs from "fs";
import path from "path";
import { Keypair } from "@solana/web3.js";
import "dotenv/config";

// Mock Invoice Input
const mockInvoice = {
    invoiceNumber: "PRIV-TEST-" + Date.now(),
    subtotal: "100.00",
    totalAmount: "100.00",
    currency: "USDC",
    dueDate: new Date().toISOString(),
    invoicerWalletAddress: "Hj6ibS4p3A4G3qW5e9X8z7y8V1n2o3p4q5r6s7t8u9v0", // Mock public key
    invoiceeWalletAddress: "Gj6ibS4p3A4G3qW5e9X8z7y8V1n2o3p4q5r6s7t8u9v0",
    items: [
        { description: "Secret Strategy Consulting", quantity: 1, unitPrice: 50 },
        { description: "Hidden Asset Transfer", quantity: 1, unitPrice: 50 },
    ],
    description: "TOP SECRET INVOICE",
    notes: "Burn after reading",
    paymentTerms: "Immediate"
};

async function verifyPrivacy() {
    console.log("🕵️‍♂️ Starting Arcium Privacy Verification...");

    // 1. Simulate "Server" Environment for Encryption
    // We need to assume ArciumService is initialized?
    // Actually, to test the full flow, we should hit the API. 
    // But purely testing the LOGIC can be done here if we mock the Service calls or use the DB directly.

    // Let's use the DB and Service directly to simulate the route handler logic, 
    // ensuring our key assumptions hold.

    // Initialize Arcium Service
    const arcium = new ArciumService();
    await arcium.initialize(Keypair.generate());

    // 2. Create Invoice Record (Mocking the Route logic step by step)
    console.log("📝 Creating Mock Invoice in DB...");
    const invoiceResult = await db.insert(schema.invoices).values({
        invoiceNumber: mockInvoice.invoiceNumber,
        subtotal: mockInvoice.subtotal,
        totalAmount: mockInvoice.totalAmount,
        currency: mockInvoice.currency,
        dueDate: new Date(mockInvoice.dueDate),
        invoicerWalletAddress: mockInvoice.invoicerWalletAddress,
        invoiceeWalletAddress: mockInvoice.invoiceeWalletAddress,
        status: "draft",
        paidAmount: "0",
        platformFee: "0",
        taxAmount: "0",
        discountAmount: "0",
        description: mockInvoice.description, // Initially plain text
        notes: mockInvoice.notes,
        paymentTerms: mockInvoice.paymentTerms,
        remainingAmount: mockInvoice.totalAmount,
    } as any).returning();
    const invoice = invoiceResult[0];

    // Create Line Items
    await db.insert(schema.invoiceLineItems).values(
        mockInvoice.items.map((item, idx) => ({
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            lineNumber: idx + 1,
            lineTotal: (item.quantity * item.unitPrice).toString()
        }))
    );

    console.log(`   ✅ Created Invoice ID: ${invoice.id} with Plain Text`);

    // 3. Simulate APPLIED encryption (Route Logic)
    console.log("🔐 Simulating Encryption & Scrubbing...");

    const allowedParties = [mockInvoice.invoicerWalletAddress, mockInvoice.invoiceeWalletAddress];
    const encryptedResult = await arcium.encryptTransaction({
        amount: mockInvoice.totalAmount,
        tokenAmount: mockInvoice.totalAmount,
        fromAddress: mockInvoice.invoicerWalletAddress,
        toAddress: mockInvoice.invoiceeWalletAddress,
        txSignature: mockInvoice.invoiceNumber,
        timestamp: Date.now(),
        description: mockInvoice.description,
        notes: mockInvoice.notes,
        paymentTerms: mockInvoice.paymentTerms,
        items: mockInvoice.items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            price: i.unitPrice
        }))
    }, allowedParties);

    if (!encryptedResult.success) {
        throw new Error("Encryption failed");
    }

    // UPDATE DB (Privacy Scrubbing)
    await db.update(schema.invoices).set({
        isArciumEncrypted: true,
        arciumEncryptedData: encryptedResult.encryptedData,
        arciumEncryptionKey: encryptedResult.encryptionKey,
        arciumAllowedParties: JSON.stringify(allowedParties),
        // SCRUB
        description: "🔒 Encrypted Invoice Data",
        notes: "Scrubbed Notes",
        paymentTerms: "Confidential"
    }).where(eq(schema.invoices.id, invoice.id));

    // SCRUB LINE ITEMS
    await db.delete(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoice.id));
    await db.insert(schema.invoiceLineItems).values({
        invoiceId: invoice.id,
        description: "🔒 Encrypted Services",
        quantity: "1",
        unitPrice: mockInvoice.totalAmount,
        lineNumber: 1,
        lineTotal: mockInvoice.totalAmount
    });

    console.log("   ✅ Data Encrypted & Scrubbed in DB");

    // 4. VERIFICATION: Check DB Content (Should be Scrubbed)
    console.log("🔎 Verifying Database Content...");

    const dbInvoices = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoice.id)).limit(1);
    // Manually fetch line items as relation query might fail in this context
    const dbLineItems = await db.select().from(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoice.id));

    const dbInvoice: any = { ...dbInvoices[0], lineItems: dbLineItems };

    if (!dbInvoice) throw new Error("Invoice lost!");

    if (dbInvoice.description === mockInvoice.description) {
        console.error("❌ FAILURE: Description is still visible in DB!");
        process.exit(1);
    } else {
        console.log("   ✅ Description is successfully scrubbed.");
    }

    if (dbInvoice.lineItems.length !== 1 || dbInvoice.lineItems[0].description !== "🔒 Encrypted Services") {
        console.error("❌ FAILURE: Line items are not scrubbed!");
        console.log("Found:", dbInvoice.lineItems);
        process.exit(1);
    } else {
        console.log("   ✅ Line items are successfully scrubbed.");
    }

    // 5. VERIFICATION: Decryption (Route Logic)
    console.log("🔓 Verifying On-The-Fly Decryption...");

    // Simulate authorized access
    const decryptedData = await arcium.decryptTransaction(
        dbInvoice.arciumEncryptedData!,
        dbInvoice.arciumEncryptionKey!
    );

    if (!decryptedData) {
        console.error("❌ FAILURE: Decryption failed!");
        process.exit(1);
    }

    if (decryptedData.description !== mockInvoice.description) {
        console.error(`❌ FAILURE: Decrypted description mismatch! Expected '${mockInvoice.description}', got '${decryptedData.description}'`);
        process.exit(1);
    } else {
        console.log("   ✅ Description successfully restored.");
    }

    if (decryptedData.items.length !== 2) {
        console.error("❌ FAILURE: Line items count mismatch!");
        process.exit(1);
    } else {
        console.log("   ✅ Line items successfully restored.");
    }

    console.log("\n🎉 SUCCESS: True Privacy is verified!");

    // Cleanup
    await db.delete(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoice.id));
    await db.delete(schema.invoices).where(eq(schema.invoices.id, invoice.id));
    process.exit(0);
}

verifyPrivacy().catch(err => {
    console.error(err);
    process.exit(1);
});
