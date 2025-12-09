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

import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
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
} from "lucide-react";

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

  useEffect(() => {
    if (params?.id) {
      loadInvoice(params.id);
    }
  }, [params?.id]);

  const loadInvoice = async (invoiceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const walletAddress = localStorage.getItem("walletAddress");
      if (!walletAddress) {
        throw new Error("Please connect your wallet");
      }

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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setSubmittingPayment(true);

    try {
      const walletAddress = localStorage.getItem("walletAddress");
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

  const walletAddress = localStorage.getItem("walletAddress") || "";
  const isInvoicer = invoice.invoicerWalletAddress === walletAddress;
  const isInvoicee = invoice.invoiceeWalletAddress === walletAddress;

  return (
    <div className="min-h-screen" style={{ background: "hsl(225 20% 8%)" }}>
      {/* Header */}
      <nav className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button
              onClick={() => navigate("/invoices")}
              className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
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
                <button className="smoke-shadow px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
              {invoice.isArciumEncrypted && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Arcium Encrypted</span>
                </div>
              )}
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
                    onChange={(e) => setPaymentAmount(e.target.value)}
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
                    onChange={(e) => setPaymentTxSignature(e.target.value)}
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
    </div>
  );
}
