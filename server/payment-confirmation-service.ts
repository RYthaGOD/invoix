
import { db } from "./db";
import { payments, paymentReceiptNFTs, invoices, specialNFTMints } from "@shared/invoice-schema";
import { eq, sql } from "drizzle-orm";
import { getInvoiceNFTService } from "./nft-service";
import { invoiceStorage } from "./invoice-storage";
import { Connection } from "@solana/web3.js";
import crypto from "crypto";
import { verifyStablecoinPayment } from "./stablecoin-payment-service";

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

/**
 * Handles post-payment logic:
 * 1. Waits for confirmation
 * 2. Updates Payment Status in DB
 * 3. Mints Receipt NFT
 */
export async function confirmPaymentAndMintOutcome(signature: string, invoiceId: string, payerAddress: string) {
    try {
        console.log(`[PAYMENT] Confirming payment ${signature} for invoice ${invoiceId}...`);

        // 1. Confirm Transaction
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            signature,
            ...latestBlockhash
        }, "confirmed");

        console.log(`[PAYMENT] Confirmed! Updating DB...`);

        // 2. Fetch Invoice Details
        const invoiceList = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
        if (!invoiceList.length) return;
        const invoice = invoiceList[0];

        // 2.5 STRICT VERIFICATION: Verify Amount and Recipient
        // Prevents "Pay Gas Only" attacks where a valid tx is sent but doesn't pay the invoice
        const verification = await verifyStablecoinPayment(
            connection,
            signature,
            invoice.remainingAmount, // Expected Amount (String)
            invoice.invoicerWalletAddress, // Expected Recipient
            invoice.currency
        );

        if (!verification.verified) {
            console.error(`[PAYMENT] Security Alert: Payment verification failed for ${signature}: ${verification.error}`);
            // Stop processing - do not update DB, do not mint NFT
            return;
        }

        console.log(`[PAYMENT] Verified amount: ${verification.amount} ${verification.currency}`);

        // 3. Insert Payment Record with idempotent duplicate detection
        // FIX R2-1: Use invoiceStorage.createPayment which checks for duplicate signatures
        const paymentData = {
            invoiceId: invoiceId,
            amount: invoice.remainingAmount, // Assuming full payment
            currency: invoice.currency,
            txSignature: signature,
            fromAddress: payerAddress,
            toAddress: invoice.invoicerWalletAddress,
            status: "confirmed",
            confirmedAt: new Date(),
        };

        try {
            await invoiceStorage.createPayment(paymentData as any);
        } catch (e: any) {
            if (e.message?.includes("already")) {
                console.log(`[PAYMENT] Duplicate payment detected for ${signature}, skipping`);
                return; // Idempotent - already processed
            }
            throw e;
        }

        // Note: invoiceStorage.createPayment automatically updates invoice status

        // 5. Special Logic: Community NFT Drop
        if (invoice.description === "Exclusive Community NFT Mint") {
            console.log(`[PAYMENT] Community Drop Payment Detected! Checking for existing mint...`);

            // FIX: Check if wallet already has a special NFT (1 per wallet limit)
            const existingWalletMint = await db.select()
                .from(specialNFTMints)
                .where(eq(specialNFTMints.walletAddress, payerAddress))
                .limit(1);

            if (existingWalletMint.length > 0) {
                console.log(`[NFT] Wallet ${payerAddress} already owns a Community NFT, skipping`);
                return;
            }

            // FIX R2-3: Check if NFT already minted for this invoice
            const existingMint = await db.select()
                .from(specialNFTMints)
                .where(eq(specialNFTMints.invoiceId, invoiceId))
                .limit(1);

            if (existingMint.length > 0) {
                console.log(`[NFT] NFT already minted for invoice ${invoiceId}, skipping`);
                return;
            }

            const nftService = getInvoiceNFTService();
            if (nftService.isReady()) {
                try {
                    // Query current minted counts by rarity for proper supply tracking
                    const rarityCounts = await db.select({
                        rarity: specialNFTMints.nftRarity,
                        count: sql<number>`count(*)::int`
                    }).from(specialNFTMints).groupBy(specialNFTMints.nftRarity);

                    const mintedCounts: Record<string, number> = {
                        common: 0,
                        uncommon: 0,
                        rare: 0,
                        epic: 0
                    };
                    for (const row of rarityCounts) {
                        if (row.rarity) {
                            mintedCounts[row.rarity] = row.count;
                        }
                    }
                    console.log(`[NFT] Current rarity distribution:`, mintedCounts);

                    // Check total supply limit (1000 max)
                    const totalMinted = Object.values(mintedCounts).reduce((sum, count) => sum + count, 0);
                    if (totalMinted >= 1000) {
                        console.log(`[NFT] Collection sold out! Total minted: ${totalMinted}/1000`);
                        return;
                    }

                    // Airdrop the Special NFT to the payer with proper rarity tracking
                    const result = await nftService.mintSpecialNFT(payerAddress, invoiceId, mintedCounts);

                    // Persist to DB for rarity tracking
                    await db.insert(specialNFTMints).values({
                        walletAddress: payerAddress,
                        nftId: result.nftVariant.id,
                        nftName: result.nftVariant.name,
                        nftRarity: result.nftVariant.rarity,
                        nftMint: result.mint,
                        txSignature: result.signature,
                        invoiceId: invoiceId,
                    });

                    console.log(`[NFT] Special NFT Airdropped to ${payerAddress} (${result.nftVariant.rarity})`);
                } catch (mintError) {
                    console.error("[NFT] Failed to mint special NFT:", mintError);
                }
            } else {
                console.warn(`[NFT] Skipped Special NFT mint for ${invoiceId} - NFT Service not ready (Merkle Tree not loaded)`);
            }
            return;
        }

        // 6. Standard Receipt NFT
        console.log(`[NFT] Minting Receipt NFT...`);
        const nftService = getInvoiceNFTService();
        if (nftService.isReady()) {

            // Construct the payment object expected by the service
            // We use 'as any' safely here because paymentData matches the DB schema expected by SelectPayment
            const receiptResult = await nftService.mintPaymentReceiptNFT({
                payment: paymentData as any,
                invoice: invoice,
                recipientAddress: payerAddress
            });

            console.log(`[NFT] Receipt Minted: ${receiptResult.mint}`);

            // Update payment record to track success
            await db.update(payments)
                .set({ nftReceiptMinted: true })
                .where(eq(payments.txSignature, signature));

            console.log(`[NFT] Payment record updated with NFT success flag`);
        } else {
            console.warn(`[NFT] Skipped Receipt NFT mint for invoice ${invoiceId} - NFT Service not ready`);
        }

    } catch (error) {
        console.error(`[PAYMENT] Error confirming/minting for ${signature}:`, error);
    }
}
