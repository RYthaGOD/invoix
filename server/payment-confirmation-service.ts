
import { db } from "./db";
import { payments, paymentReceiptNFTs, invoices, specialNFTMints } from "@shared/invoice-schema";
import { eq, sql } from "drizzle-orm";
import { getInvoiceNFTService } from "./nft-service";
import { invoiceStorage } from "./invoice-storage";
import { Connection } from "@solana/web3.js";
import crypto from "crypto";
import { verifyStablecoinPayment } from "./stablecoin-payment-service";
import { logger } from "./logger";

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

/**
 * Handles post-payment logic:
 * 1. Waits for confirmation
 * 2. Updates Payment Status in DB
 * 3. Mints Receipt NFT
 */
export async function confirmPaymentAndMintOutcome(signature: string, invoiceId: string, payerAddress: string) {
    try {
        logger.info(`Confirming payment ${signature} for invoice ${invoiceId}...`, "payment");

        // 1. Confirm Transaction with explicit timeout (30 seconds max)
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");

        // Use Promise.race for timeout control
        const confirmationPromise = connection.confirmTransaction({
            signature,
            ...latestBlockhash
        }, "confirmed");

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Confirmation timeout")), 30000)
        );

        try {
            await Promise.race([confirmationPromise, timeoutPromise]);
        } catch (timeoutErr: any) {
            // If timeout, check if transaction was actually confirmed
            const status = await connection.getSignatureStatus(signature);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                logger.info("Transaction confirmed via fallback check", "payment");
            } else {
                throw timeoutErr;
            }
        }

        logger.info("Confirmed! Updating DB...", "payment");

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
            logger.error(`Security Alert: Payment verification failed for ${signature}`, "security", { error: verification.error });
            // Stop processing - do not update DB, do not mint NFT
            return;
        }

        logger.info(`Verified amount: ${verification.amount} ${verification.currency}`, "payment");

        // 3. Check if payment already exists (recorded by relay endpoint for fast UI)
        // If it exists, we skip creation but continue to NFT minting
        const existingPayments = await db.select()
            .from(payments)
            .where(eq(payments.txSignature, signature))
            .limit(1);

        let paymentRecord = existingPayments[0];
        let paymentAlreadyExists = !!paymentRecord;

        const paymentData = {
            invoiceId: invoiceId,
            amount: invoice.remainingAmount,
            currency: invoice.currency,
            txSignature: signature,
            fromAddress: payerAddress,
            toAddress: invoice.invoicerWalletAddress,
            status: "confirmed",
            confirmedAt: new Date(),
        };

        if (paymentAlreadyExists) {
            logger.info(`Payment already recorded for ${signature}, skipping creation`, "payment");

            // Check if NFT was already minted for this payment
            if (paymentRecord.nftReceiptMinted) {
                logger.info(`NFT already minted for payment ${signature}, skipping entire process`, "nft");
                return; // Fully idempotent - everything already done
            }
        } else {
            // Create payment record
            try {
                paymentRecord = await invoiceStorage.createPayment(paymentData as any);
                logger.info(`Payment recorded for ${signature}`, "payment");
            } catch (e: any) {
                if (e.message?.includes("already")) {
                    logger.info(`Race condition: Payment created by another process for ${signature}`, "payment");
                    // Refetch to get the record for NFT check
                    const refetch = await db.select().from(payments).where(eq(payments.txSignature, signature)).limit(1);
                    paymentRecord = refetch[0];
                    if (paymentRecord?.nftReceiptMinted) {
                        return; // Already fully processed
                    }
                } else {
                    throw e;
                }
            }
        }

        // Note: invoiceStorage.createPayment automatically updates invoice status

        // 5. Special Logic: Community NFT Drop
        if (invoice.description === "Exclusive Community NFT Mint") {
            logger.info("Community Drop Payment Detected! Checking for existing mint...", "payment");

            // FIX: Check if wallet already has a special NFT (1 per wallet limit)
            const existingWalletMint = await db.select()
                .from(specialNFTMints)
                .where(eq(specialNFTMints.walletAddress, payerAddress))
                .limit(1);

            if (existingWalletMint.length > 0) {
                logger.info(`Wallet ${payerAddress} already owns a Community NFT, skipping`, "nft");
                return;
            }

            // FIX R2-3: Check if NFT already minted for this invoice
            const existingMint = await db.select()
                .from(specialNFTMints)
                .where(eq(specialNFTMints.invoiceId, invoiceId))
                .limit(1);

            if (existingMint.length > 0) {
                logger.info(`NFT already minted for invoice ${invoiceId}, skipping`, "nft");
                return;
            }

            const nftService = getInvoiceNFTService();
            const isReady = await waitForNftService(nftService);

            if (isReady) {
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
                    logger.debug("Current rarity distribution", "nft", mintedCounts);

                    // Check total supply limit (1000 max)
                    const totalMinted = Object.values(mintedCounts).reduce((sum, count) => sum + count, 0);
                    if (totalMinted >= 1000) {
                        logger.info(`Collection sold out! Total minted: ${totalMinted}/1000`, "nft");
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

                    logger.info(`Special NFT Airdropped to ${payerAddress} (${result.nftVariant.rarity})`, "nft");
                } catch (mintError) {
                    logger.error("Failed to mint special NFT", "nft", { error: mintError });
                }
            } else {
                logger.warn(`Skipped Special NFT mint for ${invoiceId} - NFT Service not ready after retries`, "nft");
            }
            return;
        }

        // 6. Standard Receipt NFT
        logger.info("Minting Receipt NFT...", "nft");
        const nftService = getInvoiceNFTService();
        const isReady = await waitForNftService(nftService);

        if (isReady) {

            // Construct the payment object expected by the service
            // We use 'as any' safely here because paymentData matches the DB schema expected by SelectPayment
            const receiptResult = await nftService.mintPaymentReceiptNFT({
                payment: paymentData as any,
                invoice: invoice,
                recipientAddress: payerAddress
            });

            logger.info(`Receipt Minted: ${receiptResult.mint}`, "nft");

            // Update payment record to track success
            await db.update(payments)
                .set({ nftReceiptMinted: true })
                .where(eq(payments.txSignature, signature));

            logger.info("Payment record updated with NFT success flag", "nft");
        } else {
            logger.warn(`Skipped Receipt NFT mint for invoice ${invoiceId} - NFT Service not ready after retries`, "nft");
        }

    } catch (error) {
        logger.error(`Error confirming/minting for ${signature}`, "payment", { error });
    }
}

/**
 * Helper: Waits for NFT service to be ready (Merkle tree loaded)
 * Retries 5 times with 2 second delay.
 */
async function waitForNftService(service: any): Promise<boolean> {
    if (service.isReady()) return true;

    logger.info("NFT Service not ready, waiting...", "nft");

    for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
        if (service.isReady()) {
            logger.info("NFT Service became ready!", "nft");
            return true;
        }
        logger.debug(`Waiting for NFT service... attempt ${i + 1}/5`, "nft");
    }

    return false;
}
