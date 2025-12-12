import 'dotenv/config';
import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";

async function checkBalance() {
    const key = process.env.PAYER_PRIVATE_KEY;
    if (!key) {
        console.log("STATUS: MISSING_KEY");
        return;
    }

    try {
        let secretKey: Uint8Array;
        if (key.includes('[') && key.includes(']')) {
            secretKey = new Uint8Array(JSON.parse(key));
        } else {
            secretKey = bs58.decode(key);
        }
        const kp = Keypair.fromSecretKey(secretKey);
        const address = kp.publicKey.toBase58();
        console.log(`Address: ${address}`);

        // Use mainnet-beta since user funded it with real SOL (implied by "real sol" in prompt)
        const connection = new Connection(clusterApiUrl("mainnet-beta"));
        const balance = await connection.getBalance(kp.publicKey);

        console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

        if (balance > 10000000) { // 0.01 SOL
            console.log("STATUS: FUNDED");
        } else {
            console.log("STATUS: LOW_BALANCE");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkBalance();
