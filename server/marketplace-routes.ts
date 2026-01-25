/**
 * Invoice Marketplace Routes
 * 
 * API endpoints for the Invoice Marketplace where businesses can sell
 * unpaid invoices for immediate cash flow, and investors can purchase
 * them at a discount for yield.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db, schema } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { logger } from "./logger";
import { creditScoringService } from "./credit-scoring-service";
import { getInvoiceNFTService } from "./nft-service";

// ============================================
// TYPES
// ============================================

// Types moved to service

interface ListingRequest {
    invoiceId: string;
    askingPrice: string;
    description?: string;
    expiresInDays?: number;
    isBlind?: boolean;
}

// ============================================
// MIDDLEWARE
// ============================================

function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const walletAddress = (req.session as any)?.walletAddress;

    if (!walletAddress) {
        res.status(401).json({
            success: false,
            error: "Authentication required"
        });
        return;
    }

    next();
}

// ============================================
// RISK ASSESSMENT
// ============================================

// Risk Assessment moved to services/risk-engine
import { calculateRiskScore } from "./services/risk-engine";

function calculateYield(faceValue: string, askingPrice: string): number {
    const face = parseFloat(faceValue);
    const asking = parseFloat(askingPrice);
    if (asking <= 0 || face <= 0) return 0;
    return ((face - asking) / asking) * 100;
}

// ============================================
// ROUTES
// ============================================

export function registerMarketplaceRoutes(app: Express): void {

    /**
     * GET /api/marketplace/listings
     * Browse active marketplace listings
     */
    app.get("/api/marketplace/listings", async (req: Request, res: Response) => {
        try {
            const {
                currency,
                riskLevel,
                minYield,
                maxPrice,
                sortBy = 'listedAt',
                sortOrder = 'desc',
                limit = 20,
                offset = 0,
                status, // Optional status filter
                seller, // Optional seller filter
            } = req.query;

            // Build query
            let query = db.select({
                listing: schema.invoiceMarketplace,
                invoice: schema.invoices,
            })
                .from(schema.invoiceMarketplace)
                .innerJoin(schema.invoices, eq(schema.invoiceMarketplace.invoiceId, schema.invoices.id))
                .$dynamic();

            // Apply status filter (default to 'active' if not specified, unless seller is viewing their own history maybe? No, be explicit)
            if (status && status !== 'all') {
                query = query.where(eq(schema.invoiceMarketplace.status, status as string));
            } else if (!status || status === 'active') {
                // Default to active if not asking for 'all' or specific status
                // BUT if asking for a specific seller, we might want all by default? 
                // Let's stick to: if status NOT provided, default to active.
                // If status='all', no filter.
                if (status !== 'all') {
                    query = query.where(eq(schema.invoiceMarketplace.status, 'active'));
                }
            }

            // Apply Seller Filter
            if (seller) {
                query = query.where(eq(schema.invoiceMarketplace.seller, seller as string));
            }

            // Apply filters
            if (currency) {
                query = query.where(eq(schema.invoiceMarketplace.currency, currency as string));
            }

            if (riskLevel) {
                query = query.where(eq(schema.invoiceMarketplace.riskLevel, riskLevel as string));
            }

            if (minYield) {
                query = query.where(gte(schema.invoiceMarketplace.yieldPercentage, minYield as string));
            }

            if (maxPrice) {
                query = query.where(lte(schema.invoiceMarketplace.askingPrice, maxPrice as string));
            }

            // Apply sorting
            if (sortBy === 'price') {
                query = query.orderBy(sortOrder === 'asc'
                    ? schema.invoiceMarketplace.askingPrice
                    : desc(schema.invoiceMarketplace.askingPrice));
            } else if (sortBy === 'yield') {
                query = query.orderBy(sortOrder === 'asc'
                    ? schema.invoiceMarketplace.yieldPercentage
                    : desc(schema.invoiceMarketplace.yieldPercentage));
            } else if (sortBy === 'risk') {
                query = query.orderBy(sortOrder === 'asc'
                    ? schema.invoiceMarketplace.riskScore
                    : desc(schema.invoiceMarketplace.riskScore));
            } else {
                query = query.orderBy(desc(schema.invoiceMarketplace.listedAt));
            }

            // Apply pagination
            query = query.limit(Number(limit)).offset(Number(offset));

            const results = await query;

            // Privacy: Redact blind listings unless user is seller
            const listings = results.map(({ listing, invoice }) => {
                const isSeller = (req.session as any)?.walletAddress === listing.seller;
                const isBlindAndNotOwner = listing.isBlind && !isSeller;

                return {
                    id: listing.id,
                    invoiceNumber: isBlindAndNotOwner ? '🔒 CONFIDENTIAL' : invoice.invoiceNumber,
                    faceValue: isBlindAndNotOwner ? '0' : listing.faceValue, // Frontend handles 0 as Hidden/Blind
                    askingPrice: isBlindAndNotOwner ? '0' : listing.askingPrice,
                    discountRate: isBlindAndNotOwner ? '0' : listing.discountRate,
                    yieldPercentage: listing.yieldPercentage, // Visible hook
                    currency: listing.currency,
                    riskScore: listing.riskScore,
                    riskLevel: listing.riskLevel,
                    riskFlags: listing.riskFlags,
                    sellerCreditScore: listing.sellerCreditScore, // Visible trust signal
                    sellerCreditTier: listing.sellerCreditTier,
                    customerCreditScore: isBlindAndNotOwner ? null : listing.customerCreditScore, // Hide customer info in blind
                    dueDate: invoice.dueDate,
                    daysUntilDue: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                    listedAt: listing.listedAt,
                    expiresAt: listing.expiresAt,
                    viewCount: listing.viewCount,
                    description: isBlindAndNotOwner ? 'Confidential Listing. Request access to view details.' : listing.listingDescription,
                    isBlind: listing.isBlind,
                    // Privacy: Don't expose full wallet addresses
                    sellerTruncated: isBlindAndNotOwner ? '🔒 Private Seller' : (listing.seller.slice(0, 4) + '...' + listing.seller.slice(-4)),
                };
            });

            res.json({
                success: true,
                listings,
                count: listings.length,
                hasMore: listings.length === Number(limit),
            });
        } catch (error: any) {
            logger.error("Failed to fetch marketplace listings", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch listings" });
        }
    });

    /**
     * GET /api/marketplace/listings/:id
     * Get detailed listing information
     */
    app.get("/api/marketplace/listings/:id", async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const [result] = await db.select({
                listing: schema.invoiceMarketplace,
                invoice: schema.invoices,
            })
                .from(schema.invoiceMarketplace)
                .innerJoin(schema.invoices, eq(schema.invoiceMarketplace.invoiceId, schema.invoices.id))
                .where(eq(schema.invoiceMarketplace.id, id))
                .limit(1);

            if (!result) {
                return res.status(404).json({ success: false, error: "Listing not found" });
            }

            const { listing, invoice } = result;
            const walletAddress = (req.session as any)?.walletAddress;
            const isSeller = walletAddress === listing.seller;

            // Check Access Authorization for Blind Listings
            let hasAccess = isSeller; // Owner always has access
            let accessStatus = 'none'; // none, pending, approved, rejected

            if (listing.isBlind && !isSeller && walletAddress) {
                const [accessRequest] = await db.select()
                    .from(schema.marketplaceAccessRequests)
                    .where(and(
                        eq(schema.marketplaceAccessRequests.listingId, id),
                        eq(schema.marketplaceAccessRequests.buyerWallet, walletAddress)
                    ))
                    .limit(1);

                if (accessRequest) {
                    accessStatus = accessRequest.status;
                    if (accessRequest.status === 'approved') {
                        hasAccess = true;
                    }
                }
            }

            const isBlindAndRestricted = listing.isBlind && !hasAccess;

            // Increment view count
            await db.update(schema.invoiceMarketplace)
                .set({ viewCount: sql`${schema.invoiceMarketplace.viewCount} + 1` })
                .where(eq(schema.invoiceMarketplace.id, id));



            res.json({
                success: true,
                hasAccess, // Frontend uses this to show "Request Access" button
                accessStatus,
                listing: {
                    id: listing.id,
                    invoiceId: isBlindAndRestricted ? null : listing.invoiceId, // Hide invoice ID link
                    invoiceNumber: isBlindAndRestricted ? '🔒 CONFIDENTIAL' : invoice.invoiceNumber,
                    faceValue: isBlindAndRestricted ? '0' : listing.faceValue,
                    askingPrice: isBlindAndRestricted ? '0' : listing.askingPrice,
                    discountRate: isBlindAndRestricted ? '0' : listing.discountRate,
                    yieldPercentage: listing.yieldPercentage,
                    currency: listing.currency,
                    status: listing.status,
                    riskScore: listing.riskScore,
                    riskLevel: listing.riskLevel,
                    riskFlags: listing.riskFlags,
                    sellerCreditScore: listing.sellerCreditScore,
                    sellerCreditTier: listing.sellerCreditTier,
                    customerCreditScore: isBlindAndRestricted ? null : listing.customerCreditScore,
                    dueDate: invoice.dueDate,
                    invoiceDate: invoice.invoiceDate, // Maybe hide this too? logic: if blind, only yield/term matters
                    daysUntilDue: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                    listedAt: listing.listedAt,
                    expiresAt: listing.expiresAt,
                    viewCount: (listing.viewCount || 0) + 1,
                    watchlistCount: listing.watchlistCount,
                    description: isBlindAndRestricted ? 'Confidential Listing. Request access to view details.' : listing.listingDescription,
                    nftMint: isBlindAndRestricted ? null : listing.nftMint, // Hide Mint Address so they can't look up on-chain
                    // Privacy: Truncate addresses
                    seller: isBlindAndRestricted ? '🔒 Private Seller' : (listing.seller.slice(0, 4) + '...' + listing.seller.slice(-4)),
                    invoicee: isBlindAndRestricted ? '🔒 Hidden' : (invoice.invoiceeWalletAddress.slice(0, 4) + '...' + invoice.invoiceeWalletAddress.slice(-4)),
                    isBlind: listing.isBlind,
                },
            });
        } catch (error: any) {
            logger.error("Failed to fetch listing", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch listing" });
        }
    });

    // Helper to get initialized NFT service
    async function getReadyNftService() {
        const service = getInvoiceNFTService();
        if (!service.isReady()) {
            await service.initialize();
        }
        return service;
    }


    /**
     * POST /api/marketplace/list
     * List an invoice for sale on the marketplace
     * Returns a transaction for the Seller to sign (Transfer NFT to Escrow)
     */
    app.post("/api/marketplace/list", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { invoiceId, askingPrice, description, expiresInDays, isBlind = false } = req.body as ListingRequest;

            if (!invoiceId || !askingPrice) {
                return res.status(400).json({ success: false, error: "invoiceId and askingPrice are required" });
            }

            // Fetch the invoice
            const [invoice] = await db.select()
                .from(schema.invoices)
                .where(eq(schema.invoices.id, invoiceId))
                .limit(1);

            if (!invoice) {
                return res.status(404).json({ success: false, error: "Invoice not found" });
            }

            // Verify ownership
            // Important: If already listed (in escrow), checks passed. But here we assume fresh list.
            if (invoice.invoicerWalletAddress !== walletAddress) {
                return res.status(403).json({ success: false, error: "You can only list invoices you created" });
            }

            // Verify invoice status
            if (invoice.status !== 'sent') {
                // Allow re-listing if it was cancelled (status sent)
                // If it's paid, can't list.
                return res.status(400).json({
                    success: false,
                    error: `Invoice must be in 'sent' status to list. Current status: ${invoice.status}`
                });
            }

            // Verify invoice has NFT
            if (!invoice.nftMint) {
                return res.status(400).json({
                    success: false,
                    error: "Invoice must be minted as NFT before listing. Please mint the invoice first."
                });
            }

            // Check if already listed
            const [existingListing] = await db.select()
                .from(schema.invoiceMarketplace)
                .where(and(
                    eq(schema.invoiceMarketplace.invoiceId, invoiceId),
                    eq(schema.invoiceMarketplace.status, 'active')
                ))
                .limit(1);

            if (existingListing) {
                return res.status(400).json({ success: false, error: "Invoice is already listed on marketplace" });
            }

            // Validate asking price
            const faceValue = parseFloat(invoice.totalAmount);
            const asking = parseFloat(askingPrice);

            if (asking >= faceValue) {
                return res.status(400).json({
                    success: false,
                    error: "Asking price must be less than invoice face value"
                });
            }

            const discount = ((faceValue - asking) / faceValue) * 100;

            // Get credit scores & Risk
            const sellerScore = await creditScoringService.getQuickScore(walletAddress);
            const customerScore = await creditScoringService.getQuickScore(invoice.invoiceeWalletAddress);

            if (!sellerScore || sellerScore.score < 450) {
                return res.status(400).json({
                    success: false,
                    error: "Minimum credit score of 450 required to list."
                });
            }

            const risk = calculateRiskScore(invoice, sellerScore?.score || null, customerScore?.score || null);
            const yieldPct = calculateYield(invoice.totalAmount, askingPrice);

            const expiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : null;

            // 1. Generate Escrow Transfer Transaction (Non-Custodial List)
            const { marketplaceService } = await import("./marketplace-service");
            // Assuming we have the assetId (mint) and currency mint address
            // Need to look up currency mint address from config or DB
            const { getStablecoinConfig } = await import("@shared/stablecoin-config");
            const stablecoin = getStablecoinConfig(invoice.currency);

            if (!stablecoin) throw new Error("Unsupported currency " + invoice.currency);

            const transaction = await marketplaceService.createListInvoiceTransaction(
                walletAddress,
                invoiceId,
                invoice.nftMint, // Asset ID
                parseFloat(askingPrice) * Math.pow(10, stablecoin.decimals), // Convert to atomic units
                stablecoin.mint,
                (invoice as any).arciumInvoicePda // Arcium on-chain invoice account
            );

            // 2. Create Listing in DB (Active immediately, assuming user signs)
            // Ideally we'd mark it 'pending_transfer', but for this flow we'll handle it optimistically
            // or we could add a flag 'transferredToEscrow'.
            // Simple MVP: Create it. If they don't sign, it's a "Ghost Listing" (purchase will fail).
            // or we could add a flag 'transferredToEscrow'.

            // Handle riskFlags serialization for SQLite (stores as JSON string) vs PostgreSQL (native array)
            const riskFlagsValue = process.env.DATABASE_URL
                ? risk.flags  // PostgreSQL: native array
                : JSON.stringify(risk.flags) as any;  // SQLite: JSON string

            const [listing] = await db.insert(schema.invoiceMarketplace)
                .values({
                    invoiceId,
                    nftMint: invoice.nftMint,
                    nftMerkleTree: invoice.nftMerkleTree || '',
                    nftLeafIndex: invoice.nftLeafIndex || 0,
                    seller: walletAddress,
                    faceValue: invoice.totalAmount,
                    askingPrice,
                    discountRate: discount.toFixed(2),
                    currency: invoice.currency,
                    riskScore: risk.score,
                    riskLevel: risk.level,
                    riskFlags: riskFlagsValue,
                    sellerCreditScore: sellerScore?.score,
                    sellerCreditTier: sellerScore?.tier,
                    customerCreditScore: customerScore?.score || null,
                    suggestedFloorPrice: null,
                    yieldPercentage: yieldPct.toFixed(2),
                    status: 'active',
                    expiresAt,
                    listingDescription: description,
                    isBlind,
                })
                .returning();

            // Update invoice status
            await db.update(schema.invoices)
                .set({ status: 'listed' })
                .where(eq(schema.invoices.id, invoiceId));

            logger.info("Invoice listed (pending signature)", "marketplace", { listingId: listing.id });

            res.status(201).json({
                success: true,
                message: "Listing created. Please sign transfer transaction.",
                transaction, // Base64
                listing: {
                    id: listing.id,
                    status: listing.status
                }
            });

        } catch (error: any) {
            logger.error("Failed to list invoice", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to list invoice: " + error.message });
        }
    });

    /**
     * POST /api/marketplace/purchase
     * Buy a listed invoice
     * Returns Atomic Swap Transaction (Payment + NFT Delivery)
     */
    app.post("/api/marketplace/purchase", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { listingId } = req.body;

            if (!listingId) return res.status(400).json({ success: false, error: "listingId required" });

            const [listing] = await db.select()
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.id, listingId))
                .limit(1);

            if (!listing || listing.status !== 'active') {
                return res.status(404).json({ success: false, error: "Listing not found or not active" });
            }

            if (listing.seller === walletAddress) {
                return res.status(403).json({ success: false, error: "Cannot buy your own listing" });
            }

            // Fetch invoice checks
            const [invoice] = await db.select()
                .from(schema.invoices)
                .where(eq(schema.invoices.id, listing.invoiceId))
                .limit(1);

            if (!invoice) return res.status(404).json({ success: false, error: "Invoice unavailable" });

            // Generate Atomic Purchase Transaction
            const { marketplaceService } = await import("./marketplace-service");
            const { getStablecoinConfig } = await import("@shared/stablecoin-config");
            const stablecoin = getStablecoinConfig(listing.currency);

            if (!stablecoin) throw new Error("Unsupported currency " + listing.currency);

            const transaction = await marketplaceService.createBuyInvoiceTransaction(
                walletAddress!,
                listing.seller,
                listing.nftMint,
                stablecoin.mint
            );

            res.json({
                success: true,
                transaction, // Base64
                message: "Purchase transaction generated"
            });

        } catch (error: any) {
            logger.error("Failed to generate purchase tx", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to generate purchase transaction" });
        }
    });

    /**
     * POST /api/marketplace/confirm-purchase
     * Confirm on-chain purchase success and update DB
     */
    app.post("/api/marketplace/confirm-purchase", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { listingId, signature } = req.body;

            if (!listingId || !signature) return res.status(400).json({ error: "Missing listingId or signature" });

            // 1. Verify on-chain (or just trust and verify later, but verification is safer)
            // const nftService = await getReadyNftService(); // ensure connection
            // We can use generic connection to confirm
            const { getSolanaConnection } = await import("./solana-sdk");
            const connection = getSolanaConnection();

            // Wait for confirmation
            const status = await connection.getSignatureStatus(signature);
            // Basic check - frontend usually waits, so this should be confirmed or finalized
            if (status.value?.err) {
                return res.status(400).json({ success: false, error: "Transaction failed on-chain" });
            }

            // 2. Update DB
            const [listing] = await db.select()
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.id, listingId))
                .limit(1);

            if (!listing) return res.status(404).json({ error: "Listing not found" });

            // Update Listing
            await db.update(schema.invoiceMarketplace)
                .set({
                    status: 'sold',
                    soldTo: walletAddress,
                    soldAt: new Date(),
                    salePrice: listing.askingPrice
                })
                .where(eq(schema.invoiceMarketplace.id, listingId));

            // CRITICAL: Update Invoice owner for Payment Routing!
            await db.update(schema.invoices)
                .set({
                    nftTransferredTo: walletAddress,
                    nftBurnedAt: null // Ensure not burnt
                })
                .where(eq(schema.invoices.id, listing.invoiceId));

            logger.info("Marketplace purchase confirmed", "marketplace", { listingId, buyer: walletAddress });

            res.json({ success: true, message: "Purchase confirmed" });

        } catch (error: any) {
            logger.error("Failed to confirm purchase", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to confirm purchase" });
        }
    });

    /**
     * DELETE /api/marketplace/listings/:id
     * Cancel a marketplace listing
     */
    app.delete("/api/marketplace/listings/:id", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { id } = req.params;
            const { returnTransaction } = req.query; // New flag

            const [listing] = await db.select()
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.id, id))
                .limit(1);

            if (!listing) return res.status(404).json({ success: false, error: "Listing not found" });
            if (listing.seller !== walletAddress) return res.status(403).json({ success: false, error: "Unauthorized" });
            if (listing.status !== 'active') return res.status(400).json({ success: false, error: "Not active" });

            // const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, listing.invoiceId)).limit(1);

            // Return Transaction for cancellation (NFT return from PDA)
            // Use Marketplace Service (Non-Custodial)
            const { marketplaceService } = await import("./marketplace-service");

            // We need the asset mint (nftMint) to derive the PDA
            if (!listing.nftMint) {
                // If missing in listing, check invoice?
                // listing.nftMint should be there.
                throw new Error("Listing matches, but NFT Mint missing in record");
            }

            const transaction = await marketplaceService.createCancelListingTransaction(
                walletAddress,
                listing.invoiceId,
                listing.nftMint
            );

            // If client specifically requested tx (v2 flow)
            if (returnTransaction === 'true') {
                // Don't update DB yet? 
                // Should updated to 'pending_cancellation'?
                // For now, let's keep old behavior of instant cancel in DB + return tx
                // Ideal: Wait for confirm.
            }

            // Update listing status
            await db.update(schema.invoiceMarketplace)
                .set({ status: 'cancelled', updatedAt: new Date() })
                .where(eq(schema.invoiceMarketplace.id, id));

            // Revert invoice status
            await db.update(schema.invoices)
                .set({ status: 'sent' })
                .where(eq(schema.invoices.id, listing.invoiceId));

            logger.info("Marketplace listing cancelled", "marketplace", { listingId: id, seller: walletAddress });

            res.json({
                success: true,
                message: "Listing cancelled successfully",
                transaction // Includes return tx
            });
        } catch (error: any) {
            logger.error("Failed to cancel listing", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to cancel listing" });
        }
    });

    /**
     * GET /api/marketplace/my-listings
    
     * Get authenticated user's listings
     */
    app.get("/api/marketplace/my-listings", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;

            const listings = await db.select({
                listing: schema.invoiceMarketplace,
                invoice: schema.invoices,
            })
                .from(schema.invoiceMarketplace)
                .innerJoin(schema.invoices, eq(schema.invoiceMarketplace.invoiceId, schema.invoices.id))
                .where(eq(schema.invoiceMarketplace.seller, walletAddress!))
                .orderBy(desc(schema.invoiceMarketplace.listedAt));

            res.json({
                success: true,
                listings: listings.map(({ listing, invoice }) => ({
                    id: listing.id,
                    invoiceNumber: invoice.invoiceNumber,
                    faceValue: listing.faceValue,
                    askingPrice: listing.askingPrice,
                    yieldPercentage: listing.yieldPercentage,
                    currency: listing.currency,
                    status: listing.status,
                    riskLevel: listing.riskLevel,
                    listedAt: listing.listedAt,
                    soldAt: listing.soldAt,
                    viewCount: listing.viewCount,
                })),
                count: listings.length,
            });
        } catch (error: any) {
            logger.error("Failed to fetch user listings", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch listings" });
        }
    });

    /**
     * GET /api/marketplace/my-investments
     * Get invoices the authenticated user has purchased
     */
    app.get("/api/marketplace/my-investments", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;

            const investments = await db.select({
                listing: schema.invoiceMarketplace,
                invoice: schema.invoices,
            })
                .from(schema.invoiceMarketplace)
                .innerJoin(schema.invoices, eq(schema.invoiceMarketplace.invoiceId, schema.invoices.id))
                .where(eq(schema.invoiceMarketplace.soldTo, walletAddress!))
                .orderBy(desc(schema.invoiceMarketplace.soldAt));

            res.json({
                success: true,
                investments: investments.map(({ listing, invoice }) => ({
                    id: listing.id,
                    invoiceNumber: invoice.invoiceNumber,
                    faceValue: listing.faceValue,
                    purchasePrice: listing.salePrice,
                    expectedYield: listing.yieldPercentage,
                    currency: listing.currency,
                    invoiceStatus: invoice.status,
                    dueDate: invoice.dueDate,
                    purchasedAt: listing.soldAt,
                    settledAt: listing.settledAt,
                    settlementAmount: listing.settlementAmount,
                })),
                count: investments.length,
            });
        } catch (error: any) {
            logger.error("Failed to fetch user investments", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch investments" });
        }
    });

    /**
     * GET /api/marketplace/stats
     * Get marketplace statistics
     */
    app.get("/api/marketplace/stats", async (_req: Request, res: Response) => {
        try {
            // Active listings count
            const [activeCount] = await db.select({ count: sql<number>`count(*)` })
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.status, 'active'));

            // Total volume sold
            const [volumeSold] = await db.select({
                total: sql<string>`COALESCE(SUM(${schema.invoiceMarketplace.salePrice}), 0)`
            })
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.status, 'sold'));

            // Count sold
            const [soldCount] = await db.select({ count: sql<number>`count(*)` })
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.status, 'sold'));

            // Average yield
            const [avgYield] = await db.select({
                avg: sql<string>`COALESCE(AVG(${schema.invoiceMarketplace.yieldPercentage}::numeric), 0)`
            })
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.status, 'active'));

            res.json({
                success: true,
                stats: {
                    activeListings: Number(activeCount?.count || 0),
                    totalSold: Number(soldCount?.count || 0),
                    totalVolume: parseFloat(volumeSold?.total || '0').toFixed(2),
                    averageYield: parseFloat(avgYield?.avg || '0').toFixed(2) + '%',
                },
            });
        } catch (error: any) {
            logger.error("Failed to fetch marketplace stats", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch stats" });
        }
    });

    // ============================================
    // ACCESS CONTROL ENDPOINTS (For Blind Listings)
    // ============================================

    /**
     * POST /api/marketplace/listings/:id/request-access
     * Buyer requests access to a blind listing
     */
    app.post("/api/marketplace/listings/:id/request-access", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { id } = req.params;
            const { message } = req.body;

            // Check if request already exists
            const [existing] = await db.select()
                .from(schema.marketplaceAccessRequests)
                .where(and(
                    eq(schema.marketplaceAccessRequests.listingId, id),
                    eq(schema.marketplaceAccessRequests.buyerWallet, walletAddress!)
                ))
                .limit(1);

            if (existing) {
                return res.status(400).json({ success: false, error: "Request already exists", status: existing.status });
            }

            // Create request
            await db.insert(schema.marketplaceAccessRequests)
                .values({
                    listingId: id,
                    buyerWallet: walletAddress!,
                    requestMessage: message || "Interested in viewing details.",
                    status: 'pending'
                });

            res.json({ success: true, message: "Access request sent" });
        } catch (error: any) {
            logger.error("Failed to request access", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to request access" });
        }
    });

    /**
     * GET /api/marketplace/access-requests/pending
     * Fetch all pending access requests for the authenticated seller's listings
     */
    app.get("/api/marketplace/access-requests/pending", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;

            const requests = await db.select({
                requestId: schema.marketplaceAccessRequests.id,
                listingId: schema.invoiceMarketplace.id,
                invoiceNumber: schema.invoices.invoiceNumber, // Show masked info if needed, but seller sees real number
                buyerWallet: schema.marketplaceAccessRequests.buyerWallet,
                message: schema.marketplaceAccessRequests.requestMessage,
                createdAt: schema.marketplaceAccessRequests.createdAt,
                status: schema.marketplaceAccessRequests.status
            })
                .from(schema.marketplaceAccessRequests)
                .innerJoin(schema.invoiceMarketplace, eq(schema.marketplaceAccessRequests.listingId, schema.invoiceMarketplace.id))
                .innerJoin(schema.invoices, eq(schema.invoiceMarketplace.invoiceId, schema.invoices.id))
                .where(and(
                    eq(schema.invoiceMarketplace.seller, walletAddress!),
                    eq(schema.marketplaceAccessRequests.status, 'pending')
                ))
                .orderBy(desc(schema.marketplaceAccessRequests.createdAt));

            res.json({ success: true, requests });
        } catch (error: any) {
            logger.error("Failed to fetch pending requests", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch pending requests" });
        }
    });

    /**
     * GET /api/marketplace/listings/:id/access-requests
     * Seller views pending requests
     */
    app.get("/api/marketplace/listings/:id/access-requests", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { id } = req.params;

            // Verify seller ownership
            const [listing] = await db.select()
                .from(schema.invoiceMarketplace)
                .where(eq(schema.invoiceMarketplace.id, id))
                .limit(1);

            if (!listing || listing.seller !== walletAddress) {
                return res.status(403).json({ success: false, error: "Unauthorized" });
            }

            const requests = await db.select()
                .from(schema.marketplaceAccessRequests)
                .where(eq(schema.marketplaceAccessRequests.listingId, id))
                .orderBy(desc(schema.marketplaceAccessRequests.createdAt));

            res.json({ success: true, requests });
        } catch (error: any) {
            logger.error("Failed to fetch access requests", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch access requests" });
        }
    });

    /**
     * POST /api/marketplace/access-requests/:requestId/approve
     * Seller approves access
     */
    app.post("/api/marketplace/access-requests/:requestId/approve", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { requestId } = req.params;

            // Verify ownership via join
            const [request] = await db.select({
                req: schema.marketplaceAccessRequests,
                listing: schema.invoiceMarketplace
            })
                .from(schema.marketplaceAccessRequests)
                .innerJoin(schema.invoiceMarketplace, eq(schema.marketplaceAccessRequests.listingId, schema.invoiceMarketplace.id))
                .where(eq(schema.marketplaceAccessRequests.id, requestId))
                .limit(1);

            if (!request) return res.status(404).json({ error: "Request not found" });
            if (request.listing.seller !== walletAddress) return res.status(403).json({ error: "Unauthorized" });

            await db.update(schema.marketplaceAccessRequests)
                .set({ status: 'approved', updatedAt: new Date() })
                .where(eq(schema.marketplaceAccessRequests.id, requestId));

            res.json({ success: true, message: "Access approved" });
        } catch (error: any) {
            logger.error("Failed to approve access", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to approve access" });
        }
    });

    /**
     * POST /api/marketplace/access-requests/:requestId/reject
     * Seller rejects access
     */
    app.post("/api/marketplace/access-requests/:requestId/reject", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = req.session.walletAddress;
            const { requestId } = req.params;

            // Verify ownership via join
            const [request] = await db.select({
                req: schema.marketplaceAccessRequests,
                listing: schema.invoiceMarketplace
            })
                .from(schema.marketplaceAccessRequests)
                .innerJoin(schema.invoiceMarketplace, eq(schema.marketplaceAccessRequests.listingId, schema.invoiceMarketplace.id))
                .where(eq(schema.marketplaceAccessRequests.id, requestId))
                .limit(1);

            if (!request) return res.status(404).json({ error: "Request not found" });
            if (request.listing.seller !== walletAddress) return res.status(403).json({ error: "Unauthorized" });

            await db.update(schema.marketplaceAccessRequests)
                .set({ status: 'rejected', updatedAt: new Date() })
                .where(eq(schema.marketplaceAccessRequests.id, requestId));

            res.json({ success: true, message: "Access rejected" });
        } catch (error: any) {
            logger.error("Failed to reject access", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to reject access" });
        }
    });

    logger.info("Registered marketplace routes", "routes");
}
