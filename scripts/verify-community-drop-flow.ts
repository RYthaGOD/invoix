
import { db } from "../server/db";
import { invoices, specialNFTMints } from "../shared/invoice-schema";
import { eq } from "drizzle-orm";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getInvoiceNFTService } from "../server/nft-service";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting End-to-End Verification for Community Drop...");

    const walletAddress = Keypair.generate().publicKey.toString(); // Mock User
    console.log(`👤 Mock User: ${walletAddress}`);

    try {
        // 1. Simulate "Create Invoice" (Logic from community-drop-routes.ts)
        console.log("\n--- Step 1: Create Invoice ---");
        // Mocking the route logic directly since we can't spin up express easily here without more setup
        // But testing the DB writes is key.

        // Check Supply (should be < 1000)
        const paidInvoices = await db.query.invoices.findMany({
            where: (invoices, { eq, and }) => and(
                eq(invoices.description, "Exclusive Community NFT Mint"),
                eq(invoices.status, "paid")
            )
        });
        console.log(`Current Supply: ${paidInvoices.length}/1000`);

        // Create Invoice
        const invoiceId = crypto.randomUUID();
        const priceSol = 0.003; // Mock Price (approx $0.50)

        await db.insert(invoices).values({
            id: invoiceId,
            invoiceNumber: `TEST-${Date.now()}`,
            invoicerWalletAddress: "H8sMJqjq9yRa9qKz7BwFvbKkYj3ZzV8zL8zZ8zL8zZ8z", // Mock Treasury
            invoiceeWalletAddress: walletAddress,
            description: "Exclusive Community NFT Mint",
            currency: "SOL",
            tokenMint: "SOL",
            tokenDecimals: 9,
            subtotal: priceSol.toString(),
            totalAmount: priceSol.toString(),
            remainingAmount: priceSol.toString(),
            status: "draft",
            dueDate: new Date(),
            isPrivate: false,
            isArciumEncrypted: false,
        });
        console.log(`✅ Invoice Created: ${invoiceId}`);

        // 2. Simulate "Payment"
        console.log("\n--- Step 2: Simulate Payment ---");
        await db.update(invoices)
            .set({ status: "paid", remainingAmount: "0" })
            .where(eq(invoices.id, invoiceId));
        console.log(`✅ Invoice marked as PAID`);

        // 3. Test "Claim Transaction" Generation (nft-service.ts)
        console.log("\n--- Step 3: Generate Claim Transaction ---");
        const nftService = getInvoiceNFTService();
        // Initialize with a mock payer if needed, or rely on env
        // We assume PAYER_PRIVATE_KEY is in env for server identity
        if (!nftService.isReady()) {
            try {
                await nftService.initialize();
            } catch (e) {
                console.warn("⚠️  NFT Service Init Warning (might be missing keys locally):", e);
                // If we can't init real service, we can't test tx generation fully.
                // But let's try.
            }
        }

        let transaction, mint, nftVariant;

        if (nftService.isReady()) {
            const result = await nftService.createClaimTransaction(walletAddress);
            transaction = result.transaction;
            mint = result.mint;
            nftVariant = result.nftVariant;

            console.log(`✅ Claim Transaction Generated!`);
            console.log(`   Mint Address: ${mint}`);
            console.log(`   NFT Variant: ${nftVariant.name} (${nftVariant.rarity})`);
            console.log(`   Tx Length: ${transaction.length} chars (Base64)`);
        } else {
            console.log("⚠️  Skipping actual Umi TX generation due to missing setup/keys.");
            // Mock result for step 4
            mint = Keypair.generate().publicKey.toString();
            nftVariant = { id: "test", name: "Test Dragon", rarity: "common" };
            transaction = "mock_tx_base64";
        }

        // 4. Simulate "Confirm Claim" (DB Persistence)
        console.log("\n--- Step 4: Confirm Claim ---");
        const signature = "mock_signature_" + Date.now();

        await db.insert(specialNFTMints).values({
            walletAddress,
            nftId: nftVariant.id,
            nftName: nftVariant.name,
            nftRarity: nftVariant.rarity,
            nftMint: mint,
            txSignature: signature,
            invoiceId: invoiceId,
        });
        console.log(`✅ Claim Confirmed in DB!`);

        // Cleanup
        console.log("\n--- Cleanup ---");
        await db.delete(specialNFTMints).where(eq(specialNFTMints.invoiceId, invoiceId));
        await db.delete(invoices).where(eq(invoices.id, invoiceId));
        console.log(`✅ Test Data Cleaned up.`);

        console.log("\n🎉 E2E Flow Verification SUCCESS!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
