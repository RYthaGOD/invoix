/**
 * Customer Management Page
 * List and manage customer profiles
 */

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Edit, Trash2, User, Mail, Phone, Building } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Customer {
    id: string;
    customerWalletAddress: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerNotes?: string;
    createdAt: string;
}

export default function Customers() {
    const [, navigate] = useLocation();
    const { walletAddress } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    useEffect(() => {
        if (walletAddress) {
            loadCustomers();
        } else {
            setLoading(false);
        }
    }, [walletAddress]);

    const loadCustomers = async () => {
        if (!walletAddress) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/customers?wallet=${walletAddress}`, { credentials: 'include' });
            if (!response.ok) throw new Error("Failed to load customers");

            const data = await response.json();
            setCustomers(data.customers || []);
        } catch (error: any) {
            console.error("Error loading customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (customerId: string) => {
        if (!confirm("Are you sure you want to delete this customer?")) return;
        if (!walletAddress) return;

        try {
            const response = await fetch(`/api/customers/${customerId}?wallet=${walletAddress}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Failed to delete customer");

            await loadCustomers();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingCustomer(null);
        if (walletAddress) {
            loadCustomers();
        }
    };

    const filteredCustomers = customers.filter((customer) => {
        const query = searchQuery.toLowerCase();
        return (
            customer.customerName?.toLowerCase().includes(query) ||
            customer.customerEmail?.toLowerCase().includes(query) ||
            customer.customerWalletAddress.toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white tracking-tight">Customers</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="smoke-shadow px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Customer
                </button>
            </div>

            <div>
                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            placeholder="Search customers by name, email, or wallet..."
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                {/* Customer List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        <p className="text-gray-400 mt-4">Loading customers...</p>
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <User className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">
                            {searchQuery ? "No customers found" : "No customers yet"}
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {searchQuery
                                ? "Try adjusting your search query"
                                : "Add your first customer to get started"}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="smoke-shadow px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all"
                            >
                                Add Customer
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCustomers.map((customer) => (
                            <div key={customer.id} className="glass-card p-6 hover:border-purple-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <User className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">
                                                {customer.customerName || "Unnamed Customer"}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(customer)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <Edit className="w-4 h-4 text-gray-400 hover:text-white" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(customer.id)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {customer.customerEmail && (
                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <Mail className="w-4 h-4 text-gray-500" />
                                            {customer.customerEmail}
                                        </div>
                                    )}
                                    {customer.customerPhone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <Phone className="w-4 h-4 text-gray-500" />
                                            {customer.customerPhone}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <Building className="w-4 h-4 text-gray-500" />
                                        <code className="text-xs bg-white/5 px-2 py-1 rounded">
                                            {customer.customerWalletAddress.slice(0, 8)}...{customer.customerWalletAddress.slice(-6)}
                                        </code>
                                    </div>
                                </div>

                                {customer.customerNotes && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <p className="text-sm text-gray-400 line-clamp-2">{customer.customerNotes}</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => navigate(`/invoices/create?customer=${customer.customerWalletAddress}`)}
                                    className="mt-4 w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all text-sm font-medium"
                                >
                                    Create Invoice
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Customer Form Modal */}
            {showForm && (
                <CustomerForm
                    customer={editingCustomer}
                    onClose={handleFormClose}
                />
            )}
        </div>
    );
}

// Customer Form Component (inline for now, can be extracted)
function CustomerForm({
    customer,
    onClose,
}: {
    customer: Customer | null;
    onClose: () => void;
}) {
    const { walletAddress } = useAuth();
    const [formData, setFormData] = useState({
        walletAddress: customer?.customerWalletAddress || "",
        name: customer?.customerName || "",
        email: customer?.customerEmail || "",
        phone: customer?.customerPhone || "",
        company: "", // Not stored separately but kept in form for UI convenience, added to notes on submit
        notes: customer?.customerNotes || "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            if (!walletAddress) throw new Error("Please connect your wallet");

            const url = customer
                ? `/api/customers/${customer.id}?wallet=${walletAddress}`
                : `/api/customers?wallet=${walletAddress}`;

            // Map form data to schema expected by backend
            const payload = {
                businessWalletAddress: walletAddress,
                customerWalletAddress: formData.walletAddress,
                customerName: formData.name,
                customerEmail: formData.email,
                customerPhone: formData.phone,
                customerNotes: formData.company
                    ? `${formData.notes}\nCompany: ${formData.company}`.trim()
                    : formData.notes,
                customerAddress: "", // Optional but defined in schema
            };

            const response = await fetch(url, {
                method: customer ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to save customer");
            }

            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="glass-card max-w-2xl w-full p-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                    {customer ? "Edit Customer" : "Add Customer"}
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Wallet Address *
                        </label>
                        <input
                            type="text"
                            value={formData.walletAddress}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, walletAddress: e.target.value })}
                            required
                            disabled={!!customer}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            placeholder="Customer's Solana wallet address"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Customer name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, company: e.target.value })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Company name"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="email@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Internal notes about this customer"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 smoke-shadow px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                        >
                            {saving ? "Saving..." : customer ? "Update Customer" : "Add Customer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
