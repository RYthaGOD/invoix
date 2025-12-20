import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config();

const pKeyString = process.env.PAYER_PRIVATE_KEY || "";

if (!pKeyString) {
    console.error("PAYER_PRIVATE_KEY is not set in environment variables");
    process.exit(1);
}

try {
    const keypair = Keypair.fromSecretKey(bs58.decode(pKeyString));
    const address = keypair.publicKey.toString();
    const connection = new Connection("https://api.mainnet-beta.solana.com");

    connection.getBalance(keypair.publicKey).then(balance => {
        console.log(`ADDRESS:${address}`);
        console.log(`BALANCE:${balance / LAMPORTS_PER_SOL}`);
        console.log(`REQUIRED:${0.012}`);
    });
} catch (e) { console.error(e); }
