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
import { CheckCircle, Clock, AlertCircle, ExternalLink, Copy, Check, ShieldCheck, Loader2 } from "lucide-react";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import { PaymentStatus } from "@/components/payment-status";
import { usePaymentConfirmation } from "@/hooks/usePaymentConfirmation";
import { useAuth } from "@/hooks/use-auth";

interface Invoice {
    id: string;
    invoiceNumber: string;
    invoicerWalletAddress: string;
    invoiceeWalletAddress: string;
    subtotal: string;  // Base amount before platform fee
    platformFee: string; // 1% platform fee (pre-calculated)
    totalAmount: string; // subtotal + platformFee
    paidAmount: string;
    remainingAmount: string;
    currency: string;
    tokenMint: string;
    tokenDecimals: number;
    status: string;
    dueDate: string;
    description: string;
    createdAt: string;
    nftTransferredTo?: string; // New: For marketplace support
}

export default function PayInvoice() {
    const [, params] = useRoute("/pay/:invoiceId");
    const invoiceId = params?.invoiceId;

    const { connection } = useConnection();
    const { publicKey, signTransaction, connected } = useWallet();

    // Auth hook for SIWS authentication
    const { isAuthenticated, login, isLoading: authLoading, authMode, lazorkitWallet } = useAuth();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [paying, setPaying] = useState(false);

    // Auth state for private invoices
    const [requiresAuth, setRequiresAuth] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Payment State
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [submittedSignatures, setSubmittedSignatures] = useState<Set<string>>(new Set()); // Track submitted signatures

    // Accounting & Notes State
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isBusinessExpense, setIsBusinessExpense] = useState(false);

    // Use Custom Hook for Confirmation
    const { status: paymentStatus, error: confirmationError, elapsedSeconds } = usePaymentConfirmation({
        connection,
        signature: txSignature,
        invoiceId: invoiceId
    });

    // Fetch invoice details - include wallet in query if connected for session-based auth
    const fetchInvoice = async () => {
        if (!invoiceId) return;

        setLoading(true);
        setPageError(null);
        setRequiresAuth(false);

        try {
            // Include wallet address in request if connected (helps backend check session)
            const url = publicKey
                ? `/api/invoices/${invoiceId}?wallet=${publicKey.toString()}`
                : `/api/invoices/${invoiceId}`;

            const res = await fetch(url, { credentials: 'include' });
            const data = await res.json();

            if (data.success) {
                setInvoice(data.invoice);
            } else if (data.code === 'AUTH_REQUIRED') {
                // Private invoice - user needs to authenticate (not just connect)
                setRequiresAuth(true);
            } else if (data.code === 'ACCESS_DENIED') {
                // User is authenticated but not authorized for this invoice
                setPageError("You don't have access to this invoice. Only the invoicer or invoicee can view it.");
            } else {
                setPageError(data.message || "Invoice not found");
            }
        } catch (err: any) {
            setPageError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and re-fetch when authentication state changes
    useEffect(() => {
        // Only fetch when auth loading is complete to avoid race conditions
        if (!authLoading) {
            fetchInvoice();
        }
    }, [invoiceId, isAuthenticated, authLoading]);

    // Handle authentication for private invoices
    const handleAuthenticate = async () => {
        if (!connected) return; // Should not happen, button is hidden

        setIsAuthenticating(true);
        try {
            await login();
            // fetchInvoice will be triggered by isAuthenticated change in useEffect
        } catch (err) {
            // Error is already handled in useAuth hook with toast
        } finally {
            setIsAuthenticating(false);
        }
    };

    const copyPaymentLink = () => {
        const link = window.location.href;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePayment = async () => {
        if (!invoice || !publicKey || !signTransaction) return;

        setPaying(true);
        setPageError(null);

        try {
            // ==========================================
            // PASSKEY / LAZORKIT PAYMENT FLOW
            // ==========================================
            if (authMode === 'passkey' && lazorkitWallet) {
                // 1. Prepare Transaction Data
                const recipientPubkey = new PublicKey(invoice.nftTransferredTo || invoice.invoicerWalletAddress);
                const FEE_PAYER_PUBKEY = new PublicKey(TREASURY_WALLET_ADDRESS); // Placeholder, adjusted by paymaster

                // TODO: LazorKit constructs the specific transaction internally or we pass instructions
                // The current SDK pattern suggests we can use the web3.js connection and standard instructions
                // and then ask lazorkitWallet.signTransaction() with feeMode='paymaster'

                const amountToPay = parseFloat(invoice.remainingAmount);
                const platformFeeAmount = parseFloat(invoice.platformFee) || (amountToPay * 0.01);
                const subtotalAmount = parseFloat(invoice.subtotal) || (amountToPay - platformFeeAmount);
                const recipientAmount = subtotalAmount;

                const isNativeSOL = invoice.currency === "SOL" ||
                    invoice.tokenMint === "So11111111111111111111111111111111111111112";

                const transaction = new Transaction();

                if (isNativeSOL) {
                    const LAMPORTS_PER_SOL = 1_000_000_000;
                    const recipientLamports = Math.floor(recipientAmount * LAMPORTS_PER_SOL);
                    const platformFeeLamports = Math.floor(platformFeeAmount * LAMPORTS_PER_SOL);

                    if (recipientLamports > 0) {
                        transaction.add(
                            SystemProgram.transfer({
                                fromPubkey: new PublicKey(isAuthenticated ? (await lazorkitWallet.getAddress()) : publicKey!), // Use smart wallet address
                                toPubkey: recipientPubkey,
                                lamports: recipientLamports,
                            })
                        );
                    }
                    if (platformFeeLamports > 0) {
                        transaction.add(
                            SystemProgram.transfer({
                                fromPubkey: new PublicKey(isAuthenticated ? (await lazorkitWallet.getAddress()) : publicKey!),
                                toPubkey: new PublicKey(TREASURY_WALLET_ADDRESS),
                                lamports: platformFeeLamports,
                            })
                        );
                    }
                } else {
                    // SPL Token logic for Smart Wallet (similar to below but source is smart wallet)
                    const decimals = invoice.tokenDecimals;
                    const toAtomic = (val: number) => Math.floor(val * Math.pow(10, decimals));
                    const mintPubkey = new PublicKey(invoice.tokenMint);

                    // DYNAMIC PROGRAM ID DETECTION (Supports Token & Token-2022)
                    const mintInfo = await connection.getAccountInfo(mintPubkey);
                    if (!mintInfo) {
                        throw new Error("Token mint account not found on chain.");
                    }
                    const tokenProgramId = mintInfo.owner; // Use the actual program ID that owns the mint

                    const smartWalletAddress = new PublicKey(await lazorkitWallet.getAddress());
                    const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey, false, tokenProgramId);
                    const treasuryTokenAccount = await getAssociatedTokenAddress(mintPubkey, new PublicKey(TREASURY_WALLET_ADDRESS), false, tokenProgramId);
                    const senderTokenAccount = await getAssociatedTokenAddress(mintPubkey, smartWalletAddress, false, tokenProgramId);

                    // Assume ATAs exist or are created (Smart Wallet should handle ATA creation via bundled tx if needed)
                    // Simple transfer for now
                    const { createTransferInstruction } = await import('@solana/spl-token');

                    transaction.add(
                        createTransferInstruction(
                            senderTokenAccount, recipientTokenAccount, smartWalletAddress, toAtomic(recipientAmount), [], tokenProgramId
                        )
                    );
                    transaction.add(
                        createTransferInstruction(
                            senderTokenAccount, treasuryTokenAccount, smartWalletAddress, toAtomic(platformFeeAmount), [], tokenProgramId
                        )
                    );
                }

                // 2. Sign with LazorKit (Paymaster Mode)
                const signature = await lazorkitWallet.signTransaction(transaction, {
                    feeMode: 'paymaster'
                });

                if (!signature) throw new Error("Paymaster signature failed");

                // 3. Confirm
                setTxSignature(signature); // Hook handles the rest
                setPaying(false);
                return;
            }

            // ==========================================
            // STANDARD WALLET FLOW
            // ==========================================

            // 1. Fetch Fee Payer Config
            const configRes = await fetch("/api/config/fee-payer");
            const config = await configRes.json();

            if (!config.success) {
                throw new Error("Gasless payment not available: " + config.message);
            }

            const FEE_PAYER_PUBKEY = new PublicKey(config.feePayer);
            const TREASURY_ADDRESS = new PublicKey(config.treasuryAddress || TREASURY_WALLET_ADDRESS);

            const amountToPay = parseFloat(invoice.remainingAmount);

            // Fee Logic: Use pre-calculated platform fee from invoice
            // The fee is already included in totalAmount/remainingAmount
            const platformFeeAmount = parseFloat(invoice.platformFee) || (amountToPay * 0.01); // Fallback for old invoices
            const subtotalAmount = parseFloat(invoice.subtotal) || (amountToPay - platformFeeAmount);
            const recipientAmount = subtotalAmount; // Seller gets full subtotal (no fee deduction)
            // Platform fee goes to treasury

            // --- SECURITY FIX: Dynamic Payee Routing (Marketplace Support) ---
            const recipientPubkey = new PublicKey(invoice.nftTransferredTo || invoice.invoicerWalletAddress);
            const transaction = new Transaction();
            transaction.feePayer = FEE_PAYER_PUBKEY; // Protocol Pays Gas

            // Check if this is a native SOL payment
            const isNativeSOL = invoice.currency === "SOL" ||
                invoice.tokenMint === "So11111111111111111111111111111111111111112";

            if (isNativeSOL) {
                // ==================== NATIVE SOL PAYMENT ====================
                const LAMPORTS_PER_SOL = 1_000_000_000;
                const recipientLamports = Math.floor(recipientAmount * LAMPORTS_PER_SOL);
                const platformFeeLamports = Math.floor(platformFeeAmount * LAMPORTS_PER_SOL);

                // Transfer to Recipient (99%)
                if (recipientLamports > 0) {
                    transaction.add(
                        SystemProgram.transfer({
                            fromPubkey: publicKey,
                            toPubkey: recipientPubkey,
                            lamports: recipientLamports,
                        })
                    );
                }

                // Transfer Platform Fee (1%)
                if (platformFeeLamports > 0) {
                    transaction.add(
                        SystemProgram.transfer({
                            fromPubkey: publicKey,
                            toPubkey: TREASURY_ADDRESS,
                            lamports: platformFeeLamports,
                        })
                    );
                }
            } else {
                // ==================== SPL TOKEN PAYMENT ====================
                const GAS_FEE_AMOUNT = config.feeAmount || 0.15;
                const decimals = invoice.tokenDecimals;
                const toAtomic = (val: number) => Math.floor(val * Math.pow(10, decimals));

                const platformFeeLamports = toAtomic(platformFeeAmount);
                const recipientLamports = toAtomic(recipientAmount);
                const gasFeeLamports = toAtomic(GAS_FEE_AMOUNT);

                // Defensive check: Ensure tokenMint is available (fixes _bn null error)
                if (!invoice.tokenMint) {
                    throw new Error("Invoice token mint is missing. Please contact support.");
                }
                const mintPubkey = new PublicKey(invoice.tokenMint);

                // DYNAMIC PROGRAM ID DETECTION (Supports Token & Token-2022)
                const mintInfo = await connection.getAccountInfo(mintPubkey);
                if (!mintInfo) {
                    throw new Error("Token mint account not found on chain.");
                }
                const tokenProgramId = mintInfo.owner; // Use the actual program ID that owns the mint

                // Calculate ATAs using the correct Program ID
                const senderTokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey, false, tokenProgramId);
                const recipientTokenAccount = await getAssociatedTokenAddress(mintPubkey, recipientPubkey, false, tokenProgramId);
                const treasuryTokenAccount = await getAssociatedTokenAddress(mintPubkey, TREASURY_ADDRESS, false, tokenProgramId);

                // Import instructions
                const { createAssociatedTokenAccountInstruction, createTransferInstruction } = await import('@solana/spl-token');

                // Check/Create Recipient ATA
                const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
                if (!recipientAccountInfo) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            FEE_PAYER_PUBKEY,
                            recipientTokenAccount,
                            recipientPubkey,
                            mintPubkey,
                            tokenProgramId
                        )
                    );
                }

                // Check/Create Treasury ATA
                const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
                if (!treasuryAccountInfo) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            FEE_PAYER_PUBKEY,
                            treasuryTokenAccount,
                            TREASURY_ADDRESS,
                            mintPubkey,
                            tokenProgramId
                        )
                    );
                }

                // Transfer to Recipient (99%)
                if (recipientLamports > 0) {
                    transaction.add(
                        createTransferInstruction(
                            senderTokenAccount, recipientTokenAccount, publicKey, recipientLamports, [], tokenProgramId
                        )
                    );
                }

                // Transfer Platform Fee (1%)
                if (platformFeeLamports > 0) {
                    transaction.add(
                        createTransferInstruction(
                            senderTokenAccount, treasuryTokenAccount, publicKey, platformFeeLamports, [], tokenProgramId
                        )
                    );
                }

                // Transfer Gas Recovery Fee (Service Fee) - Only for SPL tokens
                if (gasFeeLamports > 0) {
                    transaction.add(
                        createTransferInstruction(
                            senderTokenAccount, treasuryTokenAccount, publicKey, gasFeeLamports, [], tokenProgramId
                        )
                    );
                }
            }

            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            transaction.recentBlockhash = blockhash;

            // PARTIAL SIGN BY USER
            const signedTx = await signTransaction(transaction);

            // Serialize and Send to Backend Relay
            const serializedTx = signedTx.serialize({ requireAllSignatures: false });
            const txBase64 = serializedTx.toString('base64');

            // Add timeout to prevent UI hanging if server is slow
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            try {
                const relayResponse = await fetch("/api/payments/relay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    signal: controller.signal,
                    body: JSON.stringify({
                        transaction: txBase64,
                        invoiceId: invoice.id
                    })
                });

                clearTimeout(timeoutId);
                const relayResult = await relayResponse.json();

                if (!relayResult.success) {
                    throw new Error(relayResult.message || "Payment relay failed");
                }

                // Success! We have a signature. Use Hook to track confirmation.
                const signature = relayResult.signature;

                // Prevent duplicate submission tracking
                if (submittedSignatures.has(signature)) {
                    console.warn("Duplicate signature detected, ignoring", { signature });
                    return;
                }

                setSubmittedSignatures(prev => new Set(prev).add(signature));
                setTxSignature(signature);
            } catch (fetchErr: any) {
                clearTimeout(timeoutId);
                if (fetchErr.name === 'AbortError') {
                    throw new Error("Payment request timed out. Please check your wallet or Explorer.");
                }
                throw fetchErr;
            }

            // NOTE: Payment recording is handled by the relay endpoint's
            // confirmPaymentAndMintOutcome() call. We don't call POST /api/payments
            // here to avoid duplicate payment recording errors.
            // The hook will poll for confirmation status.

        } catch (err: any) {
            console.error("Payment error:", err);

            // RECOVERY: Check if payment actually succeeded despite error (e.g. timeout, race condition)
            try {
                // Wait 2s to allow propagation
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Check status directly
                const res = await fetch(`/api/invoices/${invoiceId}`, { credentials: 'include' });
                const data = await res.json();

                if (data.success && data.invoice && (data.invoice.status === 'paid' || data.invoice.status === 'processing' || data.invoice.status === 'partial')) {
                    // Payment recovered: Invoice has been paid
                    // Verify via hook by simulating a signature verification (or just reload)
                    if (!txSignature) {
                        // We don't have a signature to track, but the invoice is paid.
                        // Force a refresh via fetchInvoice() which will update the UI state
                        await fetchInvoice();
                        return; // Exit error handler
                    }
                }
            } catch (recoveryErr) {
                console.warn("Payment recovery check failed:", recoveryErr);
            }

            let errorMessage = err.message || "Payment failed";
            if (errorMessage.includes("Attempt to debit") || errorMessage.includes("0x1")) {
                errorMessage = "Payment simulation failed. Ensure you have enough SOL for Rent (if creating accounts).";
            }
            setPageError(errorMessage);
        } finally {
            setPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                    <p className="text-gray-400 mt-4">Loading invoice...</p>
                </div>
            </div>
        );
    }

    // Private invoice - show connect wallet / authenticate prompt
    if (requiresAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
                <div className="glass-card p-8 max-w-md text-center">
                    <ShieldCheck className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Private Invoice</h1>
                    <p className="text-gray-400 mb-6">
                        This invoice is confidential. {!connected
                            ? "Connect your wallet to verify your identity and view the details."
                            : "Sign a message to verify your identity and view the details."}
                    </p>

                    {/* Step 1: Connect Wallet */}
                    {!connected && (
                        <div className="flex justify-center">
                            <WalletMultiButton />
                        </div>
                    )}

                    {/* Step 2: Authenticate (Sign Message) */}
                    {connected && !isAuthenticated && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                                Wallet connected: <span className="text-purple-400 font-mono">{publicKey?.toString().slice(0, 8)}...</span>
                            </p>
                            <button
                                onClick={handleAuthenticate}
                                disabled={isAuthenticating}
                                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Signing...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Verify Identity
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-gray-500">
                                You'll be asked to sign a message to prove wallet ownership
                            </p>
                        </div>
                    )}

                    {/* Loading state after authentication */}
                    {connected && isAuthenticated && (
                        <div className="flex items-center justify-center gap-2 text-purple-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading invoice...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (pageError || !invoice) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
                <div className="glass-card p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Invoice Not Found</h1>
                    <p className="text-gray-400">{pageError || "This invoice does not exist or has been deleted."}</p>
                </div>
            </div>
        );
    }

    const isPaid = invoice.status === "paid" || paymentStatus === 'verified';
    const isOverdue = new Date(invoice.dueDate) < new Date() && !isPaid;

    // --- SECURITY FIX: Payer Authorization Check ---
    const isAuthorizedPayer = publicKey && publicKey.toString() === invoice.invoiceeWalletAddress;
    const authWarning = publicKey && !isAuthorizedPayer;

    return (
        <div className="min-h-screen" style={{ background: "hsl(225 20% 8%)" }}>
            {/* Header */}
            <nav className="glass border-b border-white/10 relative z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-purple-500" />
                            <span className="font-bold text-white tracking-tight">INVOIX SECURE PAY</span>
                        </div>
                        <WalletMultiButton />
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-8">

                {/* Payment Status Overlay */}
                {(paymentStatus !== 'idle' || txSignature) && (
                    <div className="mb-8">
                        <PaymentStatus
                            status={paymentStatus}
                            txSignature={txSignature}
                            error={confirmationError}
                            elapsedSeconds={elapsedSeconds}
                        />
                        {/* Claim NFT Button for Community Drop */}
                        {paymentStatus === 'verified' && invoice?.description === "Exclusive Community NFT Mint" && (
                            <div className="mt-4 text-center">
                                <h3 className="text-xl font-bold text-white mb-2">🎁 Your NFT is Ready!</h3>
                                <p className="text-gray-400 mb-4 text-sm">You must now claim your Standard NFT (Gas fees apply).</p>
                                <button
                                    className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg text-white font-bold hover:opacity-90 transition-opacity"
                                    onClick={async () => {
                                        if (!signTransaction) return;
                                        try {
                                            const { Buffer } = await import("buffer");
                                            const { VersionedTransaction, Connection } = await import("@solana/web3.js");

                                            // 1. Get Tx
                                            const res = await fetch("/api/community-drop/claim-transaction", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ invoiceId: invoice.id, walletAddress: publicKey?.toString() })
                                            });
                                            const data = await res.json();
                                            if (!data.success) throw new Error(data.message);

                                            // 2. Sign
                                            const tx = VersionedTransaction.deserialize(Buffer.from(data.transaction, 'base64'));
                                            const signed = await signTransaction(tx);

                                            // 3. Send
                                            // Use existing connection (Devnet/Mainnet aware)
                                            const sig = await connection.sendRawTransaction(signed.serialize());
                                            await connection.confirmTransaction(sig, "confirmed");

                                            // 4. Confirm DB
                                            await fetch("/api/community-drop/confirm-claim", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    invoiceId: invoice.id,
                                                    walletAddress: publicKey?.toString(),
                                                    mint: data.mint,
                                                    signature: sig,
                                                    nftVariant: data.nftVariant
                                                })
                                            });
                                            alert(`Claimed ${data.nftVariant.rarity} NFT!`);
                                        } catch (e: any) {
                                            alert("Claim Failed: " + e.message);
                                        }
                                    }}
                                >
                                    Claim NFT Now
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Only show Invoice if not verified (or allow viewing receipt below) */}
                {paymentStatus !== 'verified' && (
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
                            <div className="grid grid-cols-2 gap-6 mb-4">
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

                            {/* Payment Distribution Breakdown */}
                            <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment Breakdown</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center text-gray-300">
                                        <span>Subtotal (To Invoicer)</span>
                                        <span className="font-mono">
                                            {parseFloat(invoice.subtotal || String(parseFloat(invoice.remainingAmount) * 0.99)).toFixed(2)} {invoice.currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-purple-300">
                                        <span className="flex items-center gap-1">
                                            Platform Fee (1%)
                                            <div className="group relative">
                                                <AlertCircle className="w-3 h-3 cursor-help text-purple-400" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 text-white text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    This fee supports the Invoix protocol and is automatically included in the total.
                                                </div>
                                            </div>
                                        </span>
                                        <span className="font-mono">
                                            {parseFloat(invoice.platformFee || String(parseFloat(invoice.remainingAmount) * 0.01)).toFixed(2)} {invoice.currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-white font-bold pt-2 border-t border-white/10">
                                        <span>Total Due</span>
                                        <span className="font-mono">
                                            {parseFloat(invoice.remainingAmount).toFixed(2)} {invoice.currency}
                                        </span>
                                    </div>
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
                        {!isPaid && paymentStatus === 'idle' && (
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
                        {!isPaid && paymentStatus === 'idle' && (
                            <div className="border-t border-white/10 pt-6">
                                {pageError && (
                                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <p className="text-red-400 text-sm">{pageError}</p>
                                    </div>
                                )}

                                {authWarning && (
                                    <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                                        <ShieldCheck className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-yellow-400 text-sm font-semibold">Restricted Access</p>
                                            <p className="text-yellow-500/70 text-xs">
                                                Only the designated recipient ({invoice.invoiceeWalletAddress.slice(0, 6)}...{invoice.invoiceeWalletAddress.slice(-4)})
                                                can pay this invoice.
                                            </p>
                                        </div>
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
                                        disabled={paying || !isAuthorizedPayer || txSignature !== null}
                                        className="w-full smoke-shadow px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-lg"
                                    >
                                        {paying ? "Processing Payment..." : (
                                            txSignature ? "Payment Submitted - Verifying..." : (
                                                !isAuthorizedPayer ? "Unauthorized Wallet" : `Pay ${parseFloat(invoice.remainingAmount).toFixed(2)} ${invoice.currency}`
                                            )
                                        )}
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
                )}

                {/* Security Notice */}
                <div className="mt-6 glass-card p-4">
                    <p className="text-gray-400 text-sm text-center">
                        🔒 Payments are secured by the Solana blockchain. Verified by Invoix Protocol.
                    </p>
                </div>
            </div>
        </div>
    );
}
