
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { loadKeypairFromPrivateKey } from "../arcium-service";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../logger";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

async function checkUSDC() {
    logger.info("Treasury Wallet Verification (Devnet USDC)", "usdc-check");

    if (!process.env.PAYER_PRIVATE_KEY) {
        logger.error("PAYER_PRIVATE_KEY not found in environment", "usdc-check");
        process.exit(1);
    }

    // Connect to Devnet
    const rpcUrl = "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Load Wallet
    const payerKeypair = loadKeypairFromPrivateKey(process.env.PAYER_PRIVATE_KEY);
    const address = payerKeypair.publicKey;

    logger.info("Wallet configuration", "usdc-check", {
        walletAddress: address.toString(),
        network: "Devnet",
        usdcMint: DEVNET_USDC_MINT.toString()
    });

    try {
        // 1. Check SOL Balance
        const solBalance = await connection.getBalance(address);
        logger.info("SOL Balance", "usdc-check", {
            balance: `${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
        });

        // 2. Check USDC Balance
        const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, address);

        try {
            const tokenAccount = await getAccount(connection, ata);
            const mintInfo = await getMint(connection, DEVNET_USDC_MINT);
            const amount = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);

            logger.info("USDC Balance", "usdc-check", {
                balance: `${amount.toLocaleString()} USDC`,
                status: amount < 1000 ? "low" : "sufficient"
            });

            if (amount < 1000) {
                logger.warn("Low USDC balance", "usdc-check", {
                    balance: amount,
                    threshold: 1000,
                    message: "Faucet might fail for users"
                });
            }

        } catch (e: any) {
            if (e.name === "TokenAccountNotFoundError") {
                logger.info("USDC Balance", "usdc-check", {
                    balance: "0 USDC",
                    note: "Token Account not created"
                });
            } else {
                logger.error("Error fetching USDC balance", "usdc-check", { error: e.message });
            }
        }

    } catch (error: any) {
        logger.error("Error checking USDC balance", "usdc-check", { error: error.message });
    }
}

checkUSDC().catch(console.error);
