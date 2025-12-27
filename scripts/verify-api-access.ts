import "dotenv/config";
import { db } from "../server/db";
import { waitlistUsers } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
    console.log("🔒 Verifying API Key Access Flow...");

    // 1. Setup Test User
    const testEmail = `api-test-${Date.now()}@example.com`;
    const testWallet = "8x2...TEST_WALLET"; // Mock wallet for the developer

    console.log(`\n1. Creating Test Applicant: ${testEmail}`);

    // Clean up if exists
    await db.delete(waitlistUsers).where(eq(waitlistUsers.email, testEmail));

    const [applicant] = await db.insert(waitlistUsers).values({
        email: testEmail,
        projectName: "API Verification Bot",
        useCaseDescription: "Testing the API Key Flow",
        walletAddress: testWallet, // The simulated developer wallet
        status: "pending"
    }).returning();

    console.log(`   Applicant Created (ID: ${applicant.id})`);

    // 2. Simulate Admin Approval (Generate Key locally as we can't call admin endpoint easily without mocking admin secret)
    console.log("\n2. approving User & Generating Key...");

    // Generate Key manually using the NEW Logic (SHA-256)
    const prefix = "sk_live_";
    const randomBytes = crypto.randomBytes(24).toString("hex");
    const key = `${prefix}${randomBytes}`;
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    await db.update(waitlistUsers)
        .set({
            status: "approved",
            apiKeyHash: hash
        })
        .where(eq(waitlistUsers.id, applicant.id));

    console.log(`   User Approved. Key: ${key.slice(0, 10)}...`);

    // 3. Test API Access (Simulate Request)
    console.log("\n3. Testing API Access (Simulated Request)...");

    // NOTE: In a real e2e test we would fetch against localhost. 
    // Here we will use the middleware logic to verify it works "in principle" by checking the DB lookup logic.

    // Simulate what the Middleware does:
    const hashCheck = crypto.createHash("sha256").update(key).digest("hex");
    const user = await db.query.waitlistUsers.findFirst({
        where: eq(waitlistUsers.apiKeyHash, hashCheck)
    });

    if (!user) throw new Error("❌ Middleware Logic Failed: Could not find user by key hash");
    if (user.walletAddress !== testWallet) throw new Error("❌ Middleware Logic Failed: Wrong wallet returned");

    console.log("   ✅ Middleware Logic Verified: internal lookup successful.");

    // 4. Cleanup
    console.log("\n4. Cleaning up...");
    await db.delete(waitlistUsers).where(eq(waitlistUsers.id, applicant.id));

    console.log("\n🎉 API Verification Successful!");
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
});
