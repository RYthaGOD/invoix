
import axios from 'axios';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = "http://localhost:5000";

async function verifyMarketplace() {
    console.log("🔍 Starting Marketplace API Verification...");

    // 1. Health Check
    try {
        const health = await axios.get(`${API_URL}/health`);
        console.log("✅ Server Health:", health.data);
    } catch (e) {
        console.error("❌ Server Down:", e.message);
        process.exit(1);
    }

    // 2. Fetch Listings
    try {
        const listings = await axios.get(`${API_URL}/api/marketplace/listings`);
        console.log(`✅ Listings Endpoint: OK (${listings.data.listings?.length || 0} listings found)`);
    } catch (e) {
        console.error("❌ Listings Endpoint Failed:", e.message);
    }

    // 3. Attempt List Transaction Generation
    // We need a valid invoice ID. This is tricky without knowing one. 
    // We'll skip this if we can't find a sent invoice easily, or we can query the DB if we had access.
    // For now, let's just create a mock request that *fails* validation but proves the endpoint is up.
    try {
        await axios.post(`${API_URL}/api/marketplace/list`, {
            invoiceId: "invalid-id",
            askingPrice: "100",
            expiresInDays: 30
        });
    } catch (e: any) {
        if (e.response) {
            console.log(`✅ List Endpoint: Responsive (Status ${e.response.status} - ${e.response.data?.message || e.response.data?.error})`);
            // If it returns 404 Invoice not found or 400, that's GOOD. It means it's running.
        } else {
            console.error("❌ List Endpoint Unreachable:", e.message);
        }
    }

    // 4. Attempt Purchase Transaction Generation
    try {
        await axios.post(`${API_URL}/api/marketplace/purchase`, {
            listingId: "invalid-id"
        });
    } catch (e: any) {
        if (e.response) {
            console.log(`✅ Purchase Endpoint: Responsive (Status ${e.response.status} - ${e.response.data?.message || e.response.data?.error})`);
        } else {
            console.error("❌ Purchase Endpoint Unreachable:", e.message);
        }
    }
}

verifyMarketplace();
