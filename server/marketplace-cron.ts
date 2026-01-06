
import { db } from "./db";
import { invoiceMarketplace, invoices } from "@shared/invoice-schema";
import { eq, and, lt } from "drizzle-orm";
import { getInvoiceNFTService } from "./nft-service";
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
            .from(invoiceMarketplace)
            .where(and(
                eq(invoiceMarketplace.status, 'active'),
                lt(invoiceMarketplace.expiresAt, now)
            ));

        if (expiredListings.length === 0) return;

        logger.info(`Found ${expiredListings.length} expired listings. Processing returns...`, "cron");

        const nftService = getInvoiceNFTService();
        if (!nftService.isReady()) {
            logger.warn("NFT Service not ready for expired listing cleanup", "cron");
            return;
        }

        const escrowAddress = nftService.getIdentityPublicKey();

        for (const listing of expiredListings) {
            try {
                // Get Invoice details for NFT data
                const [invoice] = await db.select()
                    .from(invoices)
                    .where(eq(invoices.id, listing.invoiceId))
                    .limit(1);

                if (!invoice || !invoice.nftMint || !invoice.nftMerkleTree || invoice.nftLeafIndex === null) {
                    logger.error(`Critical: Missing NFT data for expired listing ${listing.id}`, "cron");
                    continue;
                }

                logger.info(`Returning expired NFT for listing ${listing.id} to ${listing.seller}`, "cron");

                // 1. Return NFT from Escrow (Server) to Seller
                await nftService.transferInvoiceNFT(
                    invoice.nftMint,
                    invoice.nftMerkleTree,
                    invoice.nftLeafIndex,
                    escrowAddress, // From (Server/Escrow)
                    listing.seller // To (Original Seller)
                );

                // 2. Update DB Status
                await db.update(invoiceMarketplace)
                    .set({ status: 'expired', updatedAt: new Date() })
                    .where(eq(invoiceMarketplace.id, listing.id));

                // 3. Update Invoice Status back to 'sent' (or 'paid' if logic differs, but usually returning to inventory = sent/unpaid)
                // If it was 'listed', it goes back to 'sent'.
                await db.update(invoices)
                    .set({ status: 'sent' })
                    .where(eq(invoices.id, listing.invoiceId));

                logger.info(`Successfully returned expired item ${listing.id}`, "cron");

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
