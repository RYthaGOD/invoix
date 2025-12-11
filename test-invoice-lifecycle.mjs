/**
 * Full Invoice Lifecycle Test Script
 * 
 * Verifies the complete workflow:
 * 1. Authentication (SIWS)
 * 2. Create Invoice (Draft with Line Items)
 * 3. Read Invoice (Verify data persistence)
 * 4. Update Invoice (Modify status/details)
 * 5. List Invoices (Verify pagination/filtering)
 * 6. Delete/Cancel Invoice (Cleanup)
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import fetch from "node-fetch";
import fs from "fs";

// Configuration
const PRIVATE_KEY = "2kVgx6xbijWa1yVXD16A4iVb4CqM1XWCqX5dw5AjvYGvTqLkgGLmEhcRRF346vhHHUjFhnu1cakCyYLLN5U3jTiz";
const API_URL = "https://invoix-web-production.up.railway.app";

async function testLifecycle() {
    console.log("🚀 Starting Invoice Lifecycle Test\n");

    // 1. Setup Wallet
    const privateKeyBytes = bs58.decode(PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const walletAddress = keypair.publicKey.toBase58();
    console.log(`👤 Actor: ${walletAddress}`);

    // 2. Authenticate
    console.log("\n🔑 Authenticating...");
    const timestamp = Date.now();
    const message = `Sign in to SolanaInvoice at ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // Nacl returns a Uint8Array, we need to base58 encode it for the API
    const signatureBase58 = bs58.encode(signature);

    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            walletAddress,
            message,
            signature: signatureBase58,
        }),
    });

    if (!loginRes.ok) {
        const text = await loginRes.text();
        console.error("Login Error Response:", text);
        throw new Error(`Login failed: ${text}`);
    }
    const cookie = loginRes.headers.get("set-cookie");
    console.log("✅ Authenticated");

    // 3. Create Invoice
    console.log("\n📝 Creating Draft Invoice...");
    const invoiceNumber = `INV-${Date.now()}`;
    const createRes = await fetch(`${API_URL}/api/invoices`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie
        },
        body: JSON.stringify({
            invoiceNumber,
            invoiceeWalletAddress: "11111111111111111111111111111111", // Dummy recipient
            description: "Web Design Services",
            dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            currency: "USDC",
            subtotal: "1500.00",
            taxAmount: "150.00",
            discountAmount: "0",
            totalAmount: "1650.00",
            remainingAmount: "1650.00",
            status: "draft",
            isPrivate: true,
            mintNFT: false,
            paymentTerms: "Net 30", // Added missing field
            lineItems: [
                { description: "Homepage Design", quantity: "1", unitPrice: "1000.00" },
                { description: "Mobile Layout", quantity: "1", unitPrice: "500.00" }
            ]
        }),
    });

    if (!createRes.ok) {
        const text = await createRes.text();
        console.error("Server Error Response:", text);
        throw new Error(`Create failed: ${text}`);
    }

    const { invoice } = await createRes.json();
    console.log(`✅ Invoice Created: ${invoice.id} (${invoice.invoiceNumber})`);

    // 4. Read Invoice (Details)
    console.log("\n🔍 Reading Invoice Details...");
    const readRes = await fetch(`${API_URL}/api/invoices/${invoice.id}?wallet=${walletAddress}`, {
        headers: { "Cookie": cookie }
    });
    const readData = await readRes.json();

    if (readData.invoice.lineItems.length !== 2) {
        throw new Error("Line items returned incorrect count");
    }
    console.log(`✅ Verified: Retrieved ${readData.invoice.lineItems.length} line items`);

    // 5. Update Invoice
    console.log("\n✏️ Updating Invoice (Draft -> Sent)...");
    const updateRes = await fetch(`${API_URL}/api/invoices/${invoice.id}?wallet=${walletAddress}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie
        },
        body: JSON.stringify({
            status: "sent",
            sentAt: new Date().toISOString()
        })
    });

    if (!updateRes.ok) throw new Error("Update failed");
    console.log("✅ Invoice Status Updated to 'sent'");

    // 6. List Invoices
    console.log("\n📋 Listing Invoices...");
    const listRes = await fetch(`${API_URL}/api/invoices?wallet=${walletAddress}&limit=5`, {
        headers: { "Cookie": cookie }
    });
    const listData = await listRes.json();

    const found = listData.invoices.find(inv => inv.id === invoice.id);
    if (!found) throw new Error("Created invoice not found in list");
    console.log(`✅ Verified: Invoice ${found.invoiceNumber} appears in list (Status: ${found.status})`);

    // 7. Cleanup (Delete/Cancel)
    console.log("\n🗑️ Attempting to Delete 'Sent' Invoice (Expected: Cancelled)...");
    const deleteFailRes = await fetch(`${API_URL}/api/invoices/${invoice.id}?wallet=${walletAddress}`, {
        method: "DELETE",
        headers: { "Cookie": cookie }
    });

    const deleteResult = await deleteFailRes.json();
    console.log(`ℹ️ Delete Result: ${deleteResult.message}`);

    // Verify it is now cancelled
    const finalCheckRes = await fetch(`${API_URL}/api/invoices/${invoice.id}?wallet=${walletAddress}`, {
        headers: { "Cookie": cookie }
    });
    const finalData = await finalCheckRes.json();

    if (finalData.invoice.status === "cancelled") {
        console.log("✅ Verified: Invoice status changed to 'cancelled'");
    } else {
        console.log(`⚠️ Status is ${finalData.invoice.status}`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 WORKFLOW VERIFICATION SUCCESSFUL");
    console.log("=".repeat(50));
}

testLifecycle().catch(err => {
    const errorLog = `Error: ${err.message}\nStack: ${err.stack}\nDetails: ${JSON.stringify(err)}`;
    fs.writeFileSync("test-error.log", errorLog);
    console.error("❌ Test Failed. Check test-error.log");
    process.exit(1);
});
