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
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 border border-gray-200", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-50 text-blue-700 border border-blue-200", icon: AlertCircle },
  viewed: { label: "Viewed", color: "bg-indigo-50 text-indigo-700 border border-indigo-200", icon: Eye },
  partial: { label: "Partial", color: "bg-yellow-50 text-yellow-700 border border-yellow-200", icon: DollarSign },
  paid: { label: "Paid", color: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-50 text-red-700 border border-red-200", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600 border border-gray-200", icon: XCircle },
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

      const response = await fetch(`/api/invoices?${params}`, { credentials: 'include' });
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
        className="border-b border-border hover:bg-muted/50 cursor-pointer transition-all duration-200 group"
        onClick={() => navigate(`/invoices/${invoice.id}`)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-foreground font-semibold">{invoice.invoiceNumber}</div>
              {invoice.description && (
                <div className="text-muted-foreground text-sm mt-0.5">{invoice.description}</div>
              )}
            </div>
            {invoice.nftMint && (
              <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200 font-medium">
                NFT
              </span>
            )}
            {invoice.isPrivate && (
              <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-700 rounded-full border border-gray-200 flex items-center gap-1 font-medium">
                🔒 Private
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-foreground font-semibold">
            {formatCurrency(invoice.totalAmount, invoice.currency)}
          </div>
          {parseFloat(invoice.paidAmount) > 0 && (
            <div className="text-muted-foreground text-sm">
              Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          {getStatusBadge(displayStatus)}
        </td>
        <td className="px-6 py-4 text-foreground">
          {formatDate(invoice.dueDate)}
        </td>
        <td className="px-6 py-4">
          <div className="text-muted-foreground text-sm truncate max-w-xs font-mono">
            {invoice.invoiceeWalletAddress.slice(0, 8)}...{invoice.invoiceeWalletAddress.slice(-6)}
          </div>
        </td>
        <td className="px-6 py-4 text-muted-foreground text-sm">
          {formatDate(invoice.createdAt)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 id="tour-welcome" className="text-4xl font-bold text-foreground tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-2">Manage your sent and received invoices</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              if (!walletAddress) return;
              try {
                const response = await fetch(`/api/invoices/export?format=csv&wallet=${walletAddress}`, {
                  credentials: 'include'
                });
                if (!response.ok) throw new Error('Export failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `invoices-${walletAddress.slice(0, 8)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Export error:', err);
              }
            }}
            className="btn-secondary px-5 py-2.5 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            id="tour-create-invoice"
            onClick={() => navigate("/invoices/create")}
            className="btn-primary px-6 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="tour-stats-overview">
          <div className="card-flat p-6 hover:shadow-md transition-all">
            <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Total Invoices</div>
            <div className="text-4xl font-bold text-foreground">{filteredInvoices.length}</div>
          </div>
          <div className="card-flat p-6 hover:shadow-md transition-all border-l-4 border-blue-500">
            <div className="text-xs font-semibold text-blue-600 mb-3 uppercase tracking-wide">Sent</div>
            <div className="text-4xl font-bold text-blue-600">{sentInvoices.length}</div>
          </div>
          <div className="card-flat p-6 hover:shadow-md transition-all border-l-4 border-purple-500">
            <div className="text-xs font-semibold text-purple-600 mb-3 uppercase tracking-wide">Received</div>
            <div className="text-4xl font-bold text-purple-600">{receivedInvoices.length}</div>
          </div>
          <div className="card-flat p-6 hover:shadow-md transition-all border-l-4 border-red-500">
            <div className="text-xs font-semibold text-red-600 mb-3 uppercase tracking-wide">Overdue</div>
            <div className="text-4xl font-bold text-red-600">
              {filteredInvoices.filter(
                (inv) => inv.status !== "paid" && new Date(inv.dueDate) < new Date()
              ).length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-flat p-6 my-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
          <div className="card-flat p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground mt-4 font-medium">Loading invoices...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="card-flat border-2 border-red-200 bg-red-50 p-8 text-center">
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={loadInvoices}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State / Getting Started Guide */}
        {!loading && !error && filteredInvoices.length === 0 && (
          <div className="card-flat p-12">
            <div className="max-w-3xl mx-auto text-center space-y-8">

              <div className="space-y-3">
                <div className="text-6xl mb-4">👋</div>
                <h3 className="text-3xl font-bold text-foreground">Welcome to Invoix!</h3>
                <p className="text-muted-foreground text-lg">Let's get you set up to receive your first crypto payment.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 text-left">
                {/* Step 1 */}
                <div className="card-flat p-6 hover:shadow-md transition-all border-t-4 border-blue-500">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-lg mb-4">1</div>
                  <h4 className="text-foreground font-bold text-lg mb-2">Setup Profile</h4>
                  <p className="text-sm text-muted-foreground mb-4">Add your business logo and details so you look professional.</p>
                  <button
                    onClick={() => navigate("/settings")}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Go to Settings →
                  </button>
                </div>

                {/* Step 2 */}
                <div className="card-flat p-6 hover:shadow-md transition-all border-t-4 border-purple-500">
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 font-bold text-lg mb-4">2</div>
                  <h4 className="text-foreground font-bold text-lg mb-2">Add Customer</h4>
                  <p className="text-sm text-muted-foreground mb-4">Save your client's wallet address to your address book.</p>
                  <button
                    onClick={() => navigate("/customers")}
                    className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    Add Customer →
                  </button>
                </div>

                {/* Step 3 */}
                <div className="card-flat p-6 hover:shadow-md transition-all border-t-4 border-emerald-500">
                  <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 font-bold text-lg mb-4">3</div>
                  <h4 className="text-foreground font-bold text-lg mb-2">Create Invoice</h4>
                  <p className="text-sm text-muted-foreground mb-4">Send your first bill and get paid in seconds.</p>
                  <button
                    onClick={() => navigate("/invoices/create")}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    Draft Invoice →
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Invoice Table */}
        {!loading && !error && filteredInvoices.length > 0 && (
          <div className="card-flat overflow-hidden" id="tour-invoice-table">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
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
