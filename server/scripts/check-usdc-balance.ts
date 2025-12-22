
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { loadKeypairFromPrivateKey } from "../arcium-service";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

async function checkUSDC() {
    console.log("🔍 Treasury Wallet Verification (Devnet USDC)");
    console.log("-----------------------------------------");

    if (!process.env.PAYER_PRIVATE_KEY) {
        console.error("❌ Error: PAYER_PRIVATE_KEY not found in environment.");
        process.exit(1);
    }

    // Connect to Devnet
    const rpcUrl = "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Load Wallet
    const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
    const address = payerKeypair.publicKey;

    console.log(`Wallet Address: ${address.toString()}`);
    console.log(`Network:        Devnet`);
    console.log(`USDC Mint:      ${DEVNET_USDC_MINT.toString()}`);

    try {
        // 1. Check SOL Balance
        const solBalance = await connection.getBalance(address);
        console.log(`SOL Balance:    ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

        // 2. Check USDC Balance
        const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, address);

        try {
            const tokenAccount = await getAccount(connection, ata);
            const mintInfo = await getMint(connection, DEVNET_USDC_MINT);
            const amount = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);

            console.log(`USDC Balance:   ${amount.toLocaleString()} USDC`);

            if (amount < 1000) {
                console.log("\n⚠️  Low USDC Balance. Faucet might fail for users.");
            } else {
                console.log("\n✅ Sufficient USDC for Faucet.");
            }

        } catch (e: any) {
            if (e.name === "TokenAccountNotFoundError") {
                console.log(`USDC Balance:   0 USDC (Token Account not created)`);
            } else {
                console.log(`USDC Balance:   Error fetching (${e.message})`);
            }
        }

    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
    }
}

checkUSDC().catch(console.error);
