/**
 * List Invoice on Marketplace Modal
 * 
 * Dialog for sellers to list their invoices for sale on the marketplace.
 * Validates eligibility, calculates discount rate/yield, and shows risk preview.
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import {
    Store,
    DollarSign,
    TrendingUp,
    AlertTriangle,
    Clock,
    CheckCircle,
    Loader2,
} from "lucide-react";

interface ListInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: {
        id: string;
        invoiceNumber: string;
        totalAmount: string;
        currency: string;
        dueDate: string;
        status: string;
        nftMint?: string;
    } | null;
    onListingCreated?: () => void;
}

export function ListInvoiceModal({
    open,
    onOpenChange,
    invoice,
    onListingCreated
}: ListInvoiceModalProps) {
    const { walletAddress } = useAuth();

    const [eligibility, setEligibility] = useState<{
        eligible: boolean;
        score: number;
        tier: string;
        reasons: string[];
    } | null>(null);
    const [checkingEligibility, setCheckingEligibility] = useState(false);

    const [discountRate, setDiscountRate] = useState(10);
    const [askingPrice, setAskingPrice] = useState("");
    const [description, setDescription] = useState("");
    const [expiresInDays, setExpiresInDays] = useState(30);
    const [submitting, setSubmitting] = useState(false);

    // Calculate values when invoice or discount changes
    useEffect(() => {
        if (invoice) {
            const faceValue = parseFloat(invoice.totalAmount);
            const price = faceValue * (1 - discountRate / 100);
            setAskingPrice(price.toFixed(2));

            // Check eligibility when modal opens
            checkEligibility();
        }
    }, [invoice, discountRate]);

    const checkEligibility = async () => {
        setCheckingEligibility(true);
        try {
            const response = await fetch("/api/credit/eligibility", {
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                setEligibility(data.eligibility);
            } else {
                setEligibility({
                    eligible: false,
                    score: 0,
                    tier: "unknown",
                    reasons: ["Unable to check eligibility. Please try again."],
                });
            }
        } catch (err) {
            console.error("Eligibility check failed:", err);
        } finally {
            setCheckingEligibility(false);
        }
    };

    const handleSubmit = async () => {
        if (!invoice || !walletAddress) return;

        // Validation
        if (!invoice.nftMint) {
            toast({
                title: "NFT Required",
                description: "This invoice must be minted as an NFT before listing. Please mint it first.",
                variant: "destructive",
            });
            return;
        }

        if (invoice.status !== "sent") {
            toast({
                title: "Invalid Status",
                description: "Only sent invoices can be listed on the marketplace.",
                variant: "destructive",
            });
            return;
        }

        if (discountRate > 50) {
            toast({
                title: "Discount Too High",
                description: "Maximum discount is 50%.",
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/api/marketplace/list", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    invoiceId: invoice.id,
                    askingPrice,
                    description: description || undefined,
                    expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to list invoice");
            }

            toast({
                title: "Listed Successfully!",
                description: `Invoice ${invoice.invoiceNumber} is now live on the marketplace.`,
            });

            onOpenChange(false);
            onListingCreated?.();
        } catch (err: any) {
            toast({
                title: "Listing Failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!invoice) return null;

    const faceValue = parseFloat(invoice.totalAmount);
    const yieldPct = discountRate > 0 ? (discountRate / (100 - discountRate)) * 100 : 0;
    const daysUntilDue = Math.ceil(
        (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-background border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Store className="w-5 h-5 text-purple-400" />
                        List Invoice on Marketplace
                    </DialogTitle>
                    <DialogDescription>
                        Sell Invoice {invoice.invoiceNumber} for immediate cash flow.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Eligibility Status */}
                    {checkingEligibility ? (
                        <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking eligibility...
                        </div>
                    ) : eligibility && (
                        <div className={`p-4 rounded-lg border ${eligibility.eligible
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-red-500/10 border-red-500/30"
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {eligibility.eligible ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                )}
                                <span className={eligibility.eligible ? "text-emerald-400" : "text-red-400"}>
                                    {eligibility.eligible ? "Eligible to List" : "Not Eligible"}
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">
                                Credit Score: {eligibility.score} ({eligibility.tier})
                            </div>
                            {!eligibility.eligible && eligibility.reasons.length > 0 && (
                                <ul className="mt-2 text-sm text-red-400 list-disc list-inside">
                                    {eligibility.reasons.map((reason, i) => (
                                        <li key={i}>{reason}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Invoice Info */}
                    <div className="glass-card p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Face Value</span>
                            <span className="text-white font-semibold">
                                {faceValue.toLocaleString()} {invoice.currency}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Due Date</span>
                            <span className={`flex items-center gap-1 ${daysUntilDue < 7 ? "text-orange-400" : "text-white"}`}>
                                <Clock className="w-4 h-4" />
                                {daysUntilDue} days
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">NFT Status</span>
                            <span className={invoice.nftMint ? "text-emerald-400" : "text-yellow-400"}>
                                {invoice.nftMint ? "✓ Minted" : "⚠ Not Minted"}
                            </span>
                        </div>
                    </div>

                    {/* Discount Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Discount Rate</Label>
                            <span className="text-purple-400 font-bold text-lg">{discountRate}%</span>
                        </div>
                        <Slider
                            value={[discountRate]}
                            onValueChange={(values) => setDiscountRate(values[0])}
                            min={1}
                            max={50}
                            step={1}
                            className="py-4"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>1% (Conservative)</span>
                            <span>25% (Standard)</span>
                            <span>50% (Max)</span>
                        </div>
                    </div>

                    {/* Calculated Values */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Asking Price</div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-purple-400" />
                                <span className="text-xl font-bold text-white">
                                    {parseFloat(askingPrice).toLocaleString()}
                                </span>
                                <span className="text-gray-400">{invoice.currency}</span>
                            </div>
                        </div>
                        <div className="glass-card p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buyer Yield</div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className={`w-5 h-5 ${yieldPct >= 10 ? "text-emerald-400" : "text-yellow-400"}`} />
                                <span className={`text-xl font-bold ${yieldPct >= 10 ? "text-emerald-400" : "text-yellow-400"}`}>
                                    {yieldPct.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Add details about this invoice for potential buyers..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-white/5 border-white/10 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Expiration */}
                    <div className="space-y-2">
                        <Label htmlFor="expires">Listing Expires In (Days)</Label>
                        <Input
                            id="expires"
                            type="number"
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 0)}
                            min={0}
                            max={90}
                            className="bg-white/5 border-white/10"
                        />
                        <p className="text-xs text-gray-500">
                            Set to 0 for no expiration. Recommended: 30 days.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !eligibility?.eligible}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Listing...
                            </>
                        ) : (
                            <>
                                <Store className="w-4 h-4 mr-2" />
                                List for Sale
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ListInvoiceModal;
