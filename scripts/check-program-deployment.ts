
import { Connection, PublicKey } from "@solana/web3.js";
import "dotenv/config";

async function checkDeployment() {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Default from codebase
    const programIdStr = process.env.ARCIUM_PROGRAM_ID || "5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe";
    console.log(`🔍 Checking Program Deployment on ${rpcUrl}...`);
    console.log(`   Program ID: ${programIdStr}`);

    try {
        const pubkey = new PublicKey(programIdStr);
        const account = await connection.getAccountInfo(pubkey);

        if (account) {
            console.log("✅ Program Account Found!");
            console.log(`   Executable: ${account.executable}`);
            console.log(`   Data Length: ${account.data.length} bytes`);
            console.log(`   Owner: ${account.owner.toString()}`);

            if (account.executable) {
                console.log("\n✨ CONCLUSION: Arcium MXE is DEPLOYED and executable.");
            } else {
                console.log("\n⚠️  CONCLUSION: Account exists but is NOT executable (might be a buffer or just a wallet).");
            }
        } else {
            console.log("\n❌ CONCLUSION: Program Account NOT FOUND on this network.");
            console.log("   Action Required: Deploy the program via Anchor or update .env with correct ID.");
        }

    } catch (e: any) {
        console.error("❌ Error checking program:", e.message);
    }
}

checkDeployment();
