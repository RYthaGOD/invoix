/**
 * Public Payment Page
 * Allows customers to pay invoices via shareable link (no login required)
 */

import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { CheckCircle, Clock, AlertCircle, ExternalLink, Copy, Check } from "lucide-react";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";

interface Invoice {
    id: string;
    invoiceNumber: string;
    invoicerWalletAddress: string;
    invoiceeWalletAddress: string;
    totalAmount: string;
    paidAmount: string;
    remainingAmount: string;
    currency: string;
    tokenMint: string;
    tokenDecimals: number;
    status: string;
    dueDate: string;
    description: string;
    createdAt: string;
}

export default function PayInvoice() {
    const [, params] = useRoute("/pay/:invoiceId");
    const invoiceId = params?.invoiceId;

    const { connection } = useConnection();
    const { publicKey, sendTransaction, signTransaction } = useWallet();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paying, setPaying] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Accounting & Notes State
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isBusinessExpense, setIsBusinessExpense] = useState(false);

    // Fetch invoice details
    useEffect(() => {
        if (!invoiceId) return;

        fetch(`/api/invoices/${invoiceId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setInvoice(data.invoice);
                } else {
                    setError(data.message || "Invoice not found");
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [invoiceId]);

    const copyPaymentLink = () => {
        const link = window.location.href;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePayment = async () => {
        if (!invoice || !publicKey) return;

        setPaying(true);
        setError(null);

        try {
            // 1. Fetch Fee Payer Config
            const configRes = await fetch("/api/config/fee-payer");
            const config = await configRes.json();

            if (!config.success) {
                throw new Error("Gasless payment not available: " + config.message);
            }

            const FEE_PAYER_PUBKEY = new PublicKey(config.feePayer);
            // Use configured fee or fallback to safe default (0.15)
            const GAS_FEE_AMOUNT = config.feeAmount || 0.15;
            const TREASURY_ADDRESS = new PublicKey(config.treasuryAddress || TREASURY_WALLET_ADDRESS);

            const amountToPay = parseFloat(invoice.remainingAmount);

            // Platform Fee Calculation (1% + Gas Fee)
            // Note: The original 1% fee was subtracted from recipientAmount in previous code?
            // "const recipientAmount = amountToPay - feeAmount;" -> Implementation meant Payer pays Total, Recipient gets 99%.
            // NOW: We want Payer to pay Total + Gas Fee.
            // OR: Payer pays Total, and Gas Fee is deducted?
            // User request: "add a small amount as a fee to the transaction to recover"
            // So: User Pays = Invoice Amount (100) + Gas Fee (0.15). Recipient gets 99, Treasury gets 1 + 0.15.

            const platformFeeRate = 0.01;
            const platformFeeAmount = amountToPay * platformFeeRate; // 1% of invoice
            const recipientAmount = amountToPay - platformFeeAmount; // 99% of invoice

            // Gas Recovery Fee is EXTRA separate transfer
            const gasFeeAmount = GAS_FEE_AMOUNT;

            // Convert to Atomic Units
            const decimals = invoice.tokenDecimals;
            const toAtomic = (val: number) => Math.floor(val * Math.pow(10, decimals));

            const platformFeeLamports = toAtomic(platformFeeAmount);
            const recipientLamports = toAtomic(recipientAmount);
            const gasFeeLamports = toAtomic(gasFeeAmount);

            // Get token accounts
            const recipientPubkey = new PublicKey(invoice.invoicerWalletAddress);
            const mintPubkey = new PublicKey(invoice.tokenMint);

            const senderTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                publicKey
            );

            const recipientTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                recipientPubkey
            );

            const treasuryTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                TREASURY_ADDRESS
            );

            const transaction = new Transaction();
            transaction.feePayer = FEE_PAYER_PUBKEY; // SET FEE PAYER TO PROTOCOL

            // Import instructions
            const { createAssociatedTokenAccountInstruction, createTransferInstruction } = await import('@solana/spl-token');

            // 1. Check/Create Recipient ATA (Payer pays rent for this if needed? Or Protocol?)
            // If Protocol is fee payer, Protocol pays rent!
            const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
            if (!recipientAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        FEE_PAYER_PUBKEY, // Payer creates account (Protocol pays rent)
                        recipientTokenAccount,
                        recipientPubkey,
                        mintPubkey
                    )
                );
            }

            // 2. Check/Create Treasury ATA
            const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
            if (!treasuryAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        FEE_PAYER_PUBKEY,
                        treasuryTokenAccount,
                        TREASURY_ADDRESS,
                        mintPubkey
                    )
                );
            }

            // 3. Transfer to Recipient (99%)
            if (recipientLamports > 0) {
                transaction.add(
                    createTransferInstruction(
                        senderTokenAccount,
                        recipientTokenAccount,
                        publicKey,
                        recipientLamports,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            // 4. Transfer Platform Fee (1%)
            if (platformFeeLamports > 0) {
                transaction.add(
                    createTransferInstruction(
                        senderTokenAccount,
                        treasuryTokenAccount,
                        publicKey,
                        platformFeeLamports,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            // 5. Transfer Gas Recovery Fee (0.15 USDC)
            if (gasFeeLamports > 0) {
                transaction.add(
                    createTransferInstruction(
                        senderTokenAccount,
                        treasuryTokenAccount,
                        publicKey,
                        gasFeeLamports,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );
            }

            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            transaction.recentBlockhash = blockhash;

            // PARTIAL SIGN BY USER
            // User signs to authorize transfers from their wallet
            const signedTx = await signTransaction!(transaction);

            // Serialize and Send to Backend Relay
            const serializedTx = signedTx.serialize({ requireAllSignatures: false });
            const txBase64 = serializedTx.toString('base64');

            const relayResponse = await fetch("/api/payments/relay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transaction: txBase64,
                    invoiceId: invoice.id
                })
            });

            const relayResult = await relayResponse.json();

            if (!relayResult.success) {
                throw new Error(relayResult.message || "Payment relay failed");
            }

            const signature = relayResult.signature;

            // Wait for confirmation
            let confirmed = false;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await connection.confirmTransaction(signature, 'confirmed');
                    confirmed = true;
                    break;
                } catch (confirmError) {
                    if (attempt === 2) throw confirmError;
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
                }
            }

            setTxSignature(signature);

            // Record payment in database
            const paymentData = {
                invoiceId: invoice.id,
                amount: invoice.remainingAmount, // Full amount recorded as paid
                currency: invoice.currency,
                txSignature: signature,
                fromAddress: publicKey.toString(),
                toAddress: invoice.invoicerWalletAddress,
                paymentMethod: "gasless_transfer",
                status: "completed",
                paymentNotes: paymentNotes || undefined,
                isBusinessExpense: isBusinessExpense,
            };

            const response = await fetch("/api/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paymentData),
            });

            if (!response.ok) {
                console.warn("Payment recorded on chain but DB update failed");
                // Don't throw here, show success but maybe warn
            }

            setPaymentSuccess(true);
            setTimeout(() => {
                window.location.reload();
            }, 3000);

        } catch (err: any) {
            console.error("Payment error:", err);
            setError(err.message || "Payment failed");
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
                <div className="text-white">Loading invoice...</div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
                <div className="glass-card p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Invoice Not Found</h1>
                    <p className="text-gray-400">{error || "This invoice does not exist or has been deleted."}</p>
                </div>
            </div>
        );
    }

    const isPaid = invoice.status === "paid";
    const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== "paid";

    return (
        <div className="min-h-screen" style={{ background: "hsl(225 20% 8%)" }}>
            {/* Header */}
            <nav className="glass border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-xl font-semibold text-white">Pay Invoice</h1>
                        <WalletMultiButton />
                    </div>
                </div>
            </nav>

            {/* Payment Success */}
            {paymentSuccess && (
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="glass-card border border-green-500/30 bg-green-500/10 p-6 rounded-lg">
                        <div className="flex items-start gap-4">
                            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-green-400 mb-2">Payment Successful!</h3>
                                <p className="text-gray-300 mb-3">
                                    Your payment has been confirmed on the Solana blockchain.
                                </p>
                                {txSignature && (
                                    <a
                                        href={`https://solscan.io/tx/${txSignature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
                                    >
                                        View Transaction <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Details */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="glass-card p-8">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                {invoice.invoiceNumber}
                            </h2>
                            <p className="text-gray-400">{invoice.description}</p>
                        </div>
                        <div>
                            {isPaid ? (
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    Paid
                                </span>
                            ) : isOverdue ? (
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    Overdue
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                                    <Clock className="w-4 h-4" />
                                    Pending
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="border-t border-white/10 pt-6 mb-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-gray-400 text-sm mb-1">Total Amount</p>
                                <p className="text-3xl font-bold text-white">
                                    {parseFloat(invoice.totalAmount).toFixed(2)} {invoice.currency}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm mb-1">Amount Due</p>
                                <p className="text-3xl font-bold text-purple-400">
                                    {parseFloat(invoice.remainingAmount).toFixed(2)} {invoice.currency}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="border-t border-white/10 pt-6 mb-6">
                        <p className="text-gray-400 text-sm mb-1">Due Date</p>
                        <p className="text-white text-lg">
                            {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>

                    {/* Payment Options (Notes & Accounting) */}
                    {!isPaid && (
                        <div className="border-t border-white/10 pt-6 mb-6 space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Payment Note (Optional)</label>
                                <textarea
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="Add a reference number or note..."
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-purple-500/50 focus:outline-none transition-colors resize-none h-20"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isBusinessExpense ? 'bg-purple-500 border-purple-500' : 'border-white/20 group-hover:border-white/40'}`}>
                                        <input
                                            type="checkbox"
                                            checked={isBusinessExpense}
                                            onChange={(e) => setIsBusinessExpense(e.target.checked)}
                                            className="hidden"
                                        />
                                        {isBusinessExpense && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <span className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">Mark as Business Expense</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Payment Button */}
                    {!isPaid && (
                        <div className="border-t border-white/10 pt-6">
                            {error && (
                                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            {!publicKey ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 mb-4">Connect your wallet to pay this invoice</p>
                                    <WalletMultiButton />
                                </div>
                            ) : (
                                <button
                                    onClick={handlePayment}
                                    disabled={paying || paymentSuccess}
                                    className="w-full smoke-shadow px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                                >
                                    {paying ? "Processing Payment..." : `Pay ${parseFloat(invoice.remainingAmount).toFixed(2)} ${invoice.currency}`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Share Link */}
                    <div className="border-t border-white/10 pt-6 mt-6">
                        <p className="text-gray-400 text-sm mb-2">Share Payment Link</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={window.location.href}
                                readOnly
                                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                            />
                            <button
                                onClick={copyPaymentLink}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Notice */}
                <div className="mt-6 glass-card p-4">
                    <p className="text-gray-400 text-sm text-center">
                        🔒 Payments are secured by the Solana blockchain. All transactions are verified on-chain.
                    </p>
                </div>
            </div>
        </div>
    );
}
