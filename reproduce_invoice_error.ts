/**
 * Reproduction Script: Duplicate Invoice Number Error
 * 
 * This script attempts to create two invoices with the SAME invoice number
 * to confirm the database unique constraint violation crash.
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import fetch from "node-fetch";

// Configuration
let PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.log("⚠️ TEST_PRIVATE_KEY not set. Generating a temporary wallet for this test...");
    const keypair = Keypair.generate();
    PRIVATE_KEY = bs58.encode(keypair.secretKey);
}
const API_URL = "http://localhost:5000"; // Assuming local server for reproduction

async function reproduceError() {
    console.log("🚀 Starting Reproduction: Duplicate Invoice Number\n");

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
    const signatureBase58 = bs58.encode(signature);

    try {
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
            throw new Error(`Login failed: ${await loginRes.text()}`);
        }
        const cookie = loginRes.headers.get("set-cookie");
        console.log("✅ Authenticated");

        // 3. Create First Invoice
        const invoiceNumber = `INV-REPRO-${Date.now()}`;
        console.log(`\n📝 Creating First Invoice: ${invoiceNumber}...`);

        const res1 = await fetch(`${API_URL}/api/invoices`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookie
            },
            body: JSON.stringify({
                invoiceNumber, // Unique number
                invoiceeWalletAddress: "11111111111111111111111111111111",
                description: "Test Invoice 1",
                dueDate: new Date(Date.now() + 86400000).toISOString(),
                currency: "USDC",
                subtotal: "100.00",
                totalAmount: "100.00",
                remainingAmount: "100.00",
                status: "draft",
                lineItems: [{ description: "Item 1", quantity: "1", unitPrice: "100.00" }]
            }),
        });

        if (!res1.ok) {
            throw new Error(`First invoice creation failed: ${await res1.text()}`);
        }
        console.log("✅ First invoice created successfully.");

        // 4. Create SECOND Invoice with SAME Number
        console.log(`\n📝 Attempting to create SECOND Invoice with SAME Number: ${invoiceNumber}...`);

        const res2 = await fetch(`${API_URL}/api/invoices`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookie
            },
            body: JSON.stringify({
                invoiceNumber, // DUPLICATE number
                invoiceeWalletAddress: "11111111111111111111111111111111",
                description: "Test Invoice 2 (Duplicate)",
                dueDate: new Date(Date.now() + 86400000).toISOString(),
                currency: "USDC",
                subtotal: "100.00",
                totalAmount: "100.00",
                remainingAmount: "100.00",
                status: "draft",
                lineItems: [{ description: "Item 1", quantity: "1", unitPrice: "100.00" }]
            }),
        });

        const text2 = await res2.text();
        if (!res2.ok) {
            console.log("\n✅ REPRODUCTION SUCCESSFUL!");
            console.log(`Expected Error Captured: ${res2.status} ${res2.statusText}`);
            console.log(`Response Body: ${text2}`);
            if (text2.includes("duplicate key value") || text2.includes("unique constraint")) {
                console.log("Confirmed: Database unique constraint violation.");
            }
        } else {
            console.error("\n❌ REPRODUCTION FAILED: Second invoice was created successfully? This shouldn't happen if constraint exists.");
            console.log(text2);
        }

    } catch (err: any) {
        if (err.cause && err.cause.code === 'ECONNREFUSED') {
            console.error("\n❌ Connection Refused: Ensure the server is running on localhost:5000");
        } else {
            console.error(`\n❌ Script Error: ${err.message}`);
        }
        process.exit(1);
    }
}

reproduceError().catch(err => {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
});
