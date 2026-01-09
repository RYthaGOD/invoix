
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { loadKeypairFromPrivateKey } from "../arcium-service";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../logger";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function checkWallet() {
    logger.info("Protocol Wallet Inspector", "wallet-check");

    if (!process.env.PAYER_PRIVATE_KEY) {
        logger.error("PAYER_PRIVATE_KEY not found in environment.", "wallet-check");
        process.exit(1);
    }

    // Connect
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Load Wallet
    const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
    const address = payerKeypair.publicKey.toString();

    logger.info("Wallet details", "wallet-check", { address, rpcUrl });

    try {
        const balance = await connection.getBalance(payerKeypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        logger.info("Wallet balance", "wallet-check", {
            balance: `${solBalance} SOL`,
            status: solBalance < 0.05 ? "low" : "healthy",
            estimatedTxs: (solBalance / 0.000005).toFixed(0)
        });

        if (solBalance < 0.05) {
            logger.warn("Low balance warning", "wallet-check", {
                balance: solBalance,
                threshold: 0.05,
                message: "Please fund this wallet to execute transactions"
            });
        }

    } catch (error: any) {
        logger.error("Error fetching balance", "wallet-check", { error: error.message });
    }
}

checkWallet().catch(console.error);
