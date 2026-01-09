/**
 * Sell Invoice Dialog
 * 
 * Modal dialog for listing an invoice on the marketplace
 */

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { listInvoice } from "../../lib/marketplace-sdk";
import { Send, AlertCircle, TrendingUp, Info } from "lucide-react";
import { motion } from "framer-motion";

interface SellInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: {
        id: string;
        invoiceNumber: string;
        totalAmount: string;
        currency: string;
        dueDate: string;
        nftMint?: string;
    };
    onSuccess?: () => void;
}

export function SellInvoiceDialog({
    open,
    onOpenChange,
    invoice,
    onSuccess,
}: SellInvoiceDialogProps) {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();

    const [askingPrice, setAskingPrice] = useState("");
    const [description, setDescription] = useState("");
    const [expiresInDays, setExpiresInDays] = useState(30);
    const [isListing, setIsListing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const faceValue = parseFloat(invoice.totalAmount);
    const asking = parseFloat(askingPrice) || 0;
    const discount = asking > 0 ? (((faceValue - asking) / faceValue) * 100) : 0;
    const yieldPct = asking > 0 ? (((faceValue - asking) / asking) * 100) : 0;

    const handleList = async () => {
        if (!publicKey || !signTransaction) {
            setError("Please connect your wallet first");
            return;
        }

        if (!invoice.nftMint) {
            setError("Invoice must be minted as NFT before listing");
            return;
        }

        if (!askingPrice || asking <= 0) {
            setError("Please enter a valid asking price");
            return;
        }

        if (asking >= faceValue) {
            setError("Asking price must be less than face value");
            return;
        }

        setError(null);
        setIsListing(true);

        try {
            // Call marketplace API to create listing and get transaction
            const response = await listInvoice({
                invoiceId: invoice.id,
                askingPrice: askingPrice,
                description: description || undefined,
                expiresInDays: expiresInDays || undefined,
            });

            // Decode and sign the transaction
            const txBuffer = Buffer.from(response.transaction, "base64");
            const transaction = Transaction.from(txBuffer);

            const signedTx = await signTransaction(transaction);

            // Send the transaction
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            // Wait for confirmation
            await connection.confirmTransaction(signature, "confirmed");

            // Success!
            onSuccess?.();
            onOpenChange(false);

            // Reset form
            setAskingPrice("");
            setDescription("");
            setExpiresInDays(30);
        } catch (err: any) {
            console.error("Listing error:", err);
            setError(err.message || "Failed to list invoice");
        } finally {
            setIsListing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5 text-purple-500" />
                        Sell Invoice on Marketplace
                    </DialogTitle>
                    <DialogDescription>
                        List your invoice for sale to get immediate cash flow. Investors will purchase it at a discount.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Invoice Info */}
                    <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Invoice:</span>
                            <span className="font-mono">{invoice.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Face Value:</span>
                            <span className="font-semibold">{invoice.totalAmount} {invoice.currency}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Due Date:</span>
                            <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Asking Price */}
                    <div className="space-y-2">
                        <Label htmlFor="askingPrice">Asking Price ({invoice.currency})</Label>
                        <Input
                            id="askingPrice"
                            type="number"
                            step="0.01"
                            placeholder={`Less than ${invoice.totalAmount}`}
                            value={askingPrice}
                            onChange={(e) => setAskingPrice(e.target.value)}
                            disabled={isListing}
                        />
                        <p className="text-xs text-zinc-500">
                            The price investors will pay to purchase your invoice
                        </p>
                    </div>

                    {/* Calculated Metrics */}
                    {asking > 0 && asking < faceValue && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-2 gap-3"
                        >
                            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-lg p-3">
                                <div className="text-xs text-orange-400 mb-1">You Receive</div>
                                <div className="text-2xl font-bold text-orange-300">
                                    {asking.toFixed(2)} {invoice.currency}
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">
                                    {discount.toFixed(1)}% discount
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-3">
                                <div className="text-xs text-green-400 mb-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Buyer Yield
                                </div>
                                <div className="text-2xl font-bold text-green-300">
                                    {yieldPct.toFixed(1)}%
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">
                                    ROI when paid
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Add context about this invoice for potential buyers..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            disabled={isListing}
                        />
                    </div>

                    {/* Expiration */}
                    <div className="space-y-2">
                        <Label htmlFor="expiresInDays">Listing Duration (days)</Label>
                        <Input
                            id="expiresInDays"
                            type="number"
                            min="1"
                            max="90"
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                            disabled={isListing}
                        />
                        <p className="text-xs text-zinc-500">
                            How long your listing remains active on the marketplace
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-zinc-300">
                            <p className="font-medium text-blue-300 mb-1">How it works</p>
                            <p className="text-xs text-zinc-400">
                                Your invoice NFT will be transferred to an escrow vault. When an investor purchases it,
                                you'll receive the asking price immediately. The buyer gets the NFT and will receive payment
                                when your customer pays the invoice.
                            </p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-2"
                        >
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-sm text-red-300">{error}</p>
                        </motion.div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isListing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleList}
                        disabled={isListing || !askingPrice || asking <= 0 || asking >= faceValue}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                        {isListing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Listing...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                List on Marketplace
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
