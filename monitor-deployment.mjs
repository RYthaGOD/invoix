
import fetch from "node-fetch";

const API_URL = "https://invoix-web-production.up.railway.app";
const HEALTH_ENDPOINT = `${API_URL}/health`;
const INTERVAL_MS = 5000; // Check every 5 seconds
const TIMEOUT_MINUTES = 5; // Monitor for 5 minutes

async function monitorHealth() {
    console.log(`🔍 Starting health monitor for: ${API_URL}`);
    console.log(`   Checking every ${INTERVAL_MS / 1000} seconds for ${TIMEOUT_MINUTES} minutes...`);

    const startTime = Date.now();
    let consecutiveFailures = 0;
    let successfulChecks = 0;

    const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > TIMEOUT_MINUTES * 60 * 1000) {
            console.log("\n✅ Monitoring period complete. System appears stable.");
            clearInterval(interval);
            return;
        }

        try {
            const response = await fetch(HEALTH_ENDPOINT);

            if (response.ok) {
                const data = await response.json();
                process.stdout.write("."); // Print dot for success
                consecutiveFailures = 0;
                successfulChecks++;
            } else {
                process.stdout.write("x"); // Print x for failure
                consecutiveFailures++;
                console.log(`\n⚠️  Health check returned status: ${response.status}`);
            }
        } catch (error) {
            process.stdout.write("E"); // Print E for error
            consecutiveFailures++;
            // Don't log full error every time to avoid spam
            if (consecutiveFailures === 1) {
                console.log(`\n❌ Connection error: ${error.message}`);
            }
        }

        if (consecutiveFailures >= 5) {
            console.log("\n\n🚨 ALERT: System appears to be down! (5 consecutive failures)");
            // Keep monitoring, might be restarting
        }

    }, INTERVAL_MS);
}

monitorHealth();
