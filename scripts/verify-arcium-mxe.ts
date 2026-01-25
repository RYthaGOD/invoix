
import "dotenv/config";
import { getArciumOnChainService } from "../server/arcium-onchain-service";
import { PublicKey } from "@solana/web3.js";

async function verifyMxe() {
    console.log("🦾 Verifying Arcium MXE On-Chain Service Logic...");

    const service = getArciumOnChainService();
    // System Program ID as Authority
    const authority = new PublicKey("11111111111111111111111111111111");
    const invoiceId = "TEST-VERIFY-MXE";

    console.log(`   Authority: ${authority.toString()}`);
    console.log(`   Invoice ID: ${invoiceId}`);

    try {
        console.log("   Invoking deriveInvoicePda...");
        const [pda, bump] = service.deriveInvoicePda(authority, invoiceId);
        console.log(`   ✅ PDA Derived: ${pda.toString()} (bump: ${bump})`);

        const preview = service.getInvoicePdaPreview(authority.toString(), invoiceId);
        console.log(`   ✅ Preview Matches: ${preview === pda.toString()}`);

        if (preview !== pda.toString()) {
            throw new Error("Preview mismatch");
        }

    } catch (error: any) {
        console.error("❌ Failed:", error);
        process.exit(1);
    }

    console.log("✨ Arcium MXE Logic Verified successfully.");
}

verifyMxe();
