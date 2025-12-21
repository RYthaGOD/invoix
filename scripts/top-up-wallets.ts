import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const TREASURY_WALLET = "jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38";

async function airdrop(address: string, label: string) {
    try {
        console.log(`\n💧 Requesting Airdrop for ${label} (${address})...`);
        const pubkey = new PublicKey(address);

        // Check balance first
        const balance = await connection.getBalance(pubkey);
        console.log(`   Initial Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

        // Cap at reasonable amount to avoid rate limits if repeatedly run
        if (balance > 1 * LAMPORTS_PER_SOL) {
            console.log(`   ✅ Sufficient balance (> 1 SOL). Skipping airdrop.`);
            return;
        }

        const signature = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
        console.log(`   ⏳ Confirming tx: ${signature}...`);
        await connection.confirmTransaction(signature);

        const newBalance = await connection.getBalance(pubkey);
        console.log(`   🎉 New Balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
    }
}

async function main() {
    console.log(`Top-Up Script initializing... RPC: ${RPC_URL}`);

    // Server Fee Payer ONLY
    const payerPrivKey = process.env.PAYER_PRIVATE_KEY;
    if (payerPrivKey) {
        try {
            let keypair;
            if (payerPrivKey.startsWith("[")) {
                keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(payerPrivKey)));
            } else {
                keypair = Keypair.fromSecretKey(bs58.decode(payerPrivKey));
            }
            const address = keypair.publicKey.toString();
            console.log(`\n🎯 TARGET: Server Fee Payer: ${address}`);

            // Attempt Airdrop
            await airdrop(address, "Server Fee Payer");

            console.log(`\n💡 If this fails, please paste address ${address} into https://faucet.solana.com`);

        } catch (e: any) {
            console.error("   ❌ Invalid PAYER_PRIVATE_KEY format: " + e.message);
        }
    } else {
        console.log("\n⚠️  No PAYER_PRIVATE_KEY found in env.");
    }
}

main();
