
import { db } from "./db";
import { payments, paymentReceiptNFTs, invoices, specialNFTMints, invoiceMarketplace } from "@shared/invoice-schema";
import { eq, sql, and } from "drizzle-orm";
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
            paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
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
            // Create new payment record
            const [newPayment] = await db.insert(payments).values(paymentData).returning();
            paymentRecord = newPayment;
            logger.info(`Payment recorded: ${newPayment.id}`, "payment");

            // 4. Update Invoice: Decrease remaining amount
            const currentRemaining = parseFloat(invoice.remainingAmount);
            const paidAmount = parseFloat(paymentRecord.amount);
            const newRemaining = Math.max(0, currentRemaining - paidAmount).toString();
            const newStatus = newRemaining === "0" ? "paid" : "sent";

            await db.update(invoices)
                .set({
                    remainingAmount: newRemaining,
                    status: newStatus,
                    paidAmount: (parseFloat(invoice.paidAmount || "0") + paidAmount).toString()
                })
                .where(eq(invoices.id, invoiceId));

            // === MARKETPLACE INTEGRATION: AUTO-CANCEL LISTINGS ===
            // If the invoice was listed, the listing is now invalid due to value change.
            // We must CANCEL the listing and RETURN the NFT to the seller.
            const [activeListing] = await db.select()
                .from(invoiceMarketplace)
                .where(and(
                    eq(invoiceMarketplace.invoiceId, invoiceId),
                    eq(invoiceMarketplace.status, 'active')
                ))
                .limit(1);

            if (activeListing) {
                logger.warn(`Payment received for Listed Invoice ${invoiceId}. Auto-cancelling listing...`, "marketplace");

                // 1. Mark as cancelled in DB
                await db.update(invoiceMarketplace)
                    .set({ status: 'cancelled', updatedAt: new Date() })
                    .where(eq(invoiceMarketplace.id, activeListing.id));

                // 2. Return NFT from Escrow (Server) to Seller
                // Only if we hold the NFT (which we should if status was active)
                if (invoice.nftMint && invoice.nftMerkleTree && invoice.nftLeafIndex !== null) {
                    try {
                        const nftService = getInvoiceNFTService();
                        if (!nftService.isReady()) await nftService.initialize();

                        // Server is Escrow Agent (Leaf Owner). Seller is original owner.
                        // We transfer back to Seller.
                        await nftService.transferInvoiceNFT(
                            invoice.nftMint,
                            invoice.nftMerkleTree,
                            invoice.nftLeafIndex,
                            nftService.getIdentityPublicKey(), // From Server (Escrow)
                            activeListing.seller // To Seller
                        );
                        logger.info(`Auto-returned NFT to seller ${activeListing.seller}`, "marketplace");

                        // Revert invoice status to what it should be (sent or paid)
                        // The update above already set it to 'sent' or 'paid' based on remaining amount.
                        // But listing cancellation often sets it to 'sent'. We ensure it respects 'paid' if fully paid.
                        if (newStatus === 'paid') {
                            // If paid, keep as paid. NFT is now in Seller's wallet as a "Paid Invoice" souvenir/record.
                            // Or we could burn it. For now, returning it is safer.
                        } else {
                            // If partial payment, it remains 'sent'.
                            await db.update(invoices)
                                .set({ status: 'sent' }) // Ensure it's not 'listed'
                                .where(eq(invoices.id, invoiceId));
                        }

                    } catch (err) {
                        logger.error("Failed to auto-return NFT for cancelled listing", "marketplace", { error: err });
                        // Critical Alert: NFT is stuck in Escrow but Listing is Cancelled.
                        // This requires manual intervention or a recovery script.
                    }
                }
            }
        }


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
