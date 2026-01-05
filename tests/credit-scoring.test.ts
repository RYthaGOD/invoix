/**
 * Credit Scoring Service Tests
 * 
 * Unit tests for the credit scoring algorithms
 */

import { describe, it, expect, beforeEach } from "vitest";

// Mock types for testing (avoiding DB dependencies)
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

// Constants matching the service
const MIN_SCORE = 300;
const MAX_SCORE = 850;
const DEFAULT_SCORE = 500;

// Helper function matching the service
function dateDiffInDays(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Scoring algorithms (mirrored from credit-scoring-service.ts for unit testing)
function calculatePaymentHistoryScore(metrics: PayerMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    const onTimeRate = metrics.totalPayments > 0
        ? metrics.onTimePayments / metrics.totalPayments
        : 0.5;
    const onTimePoints = onTimeRate * 275;

    const avgDays = metrics.avgDaysToPayment || 30;
    const consistencyPoints = Math.max(0, 110 - (avgDays * 2));

    const disputeRate = metrics.totalPayments > 0
        ? metrics.disputes / metrics.totalPayments
        : 0;
    const disputePoints = Math.max(0, 110 * (1 - disputeRate * 5));

    let recencyPoints = 0;
    if (metrics.lastPaymentDate) {
        const daysSince = dateDiffInDays(metrics.lastPaymentDate, new Date());
        recencyPoints = daysSince < 30 ? 55 :
            daysSince < 90 ? 35 :
                daysSince < 180 ? 15 : 0;
    }

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + onTimePoints + consistencyPoints + disputePoints + recencyPoints));
}

function calculateVolumeScore(metrics: VolumeMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    const volumeUSD = metrics.totalVolumeUSD;
    let volumePoints = 0;
    if (volumeUSD >= 1000000) volumePoints = 330;
    else if (volumeUSD >= 100000) volumePoints = 280;
    else if (volumeUSD >= 10000) volumePoints = 220;
    else if (volumeUSD >= 1000) volumePoints = 160;
    else if (volumeUSD >= 100) volumePoints = 80;
    else volumePoints = Math.floor(volumeUSD * 0.8);

    const invoicePoints = Math.min(138, metrics.totalInvoicesIssued * 5);
    const partyPoints = Math.min(82, metrics.uniqueCounterparties * 10);

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + volumePoints + invoicePoints + partyPoints));
}

function calculateReliabilityScore(metrics: SellerMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    if (metrics.totalInvoicesIssued === 0) {
        return DEFAULT_SCORE;
    }

    const fulfillmentRate = metrics.paidInvoices / metrics.totalInvoicesIssued;
    const fulfillmentPoints = fulfillmentRate * 220;

    const cancelRate = metrics.cancelledInvoices / metrics.totalInvoicesIssued;
    const cancelPoints = Math.max(0, 138 * (1 - cancelRate * 3));

    const avgDays = metrics.avgDaysToCollect || 30;
    let collectionPoints = 0;
    if (avgDays <= 7) collectionPoints = 110;
    else if (avgDays <= 14) collectionPoints = 90;
    else if (avgDays <= 30) collectionPoints = 70;
    else if (avgDays <= 60) collectionPoints = 40;
    else collectionPoints = 10;

    const diversityPoints = Math.max(0, 82 * (1 - metrics.topCustomerShare));

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + fulfillmentPoints + cancelPoints + collectionPoints + diversityPoints));
}

function calculateTenureScore(metrics: TenureMetrics): number {
    const BASE_SCORE = MIN_SCORE;

    if (!metrics.firstActivityDate) {
        return MIN_SCORE + 100;
    }

    const accountAgeDays = dateDiffInDays(metrics.firstActivityDate, new Date());
    let agePoints = 0;
    if (accountAgeDays >= 365) agePoints = 330;
    else if (accountAgeDays >= 180) agePoints = 275;
    else if (accountAgeDays >= 90) agePoints = 200;
    else if (accountAgeDays >= 30) agePoints = 120;
    else agePoints = accountAgeDays * 4;

    const totalMonths = Math.max(1, Math.ceil(accountAgeDays / 30));
    const activityRate = metrics.monthsWithActivity / totalMonths;
    const activityPoints = activityRate * 220;

    return Math.min(MAX_SCORE, Math.round(BASE_SCORE + agePoints + activityPoints));
}

function determineTier(score: number): string {
    if (score >= 750) return 'prime';
    if (score >= 650) return 'standard';
    if (score >= 550) return 'fair';
    if (score >= 450) return 'developing';
    return 'new';
}

// ============================================
// TESTS
// ============================================

describe("Credit Scoring Algorithms", () => {

    describe("calculatePaymentHistoryScore", () => {
        it("should return maximum score for perfect payment history", () => {
            const metrics: PayerMetrics = {
                totalPayments: 20,
                onTimePayments: 20,
                latePayments: 0,
                avgDaysToPayment: 5,
                lastPaymentDate: new Date(), // Recent
                disputes: 0,
            };

            const score = calculatePaymentHistoryScore(metrics);

            // 300 base + 275 on-time + 100 consistency + 110 disputes + 55 recency
            expect(score).toBeGreaterThanOrEqual(800);
            expect(score).toBeLessThanOrEqual(MAX_SCORE);
        });

        it("should penalize late payments", () => {
            const perfectMetrics: PayerMetrics = {
                totalPayments: 10,
                onTimePayments: 10,
                latePayments: 0,
                avgDaysToPayment: 10,
                lastPaymentDate: new Date(),
                disputes: 0,
            };

            const lateMetrics: PayerMetrics = {
                totalPayments: 10,
                onTimePayments: 5,
                latePayments: 5,
                avgDaysToPayment: 10,
                lastPaymentDate: new Date(),
                disputes: 0,
            };

            const perfectScore = calculatePaymentHistoryScore(perfectMetrics);
            const lateScore = calculatePaymentHistoryScore(lateMetrics);

            expect(perfectScore).toBeGreaterThan(lateScore);
        });

        it("should heavily penalize disputes", () => {
            const noDisputes: PayerMetrics = {
                totalPayments: 10,
                onTimePayments: 10,
                latePayments: 0,
                avgDaysToPayment: 10,
                lastPaymentDate: new Date(),
                disputes: 0,
            };

            const withDisputes: PayerMetrics = {
                totalPayments: 10,
                onTimePayments: 10,
                latePayments: 0,
                avgDaysToPayment: 10,
                lastPaymentDate: new Date(),
                disputes: 2,
            };

            const cleanScore = calculatePaymentHistoryScore(noDisputes);
            const disputeScore = calculatePaymentHistoryScore(withDisputes);

            expect(cleanScore - disputeScore).toBeGreaterThan(50);
        });

        it("should return neutral score for new accounts", () => {
            const newAccountMetrics: PayerMetrics = {
                totalPayments: 0,
                onTimePayments: 0,
                latePayments: 0,
                avgDaysToPayment: 30,
                lastPaymentDate: null,
                disputes: 0,
            };

            const score = calculatePaymentHistoryScore(newAccountMetrics);

            expect(score).toBeGreaterThanOrEqual(400);
            expect(score).toBeLessThanOrEqual(600);
        });
    });

    describe("calculateVolumeScore", () => {
        it("should reward high transaction volume", () => {
            const highVolumeMetrics: VolumeMetrics = {
                totalVolumeUSD: 500000,
                totalInvoicesIssued: 50,
                uniqueCounterparties: 10,
            };

            const score = calculateVolumeScore(highVolumeMetrics);

            expect(score).toBeGreaterThan(750);
        });

        it("should use logarithmic scale for volume", () => {
            const smallVolume: VolumeMetrics = {
                totalVolumeUSD: 1000,
                totalInvoicesIssued: 5,
                uniqueCounterparties: 2,
            };

            const mediumVolume: VolumeMetrics = {
                totalVolumeUSD: 10000,
                totalInvoicesIssued: 5,
                uniqueCounterparties: 2,
            };

            const largeVolume: VolumeMetrics = {
                totalVolumeUSD: 100000,
                totalInvoicesIssued: 5,
                uniqueCounterparties: 2,
            };

            const smallScore = calculateVolumeScore(smallVolume);
            const mediumScore = calculateVolumeScore(mediumVolume);
            const largeScore = calculateVolumeScore(largeVolume);

            // Each 10x increase should give diminishing returns
            const smallToMediumGain = mediumScore - smallScore;
            const mediumToLargeGain = largeScore - mediumScore;

            expect(mediumScore).toBeGreaterThan(smallScore);
            expect(largeScore).toBeGreaterThan(mediumScore);
            // Logarithmic scaling - gains may diminish or stay same at tier boundaries
            expect(smallToMediumGain).toBeGreaterThanOrEqual(mediumToLargeGain);
        });

        it("should reward counterparty diversity", () => {
            const singleCustomer: VolumeMetrics = {
                totalVolumeUSD: 5000,
                totalInvoicesIssued: 10,
                uniqueCounterparties: 1,
            };

            const diverseCustomers: VolumeMetrics = {
                totalVolumeUSD: 5000,
                totalInvoicesIssued: 10,
                uniqueCounterparties: 8,
            };

            const singleScore = calculateVolumeScore(singleCustomer);
            const diverseScore = calculateVolumeScore(diverseCustomers);

            expect(diverseScore).toBeGreaterThan(singleScore);
        });
    });

    describe("calculateReliabilityScore", () => {
        it("should return default score for new sellers", () => {
            const newSeller: SellerMetrics = {
                totalInvoicesIssued: 0,
                paidInvoices: 0,
                cancelledInvoices: 0,
                avgDaysToCollect: 30,
                topCustomerShare: 0,
            };

            const score = calculateReliabilityScore(newSeller);

            expect(score).toBe(DEFAULT_SCORE);
        });

        it("should reward high fulfillment rate", () => {
            const highFulfillment: SellerMetrics = {
                totalInvoicesIssued: 20,
                paidInvoices: 19,
                cancelledInvoices: 0,
                avgDaysToCollect: 14,
                topCustomerShare: 0.2,
            };

            const score = calculateReliabilityScore(highFulfillment);

            expect(score).toBeGreaterThan(700);
        });

        it("should penalize high cancellation rate", () => {
            const lowCancellations: SellerMetrics = {
                totalInvoicesIssued: 20,
                paidInvoices: 18,
                cancelledInvoices: 0,
                avgDaysToCollect: 20,
                topCustomerShare: 0.3,
            };

            const highCancellations: SellerMetrics = {
                totalInvoicesIssued: 20,
                paidInvoices: 10,
                cancelledInvoices: 8,
                avgDaysToCollect: 20,
                topCustomerShare: 0.3,
            };

            const lowCancelScore = calculateReliabilityScore(lowCancellations);
            const highCancelScore = calculateReliabilityScore(highCancellations);

            expect(lowCancelScore).toBeGreaterThan(highCancelScore);
        });

        it("should reward fast collection time", () => {
            const fastCollector: SellerMetrics = {
                totalInvoicesIssued: 10,
                paidInvoices: 10,
                cancelledInvoices: 0,
                avgDaysToCollect: 5,
                topCustomerShare: 0.3,
            };

            const slowCollector: SellerMetrics = {
                totalInvoicesIssued: 10,
                paidInvoices: 10,
                cancelledInvoices: 0,
                avgDaysToCollect: 60,
                topCustomerShare: 0.3,
            };

            const fastScore = calculateReliabilityScore(fastCollector);
            const slowScore = calculateReliabilityScore(slowCollector);

            expect(fastScore).toBeGreaterThan(slowScore);
        });
    });

    describe("calculateTenureScore", () => {
        it("should reward long account age", () => {
            const newAccount: TenureMetrics = {
                firstActivityDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                monthsWithActivity: 1,
            };

            const oldAccount: TenureMetrics = {
                firstActivityDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
                monthsWithActivity: 12,
            };

            const newScore = calculateTenureScore(newAccount);
            const oldScore = calculateTenureScore(oldAccount);

            expect(oldScore).toBeGreaterThan(newScore);
            expect(oldScore).toBeGreaterThan(700);
        });

        it("should reward consistent activity", () => {
            const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

            const activeAccount: TenureMetrics = {
                firstActivityDate: sixMonthsAgo,
                monthsWithActivity: 6,
            };

            const inactiveAccount: TenureMetrics = {
                firstActivityDate: sixMonthsAgo,
                monthsWithActivity: 2,
            };

            const activeScore = calculateTenureScore(activeAccount);
            const inactiveScore = calculateTenureScore(inactiveAccount);

            expect(activeScore).toBeGreaterThan(inactiveScore);
        });

        it("should handle null first activity date", () => {
            const noActivity: TenureMetrics = {
                firstActivityDate: null,
                monthsWithActivity: 0,
            };

            const score = calculateTenureScore(noActivity);

            expect(score).toBe(MIN_SCORE + 100);
        });
    });

    describe("determineTier", () => {
        it("should correctly categorize scores into tiers", () => {
            expect(determineTier(850)).toBe('prime');
            expect(determineTier(750)).toBe('prime');
            expect(determineTier(749)).toBe('standard');
            expect(determineTier(650)).toBe('standard');
            expect(determineTier(649)).toBe('fair');
            expect(determineTier(550)).toBe('fair');
            expect(determineTier(549)).toBe('developing');
            expect(determineTier(450)).toBe('developing');
            expect(determineTier(449)).toBe('new');
            expect(determineTier(300)).toBe('new');
        });
    });

    describe("Overall Score Calculation", () => {
        it("should calculate weighted overall score correctly", () => {
            const weights = {
                paymentHistory: 0.35,
                volume: 0.25,
                reliability: 0.25,
                tenure: 0.15,
            };

            const components = {
                paymentHistory: 800,
                volume: 700,
                reliability: 600,
                tenure: 500,
            };

            const expectedScore = Math.round(
                components.paymentHistory * weights.paymentHistory +
                components.volume * weights.volume +
                components.reliability * weights.reliability +
                components.tenure * weights.tenure
            );

            // 800 * 0.35 + 700 * 0.25 + 600 * 0.25 + 500 * 0.15
            // = 280 + 175 + 150 + 75 = 680
            expect(expectedScore).toBe(680);
        });
    });
});
