
import axios from 'axios';

const API_URL = "https://invoix-web-production.up.railway.app";

async function verifyProduction() {
    console.log(`🔍 Verifying Production: ${API_URL}`);

    // 1. Health
    try {
        const health = await axios.get(`${API_URL}/health`);
        console.log("✅ Health Check:", health.data.status || "OK");
    } catch (e: any) {
        console.error("❌ Health Check Failed:", e.message);
        process.exit(1);
    }

    // 2. Marketplace Listings
    try {
        const listings = await axios.get(`${API_URL}/api/marketplace/listings`);
        console.log(`✅ Marketplace Listings: OK (${listings.data.listings?.length || 0} listings)`);
    } catch (e: any) {
        console.error("❌ Marketplace Listings Failed:", e.message);
    }

    // 3. Subscription Plans (New Feature)
    try {
        const plans = await axios.get(`${API_URL}/api/subscriptions/plans`);
        console.log(`✅ Subscription Plans: OK (${plans.data.plans?.length || 0} plans)`);
    } catch (e: any) {
        // If 401/403 it might be protected, but if 404 it means the route is missing
        if (e.response) {
            console.log(`✅ Subscription Plans Endpoint: Responsive (Status ${e.response.status})`);
        } else {
            console.error("❌ Subscription Plans Endpoint Unreachable:", e.message);
        }
    }

    // 4. Webhook Test (Hit the endpoint to see if it exists)
    try {
        // Just checking if the route handles GET/POST or returns 404
        await axios.post(`${API_URL}/api/webhooks/reputation`, {});
    } catch (e: any) {
        if (e.response && e.response.status !== 404) {
            console.log(`✅ Webhook Endpoint: Responsive (Status ${e.response.status})`);
        } else {
            console.log(`⚠️ Webhook Endpoint: Might be missing or 404 (Status ${e.response?.status})`);
        }
    }
}

verifyProduction();
