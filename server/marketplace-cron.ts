
import { db, schema } from "./db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";

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

    } catch (error) {
        logger.error("Error checking expired listings", "cron", { error });
    }
}

let cronInterval: NodeJS.Timeout | null = null;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // Run every 1 hour

export function startMarketplaceCron() {
    if (cronInterval) return;

    logger.info("Starting Marketplace Expiry Cron Job...", "cron");

    // Initial check after 1 min to allow server startup
    setTimeout(() => checkExpiredListings(), 60000);

    cronInterval = setInterval(() => {
        checkExpiredListings();
    }, CRON_INTERVAL_MS);
}

export function stopMarketplaceCron() {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
}
