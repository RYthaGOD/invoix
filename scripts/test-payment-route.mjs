
import { spawn } from 'child_process';
import fetch from 'node-fetch';

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTest() {
    console.log("Starting reproduction test...");

    // 1. Test Missing Route (Deep Dive Fix Verification)
    console.log("\n--- Test 1: Missing API Route (Expect JSON 404) ---");
    try {
        const res = await fetch(`${BASE_URL}/api/this-route-does-not-exist`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        const contentType = res.headers.get('content-type');
        const status = res.status;

        console.log(`Status: ${status}`);
        console.log(`Content-Type: ${contentType}`);

        if (contentType && contentType.includes('application/json')) {
            const body = await res.json();
            console.log("Body:", JSON.stringify(body));
            if (status === 404) {
                console.log("✅ PASS: Received JSON 404 for missing API route.");
            } else {
                console.log("❌ FAIL: Received JSON but wrong status (expected 404).");
            }
        } else {
            const text = await res.text();
            console.log(`❌ FAIL: Received non-JSON response (likely HTML): ${text.substring(0, 50)}...`);
        }

    } catch (err) {
        console.error("Request failed:", err.message);
    }

    // 2. Test Payment Route (Fix Verification)
    // Note: We can't easily test a full success without a valid invoice ID and wallet setup, 
    // but we can check if the route EXISTS (i.e., not 404 HTML).
    console.log("\n--- Test 2: Valid Payment Route (Expect Handled Response) ---");
    try {
        const res = await fetch(`${BASE_URL}/api/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId: '00000000-0000-0000-0000-000000000000', // Sude UUID
                amount: '10.00',
                currency: 'USDC',
                txSignature: 'simulated_signature',
                fromAddress: 'simulated_wallet'
            })
        });

        const contentType = res.headers.get('content-type');
        const status = res.status;

        console.log(`Status: ${status}`);
        console.log(`Content-Type: ${contentType}`);

        if (contentType && contentType.includes('application/json')) {
            // Even if it fails validation (400/500/404 invoice not found), it should be JSON
            console.log("✅ PASS: Received JSON response from payment route.");
        } else {
            const text = await res.text();
            console.log(`❌ FAIL: Received non-JSON response (likely HTML): ${text.substring(0, 50)}...`);
        }

    } catch (err) {
        console.error("Request failed:", err.message);
    }
    // 3. Test Fee Payer Config (Module Health Check)
    console.log("\n--- Test 3: Fee Payer Config (Check Module Health) ---");
    try {
        const res = await fetch(`${BASE_URL}/api/config/fee-payer`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const status = res.status;
        console.log(`Status: ${status}`);
        if (status === 200 || status === 503) {
            console.log("✅ PASS: Fee Payer endpoint accessible (Module loaded).");
        } else {
            const text = await res.text();
            console.log(`❌ FAIL: Fee Payer endpoint failed: ${status} ${text.substring(0, 50)}`);
        }
    } catch (err) {
        console.error("Request failed:", err.message);
    }
}

runTest();
