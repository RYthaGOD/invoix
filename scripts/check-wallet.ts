import 'dotenv/config';
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";

// Simple helper to parse private key
function getWallet() {
    const key = process.env.PAYER_PRIVATE_KEY;
    if (!key) {
        console.log("STATUS: MISSING_KEY");
        return;
    }

    try {
        let secretKey: Uint8Array;
        if (key.includes('[') && key.includes(']')) {
            // Byte array format
            secretKey = new Uint8Array(JSON.parse(key));
        } else {
            // Base58 string format
            secretKey = bs58.decode(key);
        }
        const kp = Keypair.fromSecretKey(secretKey);
        const address = kp.publicKey.toBase58();
        console.log(`STATUS: FOUND`);
        // Write to file to avoid console truncation issues
        fs.writeFileSync('wallet_address.txt', address);
        console.log("Written to wallet_address.txt");
    } catch (err) {
        console.log("STATUS: INVALID_KEY");
        console.error(err);
    }
}

getWallet();
