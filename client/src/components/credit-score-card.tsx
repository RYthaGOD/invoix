/**
 * Credit Score Card Component
 * 
 * Displays the user's credit score with a visual breakdown
 * and helpful factors/tips
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, TrendingDown, Info, CheckCircle, AlertCircle } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreditScoreComponent {
    score: number;
    weight: number;
    label: string;
}

interface CreditScoreData {
    overall: number;
    tier: string;
    tierLabel: string;
    components: {
        paymentHistory: CreditScoreComponent;
        volume: CreditScoreComponent;
        reliability: CreditScoreComponent;
        tenure: CreditScoreComponent;
    };
    factors: {
        helping: string[];
        hurting: string[];
    };
    tips: string[];
    calculatedAt: string;
}

interface CreditScoreCardProps {
    walletAddress?: string;
    compact?: boolean;
    showRecalculate?: boolean;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    prime: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/50" },
    standard: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" },
    fair: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/50" },
    developing: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
    new: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/50" },
};

function getScoreColor(score: number): string {
    if (score >= 750) return "text-emerald-400";
    if (score >= 650) return "text-blue-400";
    if (score >= 550) return "text-yellow-400";
    if (score >= 450) return "text-orange-400";
    return "text-gray-400";
}

function getProgressWidth(score: number): number {
    // Map 300-850 to 0-100%
    return Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
}

export function CreditScoreCard({ walletAddress, compact = false, showRecalculate = true }: CreditScoreCardProps) {
    const [scoreData, setScoreData] = useState<CreditScoreData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [recalculating, setRecalculating] = useState(false);

    const fetchCreditScore = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/credit/score", {
                credentials: "include",
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setError("Please connect your wallet to view your credit score");
                } else {
                    throw new Error("Failed to fetch credit score");
                }
                return;
            }

            const data = await response.json();
            if (data.success) {
                setScoreData(data.score);
            } else {
                throw new Error(data.error || "Unknown error");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async () => {
        try {
            setRecalculating(true);

            const response = await fetch("/api/credit/recalculate", {
                method: "POST",
                credentials: "include",
            });

            const data = await response.json();
            if (data.success) {
                // Refetch the full score data
                await fetchCreditScore();
            }
        } catch (err: any) {
            console.error("Recalculate error:", err);
        } finally {
            setRecalculating(false);
        }
    };

    useEffect(() => {
        fetchCreditScore();
    }, [walletAddress]);

    if (loading) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!scoreData) {
        return null;
    }

    const tierColors = TIER_COLORS[scoreData.tier] || TIER_COLORS.new;

    // Compact view for dashboard widgets
    if (compact) {
        return (
            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Credit Score</p>
                            <p className={`text-3xl font-bold ${getScoreColor(scoreData.overall)}`}>
                                {scoreData.overall}
                            </p>
                        </div>
                        <Badge className={`${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
                            {scoreData.tierLabel}
                        </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 h-2 w-full rounded-full bg-secondary">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${scoreData.overall >= 750 ? "bg-emerald-500" :
                                    scoreData.overall >= 650 ? "bg-blue-500" :
                                        scoreData.overall >= 550 ? "bg-yellow-500" :
                                            scoreData.overall >= 450 ? "bg-orange-500" : "bg-gray-500"
                                }`}
                            style={{ width: `${getProgressWidth(scoreData.overall)}%` }}
                        />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>300</span>
                        <span>850</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Full view with breakdown
    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Credit Score
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p>Your credit score determines your eligibility to list invoices on the marketplace and affects the risk assessment for buyers.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </CardTitle>
                        <CardDescription>
                            Last updated: {new Date(scoreData.calculatedAt).toLocaleDateString()}
                        </CardDescription>
                    </div>
                    {showRecalculate && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRecalculate}
                            disabled={recalculating}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Main Score Display */}
                <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                        <p className={`text-6xl font-bold ${getScoreColor(scoreData.overall)}`}>
                            {scoreData.overall}
                        </p>
                        <Badge className={`mt-2 ${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
                            {scoreData.tierLabel}
                        </Badge>
                    </div>
                </div>

                {/* Progress bar */}
                <div>
                    <div className="h-3 w-full rounded-full bg-secondary">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${scoreData.overall >= 750 ? "bg-emerald-500" :
                                    scoreData.overall >= 650 ? "bg-blue-500" :
                                        scoreData.overall >= 550 ? "bg-yellow-500" :
                                            scoreData.overall >= 450 ? "bg-orange-500" : "bg-gray-500"
                                }`}
                            style={{ width: `${getProgressWidth(scoreData.overall)}%` }}
                        />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>300 (New)</span>
                        <span>450 (Dev)</span>
                        <span>550 (Fair)</span>
                        <span>650 (Std)</span>
                        <span>750+ (Prime)</span>
                    </div>
                </div>

                {/* Component Breakdown */}
                <div>
                    <h4 className="mb-3 font-semibold">Score Breakdown</h4>
                    <div className="space-y-3">
                        {Object.entries(scoreData.components).map(([key, component]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span>{component.label}</span>
                                    <span className={getScoreColor(component.score)}>
                                        {component.score} <span className="text-muted-foreground">({component.weight}%)</span>
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-secondary">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${component.score >= 750 ? "bg-emerald-500/70" :
                                                component.score >= 650 ? "bg-blue-500/70" :
                                                    component.score >= 550 ? "bg-yellow-500/70" :
                                                        component.score >= 450 ? "bg-orange-500/70" : "bg-gray-500/70"
                                            }`}
                                        style={{ width: `${getProgressWidth(component.score)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Factors */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Helping Factors */}
                    {scoreData.factors.helping.length > 0 && (
                        <div>
                            <h4 className="mb-2 flex items-center gap-2 font-semibold text-emerald-400">
                                <TrendingUp className="h-4 w-4" />
                                What's Helping
                            </h4>
                            <ul className="space-y-1">
                                {scoreData.factors.helping.map((factor, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                                        {factor}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Hurting Factors */}
                    {scoreData.factors.hurting.length > 0 && (
                        <div>
                            <h4 className="mb-2 flex items-center gap-2 font-semibold text-red-400">
                                <TrendingDown className="h-4 w-4" />
                                What's Hurting
                            </h4>
                            <ul className="space-y-1">
                                {scoreData.factors.hurting.map((factor, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                                        {factor}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Tips */}
                {scoreData.tips.length > 0 && (
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                        <h4 className="mb-2 font-semibold text-blue-400">Tips to Improve</h4>
                        <ul className="space-y-1">
                            {scoreData.tips.map((tip, i) => (
                                <li key={i} className="text-sm text-muted-foreground">
                                    → {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default CreditScoreCard;
