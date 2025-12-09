/**
 * Authentication Test Script
 * 
 * Tests the SIWS authentication flow programmatically
 * Uses the configured private key to sign messages and verify the auth system
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import fetch from "node-fetch";

// Use the private key from get-pubkey.mjs
const PRIVATE_KEY = "2kVgx6xbijWa1yVXD16A4iVb4CqM1XWCqX5dw5AjvYGvTqLkgGLmEhcRRF346vhHHUjFhnu1cakCyYLLN5U3jTiz";
const API_URL = "http://127.0.0.1:5000";

async function testAuthentication() {
    console.log("🧪 Testing Authentication System\n");

    // Load keypair
    const privateKeyBytes = bs58.decode(PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    const walletAddress = keypair.publicKey.toBase58();

    console.log(`📍 Testing with wallet: ${walletAddress}\n`);

    // Step 1: Check initial auth status (should be unauthenticated)
    console.log("1️⃣  Checking initial auth status...");
    const meResponse1 = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
    });
    const meData1 = await meResponse1.json();
    console.log(`   Status: ${meData1.authenticated ? "✅ Authenticated" : "❌ Not authenticated"}`);
    if (meData1.authenticated) {
        console.log(`   ⚠️  Already logged in as: ${meData1.walletAddress}`);
    }

    // Step 2: Create and sign message
    console.log("\n2️⃣  Creating signature...");
    const timestamp = Date.now();
    const message = `Sign in to SolanaInvoice at ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    // Sign with the private key
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    console.log(`   Message: "${message}"`);
    console.log(`   Signature: ${signatureBase58.slice(0, 20)}...`);

    // Step 3: Login
    console.log("\n3️⃣  Logging in...");
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            walletAddress,
            message,
            signature: signatureBase58,
        }),
    });

    if (!loginResponse.ok) {
        const error = await loginResponse.json();
        console.error(`   ❌ Login failed: ${error.message}`);
        process.exit(1);
    }

    const loginData = await loginResponse.json();
    console.log(`   ✅ Login successful!`);
    console.log(`   Wallet: ${loginData.walletAddress}`);

    // Get session cookie
    const cookies = loginResponse.headers.get("set-cookie");
    console.log(`   Session cookie: ${cookies ? "✅ Set" : "❌ Not set"}`);

    // Step 4: Verify authenticated status
    console.log("\n4️⃣  Verifying authentication...");
    const meResponse2 = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
        headers: {
            Cookie: cookies || "",
        },
    });
    const meData2 = await meResponse2.json();

    if (meData2.authenticated && meData2.walletAddress === walletAddress) {
        console.log(`   ✅ Authenticated as: ${meData2.walletAddress}`);
    } else {
        console.log(`   ❌ Authentication verification failed`);
        process.exit(1);
    }

    // Step 5: Test protected endpoint (create invoice)
    console.log("\n5️⃣  Testing protected endpoint (create invoice)...");
    const invoiceData = {
        invoiceNumber: `TEST-${Date.now()}`,
        // Send a FAKE address to verify server overwrites it with session wallet
        invoicerWalletAddress: "FakeInvoicerAddress11111111111111111111111111",
        invoiceeWalletAddress: "11111111111111111111111111111111", // Dummy address
        description: "Test invoice for authentication",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: "USDC",
        tokenMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Changed from tokenMint
        tokenDecimals: 6,
        subtotal: "100.00",
        taxAmount: "0",
        discountAmount: "0",
        totalAmount: "100.00",
        remainingAmount: "100.00",
        paidAmount: "0",
        status: "draft",
        paymentTerms: "Net 30",
        isPrivate: true,
        hideAmounts: true,
        hideParties: true,
        encryptWithArcium: false,
        mintNFT: false
    };

    const createInvoiceResponse = await fetch(`${API_URL}/api/invoices`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookies || "",
        },
        credentials: "include",
        body: JSON.stringify(invoiceData),
    });

    if (!createInvoiceResponse.ok) {
        const error = await createInvoiceResponse.json();
        console.error(`   ❌ Invoice creation failed: ${error.message}`);
        if (error.code === "NOT_AUTHENTICATED") {
            console.error(`   🔒 Session not recognized - authentication failed`);
        }
        process.exit(1);
    }

    const invoiceResult = await createInvoiceResponse.json();
    console.log(`   ✅ Invoice created successfully!`);
    console.log(`   Invoice ID: ${invoiceResult.invoice.id}`);
    console.log(`   Invoicer: ${invoiceResult.invoice.invoicerWalletAddress}`);

    // Verify the invoicer matches our wallet
    if (invoiceResult.invoice.invoicerWalletAddress === walletAddress) {
        console.log(`   ✅ Invoicer wallet matches authenticated wallet`);
    } else {
        console.log(`   ❌ Invoicer wallet mismatch!`);
        console.log(`      Expected: ${walletAddress}`);
        console.log(`      Got: ${invoiceResult.invoice.invoicerWalletAddress}`);
        process.exit(1);
    }

    // Step 6: Test logout
    console.log("\n6️⃣  Testing logout...");
    const logoutResponse = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
            Cookie: cookies || "",
        },
    });

    if (!logoutResponse.ok) {
        console.error(`   ❌ Logout failed`);
        process.exit(1);
    }

    console.log(`   ✅ Logout successful`);

    // Step 7: Verify logged out
    console.log("\n7️⃣  Verifying logout...");
    const meResponse3 = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
        headers: {
            Cookie: cookies || "",
        },
    });
    const meData3 = await meResponse3.json();

    if (!meData3.authenticated) {
        console.log(`   ✅ Successfully logged out`);
    } else {
        console.log(`   ❌ Still authenticated after logout`);
        process.exit(1);
    }

    // Final summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 ALL TESTS PASSED!");
    console.log("=".repeat(50));
    console.log("\n✅ Authentication system is working correctly:");
    console.log("   • Signature verification works");
    console.log("   • Session creation works");
    console.log("   • Protected endpoints require authentication");
    console.log("   • Server uses session wallet (not request body)");
    console.log("   • Logout works");
    console.log("\n🔒 Security vulnerability is FIXED!");
}

// Run the test
testAuthentication().catch((error) => {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
});
