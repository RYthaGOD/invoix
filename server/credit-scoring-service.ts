/**
 * Credit Scoring Service
 * 
 * Calculates and maintains credit scores for businesses on the Invoix platform.
 * These scores are used for marketplace listing eligibility and risk assessment.
 * 
 * Score Range: 300-850 (similar to traditional credit scores)
 * 
 * Components:
 * - Payment History (35%): Behavior as a payer
 * - Volume & Scale (25%): Transaction volume and business size  
 * - Reliability (25%): Performance as an invoicer
 * - Account Tenure (15%): Longevity on platform
 */

import { db } from "./db";
import {
    businessCreditScores,
    invoices,
    payments,
    type BusinessCreditScore,
} from "@shared/invoice-schema";
import { eq, and, sql, desc, count, sum, avg, ne, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import { getSolPrice } from "./pricing-service";

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CreditScoreResult {
    overallScore: number;
    tier: CreditTier;
    components: {
        paymentHistory: number;
        volume: number;
        reliability: number;
        tenure: number;
    };
    factors: {
        helping: string[];
        hurting: string[];
    };
    tips: string[];
    calculatedAt: Date;
}

export type CreditTier = 'prime' | 'standard' | 'fair' | 'developing' | 'new';

interface PayerMetrics {
    totalPayments: number;
    onTimePayments: number;
    latePayments: number;
    avgDaysToPayment: number;
    lastPaymentDate: Date | null;
    disputes: number;
}

interface VolumeMetrics {
    totalVolumeUSD: number;
    totalInvoicesIssued: number;
    uniqueCounterparties: number;
}

interface SellerMetrics {
    totalInvoicesIssued: number;
    paidInvoices: number;
    cancelledInvoices: number;
    avgDaysToCollect: number;
    topCustomerShare: number;
}

interface TenureMetrics {
    firstActivityDate: Date | null;
    monthsWithActivity: number;
}

// ============================================
// CONSTANTS
// ============================================

const MIN_SCORE = 300;
const MAX_SCORE = 850;
const DEFAULT_SCORE = 500;

const TIER_THRESHOLDS = {
    prime: 750,
    standard: 650,
    fair: 550,
    developing: 450,
    new: 0,
};

// ============================================
// SCORING ALGORITHMS
// ============================================

/**
 * Calculate Payment History Score (35% weight)
 * Measures behavior as a payer (invoicee) on the platform
 */
function calculatePaymentHistoryScore(metrics: PayerMetrics): number {
    const BASE_SCORE = MIN_SCORE;
    const RANGE = MAX_SCORE - MIN_SCORE; // 550 points

    // 1. On-Time Payment Rate (50% of component = 275 points max)
    const onTimeRate = metrics.totalPayments > 0
        ? metrics.onTimePayments / metrics.totalPayments
        : 0.5; // Neutral for new accounts
    const onTimePoints = onTimeRate * 275;

    // 2. Payment Consistency (20% of component = 110 points max)
    // Lower average days to pay = higher score
    const avgDays = metrics.avgDaysToPayment || 30;
    const consistencyPoints = Math.max(0, 110 - (avgDays * 2));

    // 3. Dispute Rate (20% of component = 110 points max)
    const disputeRate = metrics.totalPayments > 0
        ? metrics.disputes / metrics.totalPayments
        : 0;
    const disputePoints = Math.max(0, 110 * (1 - disputeRate * 5));

    // 4. Recency Boost (10% of component = 55 points max)
    let recencyPoints = 0;
    if (metrics.lastPaymentDate) {
        const daysSince = dateDiffInDays(metrics.lastPaymentDate, new Date());
        recencyPoints = daysSince < 30 ? 55 :
            daysSince < 90 ? 35 :
                daysSince < 180 ? 15 : 0;
    }

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + onTimePoints + consistencyPoints + disputePoints + recencyPoints));
}

/**
 * Calculate Volume & Scale Score (25% weight)
 * Measures transaction volume and business size
 */
function calculateVolumeScore(metrics: VolumeMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    // 1. Total Volume (60% of component = 330 points max)
    // Logarithmic scale to prevent whales from dominating
    const volumeUSD = metrics.totalVolumeUSD;
    let volumePoints = 0;
    if (volumeUSD >= 1000000) volumePoints = 330;      // $1M+
    else if (volumeUSD >= 100000) volumePoints = 280;  // $100K+
    else if (volumeUSD >= 10000) volumePoints = 220;   // $10K+
    else if (volumeUSD >= 1000) volumePoints = 160;    // $1K+
    else if (volumeUSD >= 100) volumePoints = 80;      // $100+
    else volumePoints = Math.floor(volumeUSD * 0.8);   // < $100

    // 2. Invoice Count (25% of component = 138 points max)
    const invoiceCount = metrics.totalInvoicesIssued;
    const invoicePoints = Math.min(138, invoiceCount * 5); // Max at ~28 invoices

    // 3. Active Counterparties (15% of component = 82 points max)
    const uniqueParties = metrics.uniqueCounterparties;
    const partyPoints = Math.min(82, uniqueParties * 10); // Max at 8+ parties

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + volumePoints + invoicePoints + partyPoints));
}

/**
 * Calculate Reliability Score (25% weight)
 * Measures reliability as an invoicer (seller) on the platform
 */
function calculateReliabilityScore(metrics: SellerMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    // Handle accounts with no invoices yet
    if (metrics.totalInvoicesIssued === 0) {
        return DEFAULT_SCORE; // Neutral score
    }

    // 1. Invoice Fulfillment Rate (40% of component = 220 points max)
    const fulfillmentRate = metrics.paidInvoices / metrics.totalInvoicesIssued;
    const fulfillmentPoints = fulfillmentRate * 220;

    // 2. Cancellation/Void Rate (25% of component = 138 points max)
    const cancelRate = metrics.cancelledInvoices / metrics.totalInvoicesIssued;
    const cancelPoints = Math.max(0, 138 * (1 - cancelRate * 3)); // Penalize heavily

    // 3. Average Collection Time (20% of component = 110 points max)
    const avgDays = metrics.avgDaysToCollect || 30;
    let collectionPoints = 0;
    if (avgDays <= 7) collectionPoints = 110;
    else if (avgDays <= 14) collectionPoints = 90;
    else if (avgDays <= 30) collectionPoints = 70;
    else if (avgDays <= 60) collectionPoints = 40;
    else collectionPoints = 10;

    // 4. Customer Diversity (15% of component = 82 points max)
    // Not dependent on single customer
    const diversityPoints = Math.max(0, 82 * (1 - metrics.topCustomerShare));

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + fulfillmentPoints + cancelPoints + collectionPoints + diversityPoints));
}

/**
 * Calculate Account Tenure Score (15% weight)
 * Measures longevity and stability on the platform
 */
function calculateTenureScore(metrics: TenureMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    // Handle new accounts
    if (!metrics.firstActivityDate) {
        return MIN_SCORE + 100; // Slightly above minimum for new accounts
    }

    // 1. Account Age (60% of component = 330 points max)
    const accountAgeDays = dateDiffInDays(metrics.firstActivityDate, new Date());
    let agePoints = 0;
    if (accountAgeDays >= 365) agePoints = 330;      // 1+ year
    else if (accountAgeDays >= 180) agePoints = 275; // 6+ months
    else if (accountAgeDays >= 90) agePoints = 200;  // 3+ months
    else if (accountAgeDays >= 30) agePoints = 120;  // 1+ month
    else agePoints = accountAgeDays * 4;             // < 1 month

    // 2. Activity Consistency (40% of component = 220 points max)
    const totalMonths = Math.max(1, Math.ceil(accountAgeDays / 30));
    const activityRate = metrics.monthsWithActivity / totalMonths;
    const activityPoints = activityRate * 220;

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + agePoints + activityPoints));
}

/**
 * Determine credit tier based on overall score
 */
function determineTier(score: number): CreditTier {
    if (score >= TIER_THRESHOLDS.prime) return 'prime';
    if (score >= TIER_THRESHOLDS.standard) return 'standard';
    if (score >= TIER_THRESHOLDS.fair) return 'fair';
    if (score >= TIER_THRESHOLDS.developing) return 'developing';
    return 'new';
}

/**
 * Generate helping/hurting factors and tips based on metrics
 */
function generateFactorsAndTips(
    metrics: {
        payer: PayerMetrics;
        volume: VolumeMetrics;
        seller: SellerMetrics;
        tenure: TenureMetrics;
    },
    components: { paymentHistory: number; volume: number; reliability: number; tenure: number }
): { helping: string[]; hurting: string[]; tips: string[] } {
    const helping: string[] = [];
    const hurting: string[] = [];
    const tips: string[] = [];

    // Payment History Analysis
    const onTimeRate = metrics.payer.totalPayments > 0
        ? metrics.payer.onTimePayments / metrics.payer.totalPayments
        : 0;

    if (onTimeRate >= 1.0) {
        helping.push("100% on-time payment rate");
    } else if (onTimeRate >= 0.9) {
        helping.push(`${Math.round(onTimeRate * 100)}% on-time payment rate`);
    } else if (onTimeRate < 0.8 && metrics.payer.totalPayments > 0) {
        hurting.push("Late payments detected");
        tips.push("Pay invoices before due date to improve your score");
    }

    if (metrics.payer.disputes === 0 && metrics.payer.totalPayments > 0) {
        helping.push("Zero payment disputes");
    } else if (metrics.payer.disputes > 0) {
        hurting.push(`${metrics.payer.disputes} payment dispute(s) on record`);
    }

    // Volume Analysis
    if (metrics.volume.totalVolumeUSD >= 10000) {
        helping.push(`$${metrics.volume.totalVolumeUSD.toLocaleString()} total volume processed`);
    } else if (metrics.volume.totalVolumeUSD < 1000) {
        hurting.push("Limited transaction volume");
        tips.push("Increase your transaction volume to build credibility");
    }

    if (metrics.volume.uniqueCounterparties >= 5) {
        helping.push(`Transacted with ${metrics.volume.uniqueCounterparties} unique counterparties`);
    } else if (metrics.volume.uniqueCounterparties < 3) {
        hurting.push("Limited counterparty diversity");
        tips.push("Transact with more unique wallets to improve your score");
    }

    // Reliability Analysis
    if (metrics.seller.totalInvoicesIssued > 0) {
        const fulfillmentRate = metrics.seller.paidInvoices / metrics.seller.totalInvoicesIssued;
        if (fulfillmentRate >= 0.9) {
            helping.push(`${Math.round(fulfillmentRate * 100)}% invoice completion rate`);
        } else if (fulfillmentRate < 0.7) {
            hurting.push("Low invoice completion rate");
        }
    }

    if (metrics.seller.avgDaysToCollect && metrics.seller.avgDaysToCollect <= 14) {
        helping.push("Fast invoice collection time");
    } else if (metrics.seller.avgDaysToCollect && metrics.seller.avgDaysToCollect > 45) {
        hurting.push("Slow invoice collection time");
    }

    // Tenure Analysis
    if (metrics.tenure.firstActivityDate) {
        const ageDays = dateDiffInDays(metrics.tenure.firstActivityDate, new Date());
        if (ageDays >= 180) {
            helping.push(`Account active for ${Math.floor(ageDays / 30)} months`);
        } else if (ageDays < 30) {
            hurting.push("Account less than 1 month old");
            tips.push("Maintain activity for at least 3 months to improve your tenure score");
        } else if (ageDays < 90) {
            hurting.push("Account less than 3 months old");
            tips.push("Continue regular activity to build your history");
        }
    }

    // Activity pattern
    if (metrics.tenure.monthsWithActivity >= 3) {
        helping.push(`Active in ${metrics.tenure.monthsWithActivity} months`);
    }

    return { helping, hurting, tips };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function dateDiffInDays(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// MAIN SERVICE CLASS
// ============================================

export class CreditScoringService {

    /**
     * Get or create a credit score record for a wallet
     */
    async getOrCreateCreditScore(walletAddress: string): Promise<BusinessCreditScore> {
        const [existing] = await db.select()
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        if (existing) {
            return existing;
        }

        // Create new record with default values
        const [newScore] = await db.insert(businessCreditScores)
            .values({ walletAddress })
            .returning();

        return newScore;
    }

    /**
     * Calculate full credit score for a wallet
     * This performs a complete recalculation based on all historical data
     */
    async calculateCreditScore(walletAddress: string): Promise<CreditScoreResult> {
        logger.info(`Calculating credit score for ${walletAddress}`, "credit");

        // Gather all metrics
        const [payerMetrics, volumeMetrics, sellerMetrics, tenureMetrics] = await Promise.all([
            this.getPayerMetrics(walletAddress),
            this.getVolumeMetrics(walletAddress),
            this.getSellerMetrics(walletAddress),
            this.getTenureMetrics(walletAddress),
        ]);

        // Calculate component scores
        const paymentHistory = calculatePaymentHistoryScore(payerMetrics);
        const volume = calculateVolumeScore(volumeMetrics);
        const reliability = calculateReliabilityScore(sellerMetrics);
        const tenure = calculateTenureScore(tenureMetrics);

        // Calculate weighted overall score
        const overallScore = Math.round(
            paymentHistory * 0.35 +
            volume * 0.25 +
            reliability * 0.25 +
            tenure * 0.15
        );

        const tier = determineTier(overallScore);

        // Generate factors and tips
        const { helping, hurting, tips } = generateFactorsAndTips(
            { payer: payerMetrics, volume: volumeMetrics, seller: sellerMetrics, tenure: tenureMetrics },
            { paymentHistory, volume, reliability, tenure }
        );

        // Persist to database
        await this.persistCreditScore(walletAddress, {
            overallScore,
            tier,
            components: { paymentHistory, volume, reliability, tenure },
            metrics: { payer: payerMetrics, volume: volumeMetrics, seller: sellerMetrics, tenure: tenureMetrics },
        });

        logger.info(`Credit score calculated: ${overallScore} (${tier})`, "credit", { walletAddress });

        return {
            overallScore,
            tier,
            components: { paymentHistory, volume, reliability, tenure },
            factors: { helping, hurting },
            tips,
            calculatedAt: new Date(),
        };
    }

    /**
     * Get cached credit score (does not recalculate)
     */
    async getCachedCreditScore(walletAddress: string): Promise<CreditScoreResult | null> {
        const [existing] = await db.select()
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        if (!existing) {
            return null;
        }

        // Build factors from stored metrics
        const factors = await this.generateFactorsFromStored(existing);
        const tips = this.generateTipsFromStored(existing);

        return {
            overallScore: existing.overallScore,
            tier: existing.creditTier as CreditTier,
            components: {
                paymentHistory: existing.paymentHistoryScore,
                volume: existing.volumeScore,
                reliability: existing.reliabilityScore,
                tenure: existing.tenureScore,
            },
            factors,
            tips,
            calculatedAt: existing.lastCalculatedAt,
        };
    }

    /**
     * Quick lookup for tier and score (efficient for listings)
     */
    async getQuickScore(walletAddress: string): Promise<{ score: number; tier: CreditTier } | null> {
        const [existing] = await db.select({
            score: businessCreditScores.overallScore,
            tier: businessCreditScores.creditTier,
        })
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        if (!existing) {
            return null;
        }

        return {
            score: existing.score,
            tier: existing.tier as CreditTier,
        };
    }

    /**
     * Incremental update after a payment is made
     */
    async updateScoreOnPayment(payment: {
        fromAddress: string;
        toAddress: string;
        amount: string;
        invoiceDueDate: Date;
        paidAt: Date;
    }): Promise<void> {
        const { fromAddress, toAddress, invoiceDueDate, paidAt } = payment;

        // Update payer's score (fromAddress)
        const isOnTime = paidAt <= invoiceDueDate;
        const daysFromDue = dateDiffInDays(invoiceDueDate, paidAt);

        await db.update(businessCreditScores)
            .set({
                totalPaymentsMade: sql`${businessCreditScores.totalPaymentsMade} + 1`,
                onTimePayments: isOnTime
                    ? sql`${businessCreditScores.onTimePayments} + 1`
                    : businessCreditScores.onTimePayments,
                latePayments: !isOnTime
                    ? sql`${businessCreditScores.latePayments} + 1`
                    : businessCreditScores.latePayments,
                lastPaymentDate: paidAt,
                updatedAt: new Date(),
            })
            .where(eq(businessCreditScores.walletAddress, fromAddress));

        // Update seller's score (toAddress) - increment paid invoices
        await db.update(businessCreditScores)
            .set({
                paidInvoices: sql`${businessCreditScores.paidInvoices} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(businessCreditScores.walletAddress, toAddress));

        // Queue full recalculation (async, non-blocking)
        this.queueRecalculation(fromAddress);
        this.queueRecalculation(toAddress);
    }

    /**
     * Incremental update after an invoice is created
     */
    async updateScoreOnInvoiceCreated(invoice: {
        invoicerWalletAddress: string;
        invoiceeWalletAddress: string;
        totalAmount: string;
        currency?: string; // FIX: Add currency for proper USD conversion
    }): Promise<void> {
        const { invoicerWalletAddress, invoiceeWalletAddress, totalAmount, currency } = invoice;

        // Ensure both parties have credit score records
        await this.getOrCreateCreditScore(invoicerWalletAddress);
        await this.getOrCreateCreditScore(invoiceeWalletAddress);

        // FIX: Convert to USD based on currency
        let amountUsd = parseFloat(totalAmount);
        if (currency === 'SOL') {
            const solPrice = await getSolPrice();
            // Fallback to 200 if price fetch fails (returned 0)
            const conversionRate = solPrice > 0 ? solPrice : 200;
            amountUsd = parseFloat(totalAmount) * conversionRate;
        } else if (currency === 'EURC') {
            amountUsd = parseFloat(totalAmount) * 1.05; // EUR to USD estimate (Updated)
        }

        await db.update(businessCreditScores)
            .set({
                totalInvoicesIssued: sql`${businessCreditScores.totalInvoicesIssued} + 1`,
                totalVolumeUsd: sql`${businessCreditScores.totalVolumeUsd} + ${amountUsd}`,
                firstActivityAt: sql`COALESCE(${businessCreditScores.firstActivityAt}, NOW())`,
                updatedAt: new Date(),
            })
            .where(eq(businessCreditScores.walletAddress, invoicerWalletAddress));

        // Update invoicee metrics
        await db.update(businessCreditScores)
            .set({
                totalInvoicesReceived: sql`${businessCreditScores.totalInvoicesReceived} + 1`,
                firstActivityAt: sql`COALESCE(${businessCreditScores.firstActivityAt}, NOW())`,
                updatedAt: new Date(),
            })
            .where(eq(businessCreditScores.walletAddress, invoiceeWalletAddress));
    }

    /**
     * Record a dispute against a wallet
     */
    async recordDispute(walletAddress: string, role: 'payer' | 'seller'): Promise<void> {
        await this.getOrCreateCreditScore(walletAddress);

        if (role === 'payer') {
            await db.update(businessCreditScores)
                .set({
                    disputesAsPayer: sql`${businessCreditScores.disputesAsPayer} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(businessCreditScores.walletAddress, walletAddress));
        } else {
            await db.update(businessCreditScores)
                .set({
                    disputesAsSeller: sql`${businessCreditScores.disputesAsSeller} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(businessCreditScores.walletAddress, walletAddress));
        }

        // Queue recalculation
        this.queueRecalculation(walletAddress);
        logger.warn(`Dispute recorded for ${walletAddress} as ${role}`, "credit");
    }



    // ============================================
    // PRIVATE METHODS
    // ============================================

    private async getPayerMetrics(walletAddress: string): Promise<PayerMetrics> {
        // Get all payments made by this wallet
        const paymentsMade = await db.select({
            id: payments.id,
            createdAt: payments.createdAt,
            confirmedAt: payments.confirmedAt,
            invoiceId: payments.invoiceId,
        })
            .from(payments)
            .where(eq(payments.fromAddress, walletAddress));

        // For each payment, check if it was on-time
        let onTimeCount = 0;
        let totalDaysToPay = 0;
        let lastPaymentDate: Date | null = null;

        for (const payment of paymentsMade) {
            // Get the invoice to check due date
            const [invoice] = await db.select({ dueDate: invoices.dueDate, invoiceDate: invoices.invoiceDate })
                .from(invoices)
                .where(eq(invoices.id, payment.invoiceId))
                .limit(1);

            if (invoice && payment.confirmedAt) {
                const paymentDate = payment.confirmedAt || payment.createdAt;
                if (paymentDate <= invoice.dueDate) {
                    onTimeCount++;
                }

                // Days from invoice date to payment
                const daysToPayment = dateDiffInDays(invoice.invoiceDate, paymentDate);
                totalDaysToPay += daysToPayment;

                if (!lastPaymentDate || paymentDate > lastPaymentDate) {
                    lastPaymentDate = paymentDate;
                }
            }
        }

        return {
            totalPayments: paymentsMade.length,
            onTimePayments: onTimeCount,
            latePayments: paymentsMade.length - onTimeCount,
            avgDaysToPayment: paymentsMade.length > 0 ? Math.round(totalDaysToPay / paymentsMade.length) : 30,
            lastPaymentDate,
            disputes: 0, // NOTE: Dispute tracking requires new schema table - tracked in backlog
        };
    }

    private async getVolumeMetrics(walletAddress: string): Promise<VolumeMetrics> {
        // Get volume from stored metrics first (more efficient)
        const [stored] = await db.select({
            totalVolumeUsd: businessCreditScores.totalVolumeUsd,
            totalInvoicesIssued: businessCreditScores.totalInvoicesIssued,
            uniqueCounterparties: businessCreditScores.uniqueCounterparties,
        })
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        if (stored) {
            return {
                totalVolumeUSD: parseFloat(stored.totalVolumeUsd || "0"),
                totalInvoicesIssued: stored.totalInvoicesIssued,
                uniqueCounterparties: stored.uniqueCounterparties,
            };
        }

        // Calculate from scratch if no stored data
        const invoiceStats = await db.select({
            totalAmount: sum(invoices.totalAmount),
            count: count(),
        })
            .from(invoices)
            .where(eq(invoices.invoicerWalletAddress, walletAddress));

        // Count unique counterparties
        const counterparties = await db.selectDistinct({ customer: invoices.invoiceeWalletAddress })
            .from(invoices)
            .where(eq(invoices.invoicerWalletAddress, walletAddress));

        return {
            totalVolumeUSD: parseFloat(invoiceStats[0]?.totalAmount || "0"),
            totalInvoicesIssued: Number(invoiceStats[0]?.count || 0),
            uniqueCounterparties: counterparties.length,
        };
    }

    private async getSellerMetrics(walletAddress: string): Promise<SellerMetrics> {
        // Get invoice stats as seller
        const allInvoices = await db.select({
            status: invoices.status,
            invoiceDate: invoices.invoiceDate,
            paidAt: invoices.paidAt,
            invoiceeWalletAddress: invoices.invoiceeWalletAddress,
            totalAmount: invoices.totalAmount,
        })
            .from(invoices)
            .where(eq(invoices.invoicerWalletAddress, walletAddress));

        const totalInvoices = allInvoices.length;
        const paidInvoices = allInvoices.filter(i => i.status === 'paid').length;
        const cancelledInvoices = allInvoices.filter(i => i.status === 'cancelled').length;

        // Calculate average collection time
        let totalCollectionDays = 0;
        let paidWithDates = 0;
        for (const inv of allInvoices) {
            if (inv.status === 'paid' && inv.paidAt) {
                totalCollectionDays += dateDiffInDays(inv.invoiceDate, inv.paidAt);
                paidWithDates++;
            }
        }

        // Calculate top customer concentration
        const customerVolumes: Record<string, number> = {};
        for (const inv of allInvoices) {
            const customer = inv.invoiceeWalletAddress;
            customerVolumes[customer] = (customerVolumes[customer] || 0) + parseFloat(inv.totalAmount);
        }

        const totalVolume = Object.values(customerVolumes).reduce((a, b) => a + b, 0);
        const topCustomerVolume = Math.max(...Object.values(customerVolumes), 0);
        const topCustomerShare = totalVolume > 0 ? topCustomerVolume / totalVolume : 0;

        return {
            totalInvoicesIssued: totalInvoices,
            paidInvoices,
            cancelledInvoices,
            avgDaysToCollect: paidWithDates > 0 ? Math.round(totalCollectionDays / paidWithDates) : 30,
            topCustomerShare,
        };
    }

    private async getTenureMetrics(walletAddress: string): Promise<TenureMetrics> {
        const [stored] = await db.select({
            firstActivityAt: businessCreditScores.firstActivityAt,
            monthsWithActivity: businessCreditScores.monthsWithActivity,
        })
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        if (stored) {
            return {
                firstActivityDate: stored.firstActivityAt,
                monthsWithActivity: stored.monthsWithActivity,
            };
        }

        // Calculate from invoice data
        const firstInvoice = await db.select({ createdAt: invoices.createdAt })
            .from(invoices)
            .where(eq(invoices.invoicerWalletAddress, walletAddress))
            .orderBy(invoices.createdAt)
            .limit(1);

        return {
            firstActivityDate: firstInvoice[0]?.createdAt || null,
            monthsWithActivity: 0, // Will be calculated properly on full recalc
        };
    }

    private async persistCreditScore(
        walletAddress: string,
        data: {
            overallScore: number;
            tier: CreditTier;
            components: { paymentHistory: number; volume: number; reliability: number; tenure: number };
            metrics: { payer: PayerMetrics; volume: VolumeMetrics; seller: SellerMetrics; tenure: TenureMetrics };
        }
    ): Promise<void> {
        const now = new Date();

        await db.insert(businessCreditScores)
            .values({
                walletAddress,
                overallScore: data.overallScore,
                creditTier: data.tier,
                paymentHistoryScore: data.components.paymentHistory,
                volumeScore: data.components.volume,
                reliabilityScore: data.components.reliability,
                tenureScore: data.components.tenure,
                totalPaymentsMade: data.metrics.payer.totalPayments,
                onTimePayments: data.metrics.payer.onTimePayments,
                latePayments: data.metrics.payer.latePayments,
                avgDaysToPay: data.metrics.payer.avgDaysToPayment,
                lastPaymentDate: data.metrics.payer.lastPaymentDate,
                totalVolumeUsd: data.metrics.volume.totalVolumeUSD.toFixed(2),
                totalInvoicesIssued: data.metrics.volume.totalInvoicesIssued,
                uniqueCounterparties: data.metrics.volume.uniqueCounterparties,
                paidInvoices: data.metrics.seller.paidInvoices,
                cancelledInvoices: data.metrics.seller.cancelledInvoices,
                avgDaysToCollect: data.metrics.seller.avgDaysToCollect,
                topCustomerShare: data.metrics.seller.topCustomerShare.toFixed(4),
                firstActivityAt: data.metrics.tenure.firstActivityDate,
                monthsWithActivity: data.metrics.tenure.monthsWithActivity,
                lastCalculatedAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: businessCreditScores.walletAddress,
                set: {
                    overallScore: data.overallScore,
                    creditTier: data.tier,
                    paymentHistoryScore: data.components.paymentHistory,
                    volumeScore: data.components.volume,
                    reliabilityScore: data.components.reliability,
                    tenureScore: data.components.tenure,
                    totalPaymentsMade: data.metrics.payer.totalPayments,
                    onTimePayments: data.metrics.payer.onTimePayments,
                    latePayments: data.metrics.payer.latePayments,
                    avgDaysToPay: data.metrics.payer.avgDaysToPayment,
                    lastPaymentDate: data.metrics.payer.lastPaymentDate,
                    totalVolumeUsd: data.metrics.volume.totalVolumeUSD.toFixed(2),
                    totalInvoicesIssued: data.metrics.volume.totalInvoicesIssued,
                    uniqueCounterparties: data.metrics.volume.uniqueCounterparties,
                    paidInvoices: data.metrics.seller.paidInvoices,
                    cancelledInvoices: data.metrics.seller.cancelledInvoices,
                    avgDaysToCollect: data.metrics.seller.avgDaysToCollect,
                    topCustomerShare: data.metrics.seller.topCustomerShare.toFixed(4),
                    firstActivityAt: data.metrics.tenure.firstActivityDate,
                    monthsWithActivity: data.metrics.tenure.monthsWithActivity,
                    lastCalculatedAt: now,
                    updatedAt: now,
                },
            });
    }

    private async generateFactorsFromStored(stored: BusinessCreditScore): Promise<{ helping: string[]; hurting: string[] }> {
        const helping: string[] = [];
        const hurting: string[] = [];

        // Payment history
        const onTimeRate = stored.totalPaymentsMade > 0
            ? stored.onTimePayments / stored.totalPaymentsMade
            : 0;

        if (onTimeRate >= 0.9 && stored.totalPaymentsMade > 0) {
            helping.push(`${Math.round(onTimeRate * 100)}% on-time payment rate`);
        } else if (onTimeRate < 0.8 && stored.totalPaymentsMade > 0) {
            hurting.push("Some late payments detected");
        }

        // Volume
        const volumeUsd = parseFloat(stored.totalVolumeUsd || "0");
        if (volumeUsd >= 10000) {
            helping.push(`$${volumeUsd.toLocaleString()} total volume`);
        } else if (volumeUsd < 1000 && stored.totalInvoicesIssued > 0) {
            hurting.push("Limited transaction volume");
        }

        // Tenure
        if (stored.firstActivityAt) {
            const ageDays = dateDiffInDays(stored.firstActivityAt, new Date());
            if (ageDays >= 180) {
                helping.push(`${Math.floor(ageDays / 30)} months on platform`);
            } else if (ageDays < 30) {
                hurting.push("New account");
            }
        }

        return { helping, hurting };
    }

    private generateTipsFromStored(stored: BusinessCreditScore): string[] {
        const tips: string[] = [];

        if (stored.totalPaymentsMade < 3) {
            tips.push("Complete more payments to build your payment history");
        }

        const volumeUsd = parseFloat(stored.totalVolumeUsd || "0");
        if (volumeUsd < 1000) {
            tips.push("Increase your transaction volume to improve your score");
        }

        if (stored.uniqueCounterparties < 3) {
            tips.push("Transact with more unique wallets");
        }

        return tips;
    }

    private queueRecalculation(walletAddress: string): void {
        // For now, we do immediate recalculation
        // In production, this could be a job queue
        setImmediate(async () => {
            try {
                await this.calculateCreditScore(walletAddress);
            } catch (error) {
                logger.error("Background credit score recalculation failed", "credit", { walletAddress, error });
            }
        });
    }
}

// Singleton instance
export const creditScoringService = new CreditScoringService();
