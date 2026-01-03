
import * as Sentry from "@sentry/node";
import 'dotenv/config';

// Hardcoded user DSN to verify (bypassing env if needed)
const DSN = process.env.SENTRY_DSN || "https://7ea22300882dad8a63be475a79e802d1@o4510641117134848.ingest.de.sentry.io/4510641131749456";

console.log("Testing Sentry Connection...");
console.log("DSN:", DSN);

Sentry.init({
    dsn: DSN,
    debug: true, // Enable debug mode to see http requests
    tracesSampleRate: 1.0,
});

async function runTest() {
    console.log("Sending test message...");
    const eventId = Sentry.captureMessage("Manual Sentry Test - CLI Script", "debug");
    console.log("Message captured. Event ID:", eventId);

    console.log("Sending test exception...");
    try {
        throw new Error("Sentry Connectivity Test Error (forced from script)");
    } catch (e) {
        Sentry.captureException(e);
    }

    console.log("Flushing events...");
    const flushed = await Sentry.close(5000);
    console.log("Flush result:", flushed ? "Success" : "Failed (Timeout)");
}

runTest();
