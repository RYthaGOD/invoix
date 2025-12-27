/**
 * Invoice List View
 * 
 * Displays all invoices (sent and received) with:
 * - Filtering by status and currency
 * - Search functionality
 * - Status badges with colors
 * - Quick actions
 * - Responsive table/card view
 */

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus,
  Search,
  Filter,
  Eye,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoicerWalletAddress: string;
  invoiceeWalletAddress: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  currency: string;
  status: string;
  dueDate: string;
  createdAt: string;
  description?: string;
  nftMint?: string;
  isPrivate: boolean;
}

const statusConfig = {
  draft: { label: "Draft", color: "bg-gray-500/20 text-gray-300", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-300", icon: AlertCircle },
  viewed: { label: "Viewed", color: "bg-indigo-500/20 text-indigo-300", icon: Eye },
  partial: { label: "Partial", color: "bg-yellow-500/20 text-yellow-300", icon: DollarSign },
  paid: { label: "Paid", color: "bg-green-500/20 text-green-300", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-500/20 text-red-300", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-400", icon: XCircle },
};

export default function InvoiceList() {
  const [, navigate] = useLocation();
  const { walletAddress } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  useEffect(() => {
    if (walletAddress) {
      loadInvoices();
    } else {
      setLoading(false);
      // Optional: Redirect or show empty state if not connected
    }
  }, [walletAddress, statusFilter, currencyFilter]);

  const loadInvoices = async () => {
    // Prevent loading if no wallet (should be handled by effect, but safety check)
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        wallet: walletAddress,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(currencyFilter !== "all" && { currency: currencyFilter }),
      });

      const response = await fetch(`/api/invoices?${params}`);
      if (!response.ok) {
        throw new Error("Failed to load invoices");
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceeWalletAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const sentInvoices = filteredInvoices.filter(
    (inv) => inv.invoicerWalletAddress === walletAddress
  );
  const receivedInvoices = filteredInvoices.filter(
    (inv) => inv.invoiceeWalletAddress === walletAddress
  );

  const formatCurrency = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    return `${num.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const InvoiceRow = ({ invoice }: { invoice: Invoice }) => {
    const isOverdue = invoice.status !== "paid" && new Date(invoice.dueDate) < new Date();
    const displayStatus = isOverdue ? "overdue" : invoice.status;

    return (
      <tr
        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => navigate(`/invoices/${invoice.id}`)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-white font-medium">{invoice.invoiceNumber}</div>
              {invoice.description && (
                <div className="text-gray-400 text-sm mt-0.5">{invoice.description}</div>
              )}
            </div>
            {invoice.nftMint && (
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                NFT
              </span>
            )}
            {invoice.isPrivate && (
              <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-300 rounded-full border border-gray-500/30 flex items-center gap-1">
                🔒 Private
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-white">
            {formatCurrency(invoice.totalAmount, invoice.currency)}
          </div>
          {parseFloat(invoice.paidAmount) > 0 && (
            <div className="text-gray-400 text-sm">
              Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          {getStatusBadge(displayStatus)}
        </td>
        <td className="px-6 py-4 text-gray-300">
          {formatDate(invoice.dueDate)}
        </td>
        <td className="px-6 py-4">
          <div className="text-gray-400 text-sm truncate max-w-xs">
            {invoice.invoiceeWalletAddress.slice(0, 8)}...{invoice.invoiceeWalletAddress.slice(-6)}
          </div>
        </td>
        <td className="px-6 py-4 text-gray-400 text-sm">
          {formatDate(invoice.createdAt)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 id="tour-welcome" className="text-3xl font-bold text-white tracking-tight">Invoices</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.open("/api/invoices/export?format=csv", "_blank")}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-lg transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            id="tour-create-invoice"
            onClick={() => navigate("/invoices/create")}
            className="smoke-shadow px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" id="tour-stats-overview">
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Total Invoices</div>
            <div className="text-4xl font-bold text-white">{filteredInvoices.length}</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Sent</div>
            <div className="text-4xl font-bold text-blue-400">{sentInvoices.length}</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Received</div>
            <div className="text-4xl font-bold text-purple-400">{receivedInvoices.length}</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">Overdue</div>
            <div className="text-4xl font-bold text-red-400">
              {filteredInvoices.filter(
                (inv) => inv.status !== "paid" && new Date(inv.dueDate) < new Date()
              ).length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Currency Filter */}
            <select
              value={currencyFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrencyFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Currencies</option>
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
              <option value="EURC">EURC</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <p className="text-gray-400 mt-4">Loading invoices...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="glass-card border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={loadInvoices}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State / Getting Started Guide */}
        {!loading && !error && filteredInvoices.length === 0 && (
          <div className="glass-card p-12 ">
            <div className="max-w-2xl mx-auto text-center space-y-8">

              <div className="space-y-2">
                <div className="text-6xl mb-4">👋</div>
                <h3 className="text-2xl font-bold text-white">Welcome to Invoix!</h3>
                <p className="text-gray-400">Let's get you set up to receive your first crypto payment.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 text-left">
                {/* Step 1 */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold mb-4">1</div>
                  <h4 className="text-white font-semibold mb-2">Setup Profile</h4>
                  <p className="text-sm text-gray-400 mb-4">Add your business logo and details so you look professional.</p>
                  <button
                    onClick={() => navigate("/settings")}
                    className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Go to Settings &rarr;
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold mb-4">2</div>
                  <h4 className="text-white font-semibold mb-2">Add Customer</h4>
                  <p className="text-sm text-gray-400 mb-4">Save your client's wallet address to your address book.</p>
                  <button
                    onClick={() => navigate("/customers")}
                    className="text-sm text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Add Customer &rarr;
                  </button>
                </div>

                {/* Step 3 */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold mb-4">3</div>
                  <h4 className="text-white font-semibold mb-2">Create Invoice</h4>
                  <p className="text-sm text-gray-400 mb-4">Send your first bill and get paid in seconds.</p>
                  <button
                    onClick={() => navigate("/invoices/create")}
                    className="text-sm text-green-400 hover:text-green-300 font-medium"
                  >
                    Draft Invoice &rarr;
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Invoice Table */}
        {!loading && !error && filteredInvoices.length > 0 && (
          <div className="glass-card overflow-hidden" id="tour-invoice-table">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInvoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
