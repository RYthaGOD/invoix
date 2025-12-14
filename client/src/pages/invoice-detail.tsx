/**
 * Invoice Detail Page
 * 
 * Shows complete invoice information with:
 * - Invoice header and status
 * - Line items table
 * - Payment history
 * - Payment recording form
 * - NFT information
 * - Actions (send, download, cancel)
 */

import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Download,
  Send,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Check,
  Share,
  Link,
  Loader2,
  Mail,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { clusterApiUrl, Connection, VersionedTransaction, Transaction, PublicKey, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import { useConnection } from "@solana/wallet-adapter-react";
import { serializeInvoiceForHashing } from "@shared/invoice-schema";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  lineNumber: number;
}

interface Payment {
  id: string;
  amount: string;
  currency: string;
  txSignature: string;
  paidAt: string;
  fromAddress: string;
  toAddress: string;
  receiptNftMint?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoicerWalletAddress: string;
  invoiceeWalletAddress: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  currency: string;
  tokenMint?: string;
  tokenDecimals: number;
  status: string;
  dueDate: string;
  createdAt: string;
  invoiceDate: string;
  description?: string;
  notes?: string;
  paymentTerms?: string;
  isPrivate: boolean;
  nftMint?: string;
  nftMerkleTree?: string;
  nftMintedAt?: string;
  isArciumEncrypted: boolean;
}

const statusConfig = {
  draft: { label: "Draft", color: "bg-gray-500/20 text-gray-300 border-gray-500/30", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: AlertCircle },
  viewed: { label: "Viewed", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", icon: Eye },
  partial: { label: "Partially Paid", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: DollarSign },
  paid: { label: "Paid", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
};

export default function InvoiceDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/invoices/:id");
  const { walletAddress } = useAuth();
  const { toast } = useToast();
  const wallet = useWallet(); // Wallet adapter for signing
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTxSignature, setPaymentTxSignature] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [mintingStatus, setMintingStatus] = useState<string>("");
  const [mintError, setMintError] = useState<string | null>(null);

  // Integrity Verification
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [integrityError, setIntegrityError] = useState<string | null>(null);

  const { id: invoiceId } = params || {};

  // Auto-Verify Logic
  useEffect(() => {
    const verifyIntegrity = async () => {
      if (!invoice || !invoice.nftMint || !invoice.isPrivate) return;

      try {
        // 1. Fetch On-Chain Metadata (via Proxy to avoid CORS/RPC complexity)
        const response = await fetch(`/api/nft-metadata/invoice-${invoice.id}`);
        if (!response.ok) return; // Silent fail if not minted/found

        const metadata = await response.json();
        const onChainHashAttr = metadata.attributes?.find((a: any) => a.trait_type === "Data Hash");
        const onChainHash = onChainHashAttr?.value;

        if (!onChainHash) return; // No hash to verify against

        // 2. Compute Local Hash
        const preImage = serializeInvoiceForHashing(invoice);
        const msgBuffer = new TextEncoder().encode(preImage);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const localHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 3. Compare
        if (localHash === onChainHash) {
          setIsVerified(true);
          setIntegrityError(null);
        } else {
          setIsVerified(false);
          setIntegrityError("Hash Mismatch! The on-chain data does not match the invoice details.");
          console.error("Verification Mismatch:", { local: localHash, onChain: onChainHash });
        }

      } catch (err) {
        console.error("Verification failed:", err);
      }
    };

    verifyIntegrity();
  }, [invoice]);

  useEffect(() => {
    if (params?.id && walletAddress) {
      loadInvoice(params.id);
    } else if (!walletAddress) {
      setLoading(false);
      // Maybe redirect or show connect wallet screen
    }
  }, [params?.id, walletAddress]);

  const loadInvoice = async (invoiceId: string) => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Load invoice
      const invoiceResponse = await fetch(`/api/invoices/${invoiceId}?wallet=${walletAddress}`);
      if (!invoiceResponse.ok) {
        throw new Error("Failed to load invoice");
      }
      const invoiceData = await invoiceResponse.json();
      setInvoice(invoiceData.invoice);

      // Load line items
      const invoice = invoiceData.invoice;
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        setLineItems(invoice.lineItems);
      }

      // Load payments
      const paymentsResponse = await fetch(`/api/invoices/${invoiceId}/payments?wallet=${walletAddress}`);
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData.payments || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendClick = () => {
    setShowSendDialog(true);
  };

  const handleSendConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !walletAddress) return;

    setSending(true);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}?wallet=${walletAddress}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "sent",
          customerEmail: customerEmail // Send provided email
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to send invoice");
      }

      const data = await response.json();
      setInvoice(data.invoice);
      toast({
        title: "Invoice Sent Successfully",
        description: `Invoice has been sent to ${customerEmail || "the customer"}.`,
      });
      setShowSendDialog(false);
    } catch (err: any) {
      toast({
        title: "Error Sending Invoice",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const { connection } = useConnection();

  const handlePayWithWallet = async () => {
    if (!invoice || !wallet.publicKey || !wallet.signTransaction) return;

    setSubmittingPayment(true);
    setError(null);

    try {
      const amountToPay = parseFloat(invoice.remainingAmount);

      // Platform Fee Calculation (1%)
      const feeRate = 0.01;
      const feeAmount = amountToPay * feeRate;
      const recipientAmount = amountToPay - feeAmount;

      const isNativeSOL = invoice.currency === "SOL";
      // Use 9 decimals for SOL, or tokenDecimals for others
      const decimals = isNativeSOL ? 9 : invoice.tokenDecimals;

      const feeLamports = Math.floor(feeAmount * Math.pow(10, decimals));
      const recipientLamports = Math.floor(recipientAmount * Math.pow(10, decimals));

      const transaction = new Transaction();

      // Determine Recipient & Treasury Pubkeys
      const recipientPubkey = new PublicKey(invoice.invoicerWalletAddress);
      const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

      if (isNativeSOL) {
        // --- NATIVE SOL LOGIC ---

        // 1. Transfer to Recipient (99%)
        if (recipientLamports > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: recipientPubkey,
              lamports: recipientLamports,
            })
          );
        }

        // 2. Transfer Fee to Treasury (1%)
        if (feeLamports > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: treasuryPubkey,
              lamports: feeLamports,
            })
          );
        }

      } else {
        // --- SPL TOKEN LOGIC ---
        if (!invoice.tokenMint) throw new Error("Token Mint not defined on invoice");

        const mintPubkey = new PublicKey(invoice.tokenMint);

        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          wallet.publicKey
        );

        const recipientTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          recipientPubkey
        );

        const treasuryTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          treasuryPubkey
        );

        // Import createAssociatedTokenAccountInstruction dynamically
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

        // 1. Check/Create Recipient ATA
        const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
        if (!recipientAccountInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
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
              wallet.publicKey,
              treasuryTokenAccount,
              treasuryPubkey,
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
              wallet.publicKey,
              recipientLamports,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }

        // 4. Transfer Fee to Treasury (1%)
        if (feeLamports > 0) {
          transaction.add(
            createTransferInstruction(
              senderTokenAccount,
              treasuryTokenAccount,
              wallet.publicKey,
              feeLamports,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(signature, "confirmed");

      // Record payment
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: invoice.remainingAmount, // Full amount recorded
          currency: invoice.currency,
          txSignature: signature,
          fromAddress: wallet.publicKey.toString(),
          toAddress: invoice.invoicerWalletAddress,
          paymentMethod: "solana_transfer",
          isBusinessExpense: false // Defaults
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to record payment");
      }

      toast({
        title: "Payment Successful",
        description: "Invoice paid and fee collected.",
        variant: "default",
      });

      await loadInvoice(invoice.id);
      setShowPaymentForm(false);

    } catch (err: any) {
      console.error("Payment error:", err);
      toast({
        title: "Payment Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setSubmittingPayment(true);

    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet");
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: paymentAmount,
          currency: invoice.currency,
          txSignature: paymentTxSignature,
          fromAddress: invoice.invoiceeWalletAddress,
          toAddress: invoice.invoicerWalletAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to record payment");
      }

      // Reload invoice and payments
      await loadInvoice(invoice.id);
      setShowPaymentForm(false);
      setPaymentAmount("");
      setPaymentTxSignature("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleMintNFT = async () => {
    if (!invoice || !wallet.publicKey || !wallet.signTransaction) return;

    setMintingStatus("Preparing Mint Transaction...");
    setMintError(null);

    try {
      // 1. Request Transaction from Server
      const mintRes = await fetch(`/api/nft/mint-invoice/${invoice.id}?wallet=${wallet.publicKey.toBase58()}`, {
        method: "POST",
      });

      if (!mintRes.ok) {
        const err = await mintRes.json();
        throw new Error(err.message || "Failed to prepare mint transaction");
      }

      const { transaction: base64Tx } = await mintRes.json();

      setMintingStatus("Please Sign Transaction (User Pays Mint Fee) ✍️");

      // 2. Deserialize Transaction
      const txBuffer = Buffer.from(base64Tx, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // 3. Sign with User Wallet
      const signedTx = await wallet.signTransaction(transaction);

      // 4. Send Transaction
      setMintingStatus("Sending Transaction... 🚀");
      const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"));

      const signature = await connection.sendRawTransaction(signedTx.serialize());

      setMintingStatus("Confirming Transaction... ⏳");
      const confirmation = await connection.confirmTransaction(signature, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      setMintingStatus("Success! Updating Invoice... ✨");

      // 5. Confirm with Server (Sends signature, server derives Asset Id)
      await fetch(`/api/nft/confirm-mint/${invoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          // Placeholder details - server will ignore/derive
          mint: signature,
          leafIndex: 0,
          merkleTree: "See Server Config",
        }),
      });

      // Reload invoice to show new NFT status
      await loadInvoice(invoice.id);
      setMintingStatus("");

    } catch (err: any) {
      console.error("Minting failed:", err);
      setMintError(err.message);
      setMintingStatus("");
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return `${num.toFixed(2)} ${invoice?.currency || ""}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = () => {
    if (!invoice) return null;

    const isOverdue = invoice.status !== "paid" && new Date(invoice.dueDate) < new Date();
    const displayStatus = isOverdue ? "overdue" : invoice.status;
    const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
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

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225 20% 8%)" }}>
        <div className="glass-card border border-red-500/30 bg-red-500/10 p-8 text-center max-w-md">
          <p className="text-red-400 mb-4">{error || "Invoice not found"}</p>
          <button
            onClick={() => navigate("/invoices")}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const isInvoicer = invoice.invoicerWalletAddress === walletAddress;
  const isInvoicee = invoice.invoiceeWalletAddress === walletAddress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate("/invoices")}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const paymentLink = `${window.location.origin}/pay/${invoice.id}`;
              copyToClipboard(paymentLink, "paymentLink");
            }}
            className="smoke-shadow px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all flex items-center gap-2"
          >
            {copied === "paymentLink" ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Link className="w-4 h-4" />
                Share Link
              </>
            )}
          </button>
          <button className="smoke-shadow px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download
          </button>
          {isInvoicer && invoice.status === "draft" && (
            <button
              onClick={handleSendClick}
              disabled={sending}
              className="smoke-shadow px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : "Send Invoice"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Invoice Header */}
        <div className="glass-card p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{invoice.invoiceNumber}</h1>
              {invoice.description && (
                <p className="text-gray-400">{invoice.description}</p>
              )}
            </div>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-gray-400 text-sm mb-1">Invoice Date</div>
              <div className="text-white">{formatDate(invoice.invoiceDate)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Due Date</div>
              <div className="text-white">{formatDate(invoice.dueDate)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Payment Terms</div>
              <div className="text-white">{invoice.paymentTerms || "Net 30"}</div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-gray-400 text-sm mb-2">From (Invoicer)</div>
              <div className="flex items-center gap-2">
                <code className="text-white text-sm font-mono bg-white/5 px-3 py-1.5 rounded">
                  {invoice.invoicerWalletAddress.slice(0, 8)}...{invoice.invoicerWalletAddress.slice(-6)}
                </code>
                <button
                  onClick={() => copyToClipboard(invoice.invoicerWalletAddress, "from")}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  {copied === "from" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-2">To (Customer)</div>
              <div className="flex items-center gap-2">
                <code className="text-white text-sm font-mono bg-white/5 px-3 py-1.5 rounded">
                  {invoice.invoiceeWalletAddress.slice(0, 8)}...{invoice.invoiceeWalletAddress.slice(-6)}
                </code>
                <button
                  onClick={() => copyToClipboard(invoice.invoiceeWalletAddress, "to")}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  {copied === "to" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* NFT & Privacy Info */}
          {(invoice.nftMint || invoice.isPrivate || invoice.isArciumEncrypted) && (
            <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
              {invoice.nftMint && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-2xl">🎨</span>
                  <div>
                    <div className="text-xs text-purple-300">Minted as NFT</div>
                    <a
                      href={`https://solscan.io/token/${invoice.nftMint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      View on Solscan
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
              {invoice.isPrivate && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-500/10 border border-gray-500/30 rounded-lg text-gray-300">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Private Invoice</span>
                </div>
              )}

              {/* Verification Badge */}
              {isVerified && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400" title="Data integrity verified on-chain">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-sm">Verified On-Chain</span>
                </div>
              )}

              {integrityError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-bold animate-pulse">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-sm">TAMPER WARNING</span>
                </div>
              )}

              {invoice.isArciumEncrypted && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Arcium Encrypted</span>
                </div>
              )}
            </div>
          )}

          {/* Minting Status Overlay */}
          {mintingStatus && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="glass-card p-8 rounded-xl flex flex-col items-center gap-4 max-w-md text-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                <h3 className="text-xl font-bold text-white">Minting NFT...</h3>
                <p className="text-gray-300">{mintingStatus}</p>
                <p className="text-xs text-gray-500 mt-2">Please examine the transaction in your wallet popup.</p>
              </div>
            </div>
          )}

          {/* Mint Error */}
          {mintError && (
            <div className="glass-card border border-red-500/30 bg-red-500/10 p-4 rounded-lg flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-400 text-sm">Mint Failed: {mintError}</p>
              </div>
              <button
                onClick={() => setMintError(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mint Button for Invoicer */}
          {isInvoicer && !invoice.nftMint && (
            <div className="glass-card p-6 border-l-4 border-purple-500">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Mint Invoice NFT</h3>
                  <p className="text-sm text-gray-400 max-w-lg mt-1">
                    This invoices has not been minted yet. Minting creates a verifiable on-chain record and allows for factoring/trading.
                    You will pay the network fee (~0.002 SOL).
                  </p>
                </div>
                <button
                  onClick={handleMintNFT}
                  disabled={!!mintingStatus}
                  className="smoke-shadow px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all"
                >
                  Mint NFT 🎨
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 text-sm font-medium">Description</th>
                    <th className="text-right py-2 text-gray-400 text-sm font-medium">Quantity</th>
                    <th className="text-right py-2 text-gray-400 text-sm font-medium">Unit Price</th>
                    <th className="text-right py-2 text-gray-400 text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="py-3 text-white">{item.description}</td>
                      <td className="py-3 text-right text-gray-300">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-300">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right text-white font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal:</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.taxAmount) > 0 && (
                <div className="flex justify-between text-gray-300">
                  <span>Tax:</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
              )}
              {parseFloat(invoice.discountAmount) > 0 && (
                <div className="flex justify-between text-gray-300">
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/10">
                <span>Total:</span>
                <span className="text-purple-400">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              {parseFloat(invoice.paidAmount) > 0 && (
                <>
                  <div className="flex justify-between text-green-300">
                    <span>Paid:</span>
                    <span>{formatCurrency(invoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-yellow-300 font-semibold">
                    <span>Remaining:</span>
                    <span>{formatCurrency(invoice.remainingAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Payment History</h2>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-white font-medium">{formatCurrency(payment.amount)}</div>
                    <div className="text-gray-400 text-sm">{formatDate(payment.paidAt)}</div>
                  </div>
                  <a
                    href={`https://solscan.io/tx/${payment.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    View Transaction
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {payment.receiptNftMint && (
                    <a
                      href={`https://solscan.io/token/${payment.receiptNftMint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 text-sm flex items-center gap-1 ml-4"
                    >
                      View Receipt NFT 🧾
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Record Payment Form */}
        {isInvoicee && invoice.status !== "paid" && parseFloat(invoice.remainingAmount) > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Record Payment</h2>

            {!showPaymentForm ? (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="smoke-shadow px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Record Payment
              </button>
            ) : (
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Amount ({invoice.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.remainingAmount}
                    value={paymentAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={`Max: ${formatCurrency(invoice.remainingAmount)}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Transaction Signature
                  </label>
                  <input
                    type="text"
                    value={paymentTxSignature}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentTxSignature(e.target.value)}
                    required
                    minLength={88}
                    maxLength={88}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Solana transaction signature (88 characters)"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
                    disabled={submittingPayment}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="smoke-shadow flex-1 px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                  >
                    {submittingPayment ? "Recording..." : "Submit Payment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && isInvoicer && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Internal Notes</h2>
            <p className="text-gray-400">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="glass-card border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the customer's email address to send them this invoice.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendConfirm} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Customer Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="customer@example.com"
                  required
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-purple-500"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowSendDialog(false)}
                className="px-4 py-2 hover:bg-white/10 rounded-md text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Invoice
                  </>
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
