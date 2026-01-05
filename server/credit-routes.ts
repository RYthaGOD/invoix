/**
 * Credit Score API Routes
 * 
 * Exposes credit scoring functionality via REST API
 */

import type { Express, Request, Response, NextFunction } from "express";
import { creditScoringService } from "./credit-scoring-service";
import { logger } from "./logger";

/**
 * Simple auth middleware to require session authentication
 */
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

export function registerCreditRoutes(app: Express): void {

    /**
     * GET /api/credit/score
     * Get the authenticated user's credit score with full breakdown
     */
    app.get("/api/credit/score", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = (req as any).session?.walletAddress;

            // Try to get cached score first
            let score = await creditScoringService.getCachedCreditScore(walletAddress);

            // If no cached score or it's stale (> 24 hours), recalculate
            if (!score || isScoreStale(score.calculatedAt)) {
                score = await creditScoringService.calculateCreditScore(walletAddress);
            }

            res.json({
                success: true,
                score: {
                    overall: score.overallScore,
                    tier: score.tier,
                    tierLabel: getTierLabel(score.tier),
                    components: {
                        paymentHistory: {
                            score: score.components.paymentHistory,
                            weight: 35,
                            label: "Payment History",
                        },
                        volume: {
                            score: score.components.volume,
                            weight: 25,
                            label: "Volume & Scale",
                        },
                        reliability: {
                            score: score.components.reliability,
                            weight: 25,
                            label: "Reliability",
                        },
                        tenure: {
                            score: score.components.tenure,
                            weight: 15,
                            label: "Account Tenure",
                        },
                    },
                    factors: score.factors,
                    tips: score.tips,
                    calculatedAt: score.calculatedAt,
                },
            });
        } catch (error: any) {
            logger.error("Failed to get credit score", "api", { error: error.message });
            res.status(500).json({
                success: false,
                error: "Failed to calculate credit score"
            });
        }
    });

    /**
     * GET /api/credit/score/:walletAddress
     * Get public credit score for any wallet (limited details)
     */
    app.get("/api/credit/score/:walletAddress", async (req: Request, res: Response) => {
        try {
            const { walletAddress } = req.params;

            if (!walletAddress || walletAddress.length < 32) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid wallet address"
                });
            }

            // Get quick score (no recalculation for public lookups)
            const quickScore = await creditScoringService.getQuickScore(walletAddress);

            if (!quickScore) {
                // Return neutral score for unknown wallets
                return res.json({
                    success: true,
                    score: {
                        overall: 500,
                        tier: "new",
                        tierLabel: "New",
                        isNewAccount: true,
                    },
                });
            }

            res.json({
                success: true,
                score: {
                    overall: quickScore.score,
                    tier: quickScore.tier,
                    tierLabel: getTierLabel(quickScore.tier),
                    isNewAccount: false,
                },
            });
        } catch (error: any) {
            logger.error("Failed to get public credit score", "api", { error: error.message });
            res.status(500).json({
                success: false,
                error: "Failed to get credit score"
            });
        }
    });

    /**
     * POST /api/credit/recalculate
     * Force recalculation of authenticated user's credit score
     */
    app.post("/api/credit/recalculate", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = (req as any).session?.walletAddress;

            const score = await creditScoringService.calculateCreditScore(walletAddress);

            res.json({
                success: true,
                score: {
                    overall: score.overallScore,
                    tier: score.tier,
                    tierLabel: getTierLabel(score.tier),
                    calculatedAt: score.calculatedAt,
                },
                message: "Credit score recalculated successfully",
            });
        } catch (error: any) {
            logger.error("Failed to recalculate credit score", "api", { error: error.message });
            res.status(500).json({
                success: false,
                error: "Failed to recalculate credit score"
            });
        }
    });

    /**
     * GET /api/credit/eligibility
     * Check if user is eligible to list on marketplace
     */
    app.get("/api/credit/eligibility", requireAuth, async (req: Request, res: Response) => {
        try {
            const walletAddress = (req as any).session?.walletAddress;

            const quickScore = await creditScoringService.getQuickScore(walletAddress);

            // Eligibility requirements
            const requirements = {
                minimumScore: 450,      // "developing" tier
                minimumTier: "developing",
            };

            const isEligible = quickScore
                ? quickScore.score >= requirements.minimumScore
                : false;

            const currentScore = quickScore?.score || 500;
            const currentTier = quickScore?.tier || "new";
            const pointsNeeded = isEligible ? 0 : requirements.minimumScore - currentScore;

            res.json({
                success: true,
                eligibility: {
                    isEligible,
                    currentScore,
                    currentTier,
                    currentTierLabel: getTierLabel(currentTier),
                    requirements: {
                        minimumScore: requirements.minimumScore,
                        minimumTier: requirements.minimumTier,
                        minimumTierLabel: getTierLabel(requirements.minimumTier),
                    },
                    pointsNeeded,
                    message: isEligible
                        ? "You are eligible to list invoices on the marketplace!"
                        : `You need ${pointsNeeded} more points to reach the ${requirements.minimumTier} tier.`,
                },
            });
        } catch (error: any) {
            logger.error("Failed to check eligibility", "api", { error: error.message });
            res.status(500).json({
                success: false,
                error: "Failed to check eligibility"
            });
        }
    });

    logger.info("Registered credit score routes", "routes");
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTierLabel(tier: string): string {
    const labels: Record<string, string> = {
        prime: "Prime",
        standard: "Standard",
        fair: "Fair",
        developing: "Developing",
        new: "New",
    };
    return labels[tier] || "Unknown";
}

function isScoreStale(calculatedAt: Date): boolean {
    const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - calculatedAt.getTime()) > staleThresholdMs;
}
