/**
 * Invoice Marketplace Routes
 * 
 * API endpoints for the Invoice Marketplace where businesses can sell
 * unpaid invoices for immediate cash flow, and investors can purchase
 * them at a discount for yield.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
    invoiceMarketplace,
    invoices,
    businessCreditScores,
    type InvoiceMarketplaceListing,
} from "@shared/invoice-schema";
import { eq, and, desc, sql, ne, isNull, gte, lte } from "drizzle-orm";
import { logger } from "./logger";
import { creditScoringService } from "./credit-scoring-service";

// ============================================
// TYPES
// ============================================

interface RiskAssessment {
    score: number;        // 1-100 (higher = riskier)
    level: 'low' | 'medium' | 'high' | 'very_high';
    flags: string[];
}

interface ListingRequest {
    invoiceId: string;
    askingPrice: string;
    description?: string;
    expiresInDays?: number;
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

function calculateRiskScore(
    invoice: any,
    sellerScore: number | null,
    customerScore: number | null
): RiskAssessment {
    const flags: string[] = [];
    let riskScore = 0;

    // 1. Days until due (30% of risk)
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
        riskScore += 35; // Overdue is very risky
        flags.push('OVERDUE');
    } else if (daysUntilDue < 7) {
        riskScore += 20;
        flags.push('DUE_SOON');
    } else if (daysUntilDue < 30) {
        riskScore += 10;
    }
    // Longer due dates = lower risk (up to 5 points reduction)
    else {
        riskScore += Math.max(0, 10 - Math.floor(daysUntilDue / 30) * 2);
    }

    // 2. Seller credit score (25% of risk)
    if (!sellerScore || sellerScore < 450) {
        riskScore += 25;
        flags.push('LOW_SELLER_SCORE');
    } else if (sellerScore < 550) {
        riskScore += 20;
    } else if (sellerScore < 650) {
        riskScore += 10;
    } else if (sellerScore < 750) {
        riskScore += 5;
    }
    // Prime sellers get risk reduction

    // 3. Customer credit score (25% of risk)
    if (!customerScore || customerScore < 450) {
        riskScore += 25;
        flags.push('LOW_CUSTOMER_SCORE');
    } else if (customerScore < 550) {
        riskScore += 20;
        flags.push('UNKNOWN_CUSTOMER');
    } else if (customerScore < 650) {
        riskScore += 10;
    } else if (customerScore < 750) {
        riskScore += 5;
    }

    // 4. Invoice size (10% of risk)
    const amount = parseFloat(invoice.totalAmount);
    if (amount > 100000) {
        riskScore += 10;
        flags.push('LARGE_INVOICE');
    } else if (amount > 10000) {
        riskScore += 5;
    }

    // 5. Invoice age (10% of risk) - older invoices more risky
    const invoiceDate = new Date(invoice.invoiceDate);
    const daysSinceIssued = Math.ceil((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceIssued > 90) {
        riskScore += 10;
        flags.push('OLD_INVOICE');
    } else if (daysSinceIssued > 60) {
        riskScore += 5;
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'very_high';
    if (riskScore <= 25) level = 'low';
    else if (riskScore <= 50) level = 'medium';
    else if (riskScore <= 75) level = 'high';
    else level = 'very_high';

    return {
        score: Math.min(100, riskScore),
        level,
        flags,
    };
}

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
            } = req.query;

            // Build query
            let query = db.select({
                listing: invoiceMarketplace,
                invoice: invoices,
            })
                .from(invoiceMarketplace)
                .innerJoin(invoices, eq(invoiceMarketplace.invoiceId, invoices.id))
                .where(eq(invoiceMarketplace.status, 'active'))
                .$dynamic();

            // Apply filters
            if (currency) {
                query = query.where(eq(invoiceMarketplace.currency, currency as string));
            }

            if (riskLevel) {
                query = query.where(eq(invoiceMarketplace.riskLevel, riskLevel as string));
            }

            if (minYield) {
                query = query.where(gte(invoiceMarketplace.yieldPercentage, minYield as string));
            }

            if (maxPrice) {
                query = query.where(lte(invoiceMarketplace.askingPrice, maxPrice as string));
            }

            // Apply sorting
            if (sortBy === 'price') {
                query = query.orderBy(sortOrder === 'asc'
                    ? invoiceMarketplace.askingPrice
                    : desc(invoiceMarketplace.askingPrice));
            } else if (sortBy === 'yield') {
                query = query.orderBy(sortOrder === 'asc'
                    ? invoiceMarketplace.yieldPercentage
                    : desc(invoiceMarketplace.yieldPercentage));
            } else if (sortBy === 'risk') {
                query = query.orderBy(sortOrder === 'asc'
                    ? invoiceMarketplace.riskScore
                    : desc(invoiceMarketplace.riskScore));
            } else {
                query = query.orderBy(desc(invoiceMarketplace.listedAt));
            }

            // Apply pagination
            query = query.limit(Number(limit)).offset(Number(offset));

            const results = await query;

            // Format response (hide sensitive invoice data)
            const listings = results.map(({ listing, invoice }) => ({
                id: listing.id,
                invoiceNumber: invoice.invoiceNumber,
                faceValue: listing.faceValue,
                askingPrice: listing.askingPrice,
                discountRate: listing.discountRate,
                yieldPercentage: listing.yieldPercentage,
                currency: listing.currency,
                riskScore: listing.riskScore,
                riskLevel: listing.riskLevel,
                riskFlags: listing.riskFlags,
                sellerCreditScore: listing.sellerCreditScore,
                sellerCreditTier: listing.sellerCreditTier,
                customerCreditScore: listing.customerCreditScore,
                dueDate: invoice.dueDate,
                daysUntilDue: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                listedAt: listing.listedAt,
                expiresAt: listing.expiresAt,
                viewCount: listing.viewCount,
                description: listing.listingDescription,
                // Privacy: Don't expose full wallet addresses
                sellerTruncated: listing.seller.slice(0, 4) + '...' + listing.seller.slice(-4),
            }));

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
                listing: invoiceMarketplace,
                invoice: invoices,
            })
                .from(invoiceMarketplace)
                .innerJoin(invoices, eq(invoiceMarketplace.invoiceId, invoices.id))
                .where(eq(invoiceMarketplace.id, id))
                .limit(1);

            if (!result) {
                return res.status(404).json({ success: false, error: "Listing not found" });
            }

            // Increment view count
            await db.update(invoiceMarketplace)
                .set({ viewCount: sql`${invoiceMarketplace.viewCount} + 1` })
                .where(eq(invoiceMarketplace.id, id));

            const { listing, invoice } = result;

            res.json({
                success: true,
                listing: {
                    id: listing.id,
                    invoiceId: listing.invoiceId,
                    invoiceNumber: invoice.invoiceNumber,
                    faceValue: listing.faceValue,
                    askingPrice: listing.askingPrice,
                    discountRate: listing.discountRate,
                    yieldPercentage: listing.yieldPercentage,
                    currency: listing.currency,
                    status: listing.status,
                    riskScore: listing.riskScore,
                    riskLevel: listing.riskLevel,
                    riskFlags: listing.riskFlags,
                    sellerCreditScore: listing.sellerCreditScore,
                    sellerCreditTier: listing.sellerCreditTier,
                    customerCreditScore: listing.customerCreditScore,
                    dueDate: invoice.dueDate,
                    invoiceDate: invoice.invoiceDate,
                    daysUntilDue: Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                    listedAt: listing.listedAt,
                    expiresAt: listing.expiresAt,
                    viewCount: (listing.viewCount || 0) + 1,
                    watchlistCount: listing.watchlistCount,
                    description: listing.listingDescription,
                    nftMint: listing.nftMint,
                    // Privacy: Truncate addresses
                    seller: listing.seller.slice(0, 4) + '...' + listing.seller.slice(-4),
                    invoicee: invoice.invoiceeWalletAddress.slice(0, 4) + '...' + invoice.invoiceeWalletAddress.slice(-4),
                },
            });
        } catch (error: any) {
            logger.error("Failed to fetch listing", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to fetch listing" });
        }
    });

    /**
     * POST /api/marketplace/list
     * List an invoice for sale on the marketplace
     */
    app.post("/api/marketplace/list", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = (req.session as any).walletAddress;
            const { invoiceId, askingPrice, description, expiresInDays } = req.body as ListingRequest;

            if (!invoiceId || !askingPrice) {
                return res.status(400).json({ success: false, error: "invoiceId and askingPrice are required" });
            }

            // Fetch the invoice
            const [invoice] = await db.select()
                .from(invoices)
                .where(eq(invoices.id, invoiceId))
                .limit(1);

            if (!invoice) {
                return res.status(404).json({ success: false, error: "Invoice not found" });
            }

            // Verify ownership
            if (invoice.invoicerWalletAddress !== walletAddress) {
                return res.status(403).json({ success: false, error: "You can only list invoices you created" });
            }

            // Verify invoice status (must be sent, not paid/cancelled)
            if (invoice.status !== 'sent') {
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
                .from(invoiceMarketplace)
                .where(and(
                    eq(invoiceMarketplace.invoiceId, invoiceId),
                    eq(invoiceMarketplace.status, 'active')
                ))
                .limit(1);

            if (existingListing) {
                return res.status(400).json({ success: false, error: "Invoice is already listed on marketplace" });
            }

            // Validate asking price (must be less than face value)
            const faceValue = parseFloat(invoice.totalAmount);
            const asking = parseFloat(askingPrice);

            if (asking >= faceValue) {
                return res.status(400).json({
                    success: false,
                    error: "Asking price must be less than invoice face value for discounted sale"
                });
            }

            // Maximum discount check (e.g., 50%)
            const discount = ((faceValue - asking) / faceValue) * 100;
            if (discount > 50) {
                return res.status(400).json({
                    success: false,
                    error: "Maximum discount is 50%. Reduce your discount rate."
                });
            }

            // Get credit scores
            const sellerScore = await creditScoringService.getQuickScore(walletAddress);
            const customerScore = await creditScoringService.getQuickScore(invoice.invoiceeWalletAddress);

            // Check seller eligibility
            if (!sellerScore || sellerScore.score < 450) {
                return res.status(400).json({
                    success: false,
                    error: "Minimum credit score of 450 (Developing tier) required to list. Your score: " + (sellerScore?.score || 'N/A')
                });
            }

            // Calculate risk assessment
            const risk = calculateRiskScore(invoice, sellerScore?.score || null, customerScore?.score || null);

            // Calculate yield
            const yieldPct = calculateYield(invoice.totalAmount, askingPrice);

            // Calculate expiration
            const expiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : null;

            // Create listing
            const [listing] = await db.insert(invoiceMarketplace)
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
                    riskFlags: risk.flags,
                    sellerCreditScore: sellerScore?.score,
                    sellerCreditTier: sellerScore?.tier,
                    customerCreditScore: customerScore?.score || null,
                    suggestedFloorPrice: null, // Could calculate based on risk
                    yieldPercentage: yieldPct.toFixed(2),
                    status: 'active',
                    expiresAt,
                    listingDescription: description,
                })
                .returning();

            // Update invoice status to 'listed'
            await db.update(invoices)
                .set({ status: 'listed' })
                .where(eq(invoices.id, invoiceId));

            logger.info("Invoice listed on marketplace", "marketplace", {
                listingId: listing.id,
                invoiceId,
                seller: walletAddress,
                askingPrice,
                yieldPct,
            });

            res.status(201).json({
                success: true,
                listing: {
                    id: listing.id,
                    invoiceId: listing.invoiceId,
                    faceValue: listing.faceValue,
                    askingPrice: listing.askingPrice,
                    discountRate: listing.discountRate,
                    yieldPercentage: listing.yieldPercentage,
                    riskLevel: listing.riskLevel,
                    status: listing.status,
                },
                message: "Invoice successfully listed on marketplace",
            });
        } catch (error: any) {
            logger.error("Failed to list invoice", "marketplace", { error: error.message });
            res.status(500).json({ success: false, error: "Failed to list invoice" });
        }
    });

    /**
     * DELETE /api/marketplace/listings/:id
     * Cancel a marketplace listing
     */
    app.delete("/api/marketplace/listings/:id", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = (req.session as any).walletAddress;
            const { id } = req.params;

            const [listing] = await db.select()
                .from(invoiceMarketplace)
                .where(eq(invoiceMarketplace.id, id))
                .limit(1);

            if (!listing) {
                return res.status(404).json({ success: false, error: "Listing not found" });
            }

            if (listing.seller !== walletAddress) {
                return res.status(403).json({ success: false, error: "You can only cancel your own listings" });
            }

            if (listing.status !== 'active') {
                return res.status(400).json({ success: false, error: `Cannot cancel listing with status: ${listing.status}` });
            }

            // Update listing status
            await db.update(invoiceMarketplace)
                .set({ status: 'cancelled', updatedAt: new Date() })
                .where(eq(invoiceMarketplace.id, id));

            // Revert invoice status back to 'sent'
            await db.update(invoices)
                .set({ status: 'sent' })
                .where(eq(invoices.id, listing.invoiceId));

            logger.info("Marketplace listing cancelled", "marketplace", { listingId: id, seller: walletAddress });

            res.json({
                success: true,
                message: "Listing cancelled successfully",
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
            const walletAddress = (req.session as any).walletAddress;

            const listings = await db.select({
                listing: invoiceMarketplace,
                invoice: invoices,
            })
                .from(invoiceMarketplace)
                .innerJoin(invoices, eq(invoiceMarketplace.invoiceId, invoices.id))
                .where(eq(invoiceMarketplace.seller, walletAddress))
                .orderBy(desc(invoiceMarketplace.listedAt));

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
            const walletAddress = (req.session as any).walletAddress;

            const investments = await db.select({
                listing: invoiceMarketplace,
                invoice: invoices,
            })
                .from(invoiceMarketplace)
                .innerJoin(invoices, eq(invoiceMarketplace.invoiceId, invoices.id))
                .where(eq(invoiceMarketplace.soldTo, walletAddress))
                .orderBy(desc(invoiceMarketplace.soldAt));

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
                .from(invoiceMarketplace)
                .where(eq(invoiceMarketplace.status, 'active'));

            // Total volume sold
            const [volumeSold] = await db.select({
                total: sql<string>`COALESCE(SUM(${invoiceMarketplace.salePrice}), 0)`
            })
                .from(invoiceMarketplace)
                .where(eq(invoiceMarketplace.status, 'sold'));

            // Count sold
            const [soldCount] = await db.select({ count: sql<number>`count(*)` })
                .from(invoiceMarketplace)
                .where(eq(invoiceMarketplace.status, 'sold'));

            // Average yield
            const [avgYield] = await db.select({
                avg: sql<string>`COALESCE(AVG(${invoiceMarketplace.yieldPercentage}::numeric), 0)`
            })
                .from(invoiceMarketplace)
                .where(eq(invoiceMarketplace.status, 'active'));

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

    logger.info("Registered marketplace routes", "routes");
}
