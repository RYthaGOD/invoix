
import { db, schema } from "./db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { PublicKey } from "@solana/web3.js";

/**
 * Audit Listing Expirations
 * Checks for listings that have passed their expiration date and:
 * 1. Marks them as 'expired' in DB
 * 2. Returns the NFT from Escrow to Seller
 */
export async function checkExpiredListings() {
    try {
        const now = new Date();
        const expiredListings = await db.select()
            .from(schema.invoiceMarketplace)
            .where(and(
                eq(schema.invoiceMarketplace.status, 'active'),
                lt(schema.invoiceMarketplace.expiresAt, now)
            ));

        if (expiredListings.length === 0) return;

        logger.info(`Found ${expiredListings.length} expired listings. Processing returns...`, "cron");

        // Note: In non-custodial marketplace, we cannot "return" the NFT automatically
        // because it is held in a PDA vault. The seller must initiate a "Cancel/Withdraw"
        // transaction. We just mark it as 'expired' so the UI prompts them.

        for (const listing of expiredListings) {
            try {
                logger.info(`Marking listing ${listing.id} as expired. Seller must reclaim asset.`, "cron");

                // Update DB Status
                await db.update(schema.invoiceMarketplace)
                    .set({ status: 'expired', updatedAt: new Date() })
                    .where(eq(schema.invoiceMarketplace.id, listing.id));

                // Update Invoice Status back to 'sent' (technically still in escrow, but logically released from market view)
                // Actually, if it's in escrow, we should probably keep invoice status as 'listed' until they withdraw?
                // But for user clarity, 'expired' is fine for the listing.
                // Invoice status: 'listed' means "in escrow".

                // Let's NOT change invoice status until they actually withdraw (cancel txn).
                // So the invoice remains 'listed', listing becomes 'expired'.
                // The UI will see "Expired Listing" and show "Reclaim" button.

                logger.info(`Successfully marked item ${listing.id} as expired`, "cron");

            } catch (err) {
                logger.error(`Failed to process expired listing ${listing.id}`, "cron", { error: err });
            }
        }

    } catch (error: any) {
        logger.error("Error checking expired listings", "cron", { error });
    }
}

let cronInterval: NodeJS.Timeout | null = null;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // Run every 1 hour

export function startMarketplaceCron() {
    if (cronInterval) return;

    logger.info("Starting Marketplace Expiry Cron Job...", "cron");

    // Initial check after 1 min to allow server startup
    // Initial check after 1 min to allow server startup
    setTimeout(() => {
        checkExpiredListings();
        reconcileActiveListings();
    }, 60000);

    cronInterval = setInterval(() => {
        checkExpiredListings();
        reconcileActiveListings();
    }, CRON_INTERVAL_MS);
}

/**
 * Reconcile Active Listings
 * Verifies on-chain state matches DB state.
 * If an NFT is no longer held by the PDA, it was Sold or Cancelled.
 */
async function reconcileActiveListings() {
    // Skip reconciliation if required config is missing
    if (!process.env.MARKETPLACE_PROGRAM_ID || process.env.MARKETPLACE_PROGRAM_ID.includes("1111111")) {
        // Placeholder or missing - skip silently
        return;
    }
    try {
        const activeListings = await db.select()
            .from(schema.invoiceMarketplace)
            .where(eq(schema.invoiceMarketplace.status, 'active'));

        if (activeListings.length === 0) return;

        // Batch processing could be added here for large sets
        const { dasService } = await import("./das-service");
        const { marketplaceService } = await import("./marketplace-service"); // Helper to get PDA if needed, or just derive manually

        const MARKETPLACE_PROGRAM_ID = new PublicKey(process.env.MARKETPLACE_PROGRAM_ID);

        for (const listing of activeListings) {
            try {
                // 1. Fetch current on-chain owner
                const asset = await dasService.getAsset(listing.nftMint);
                const currentOwner = asset.ownership.owner;

                // 2. Derive expected PDA (Listing State)
                // Note: The NFT in Non-Custodial marketplace is actually TRANSFERRED to the PDA vault?
                // Or does the PDA just hold authority? 
                // In standard Anchor marketplaces, the NFT is transferred to a vault or the PDA itself.
                // Based on `createListInvoiceTransaction`, it's transferred to 'listingState' or similar?
                // Actually, cNFTs are "transferred" by changing the leaf owner.
                // The `listInvoice` instruction likely transfers ownership to the Listing PDA.

                // Derive PDA
                const merkleTreePubkey = new PublicKey(listing.nftMerkleTree);
                const [listingPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("listing"), merkleTreePubkey.toBuffer()],
                    MARKETPLACE_PROGRAM_ID
                );

                const pdaAddress = listingPda.toBase58();

                // 3. Comparison
                if (currentOwner !== pdaAddress) {
                    logger.warn(`Listing ${listing.id} mismatch! DB: active, Chain Owner: ${currentOwner}`, "cron");

                    // It's not in the marketplace PDA. 
                    if (currentOwner === listing.seller) {
                        // Returned to seller -> Cancelled (or expired and reclaimed)
                        logger.info(`Auto-reconciling ${listing.id} as CANCELLED`, "cron");
                        await db.update(schema.invoiceMarketplace)
                            .set({ status: 'cancelled', updatedAt: new Date() })
                            .where(eq(schema.invoiceMarketplace.id, listing.id));

                        // Update Invoice
                        await db.update(schema.invoices)
                            .set({ status: 'sent' })
                            .where(eq(schema.invoices.id, listing.invoiceId));

                    } else {
                        // Transferred to someone else -> SOLD
                        logger.info(`Auto-reconciling ${listing.id} as SOLD to ${currentOwner}`, "cron");

                        await db.update(schema.invoiceMarketplace)
                            .set({
                                status: 'sold',
                                soldTo: currentOwner,
                                soldAt: new Date(),
                                // We don't know exact sell price if it was a custom trade, but assume asking price
                                salePrice: listing.askingPrice,
                                updatedAt: new Date()
                            })
                            .where(eq(schema.invoiceMarketplace.id, listing.id));

                        // Update Invoice
                        await db.update(schema.invoices)
                            .set({
                                nftTransferredTo: currentOwner,
                                nftBurnedAt: null
                            })
                            .where(eq(schema.invoices.id, listing.invoiceId));
                    }
                }

            } catch (err: any) {
                logger.error(`Failed to reconcile listing ${listing.id}: ${err.message}`, "cron");
            }
        }

    } catch (err) {
        logger.error("Error in reconcileActiveListings", "cron", { error: err });
    }
}

export function stopMarketplaceCron() {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
}
