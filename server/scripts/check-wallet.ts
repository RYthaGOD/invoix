
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadKeypairFromPrivateKey } from "../arcium-service";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function checkWallet() {
    console.log("🔍 Protocol Wallet Inspector");
    console.log("----------------------------");

    if (!process.env.PAYER_PRIVATE_KEY) {
        console.error("❌ Error: PAYER_PRIVATE_KEY not found in environment.");
        process.exit(1);
    }

    // Connect
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Load Wallet
    const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
    const address = payerKeypair.publicKey.toString();

    console.log(`Address:  ${address}`);
    console.log(`RPC URL:  ${rpcUrl}`);

    try {
        const balance = await connection.getBalance(payerKeypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        console.log(`Balance:  ${solBalance} SOL`);

        if (solBalance < 0.05) {
            console.log(`\n⚠️  Low Balance Warning: Balance is below 0.05 SOL.`);
            console.log(`   Please fund this execute transactions.`);
        } else {
            console.log(`\n✅ Status: Healthy (Ready for ${(solBalance / 0.000005).toFixed(0)} txs)`);
        }

    } catch (error: any) {
        console.error("\n❌ Error fetching balance:", error.message);
    }
}

checkWallet().catch(console.error);
