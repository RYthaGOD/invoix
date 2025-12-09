/**
 * Invoice Templates Page
 * 
 * Manage reusable invoice templates
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit, Trash2, FileText, Copy } from "lucide-react";
import { TemplateForm } from "@/components/template-form";

interface Template {
    id: string;
    name: string;
    description: string | null;
    defaultCurrency: string;
    defaultPaymentTerms: string;
    defaultDueDays: number;
    defaultLineItems: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function Templates() {
    const { walletAddress } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    useEffect(() => {
        if (walletAddress) {
            fetchTemplates();
        } else {
            setLoading(false);
        }
    }, [walletAddress]);

    const fetchTemplates = async () => {
        if (!walletAddress) return;

        try {
            const response = await fetch(`/api/templates?wallet=${walletAddress}`);
            const data = await response.json();

            if (data.success) {
                setTemplates(data.templates);
            }
        } catch (error) {
            console.error("Failed to fetch templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!walletAddress || !confirm("Are you sure you want to delete this template?")) return;

        try {
            const response = await fetch(`/api/templates/${id}?wallet=${walletAddress}`, {
                method: "DELETE",
            });

            const data = await response.json();
            if (data.success) {
                setTemplates(templates.filter(t => t.id !== id));
            }
        } catch (error) {
            console.error("Failed to delete template:", error);
        }
    };

    const handleEdit = (template: Template) => {
        setEditingTemplate(template);
        setShowForm(true);
    };

    const handleCreateFromTemplate = (templateId: string) => {
        // Navigate to invoice creation with template
        window.location.href = `/invoices/create?template=${templateId}`;
    };

    if (!walletAddress) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <div className="glass-card p-8 text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
                    <p className="text-gray-300">Please connect your wallet to manage templates</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Invoice Templates</h1>
                    <p className="text-gray-300">Create and manage reusable invoice templates</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplate(null);
                        setShowForm(true);
                    }}
                    className="smoke-shadow px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Template
                </button>
            </div>

            {/* Templates Grid */}
            {loading ? (
                <div className="glass-card p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="text-gray-300 mt-4">Loading templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Templates Yet</h3>
                    <p className="text-gray-300 mb-6">Create your first template to streamline invoice creation</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="smoke-shadow px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                    >
                        Create Template
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => {
                        const lineItems = template.defaultLineItems ? JSON.parse(template.defaultLineItems) : [];

                        return (
                            <div key={template.id} className="glass-card p-6 hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-white mb-1">{template.name}</h3>
                                        {template.description && (
                                            <p className="text-sm text-gray-400">{template.description}</p>
                                        )}
                                    </div>
                                    {!template.isActive && (
                                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Currency:</span>
                                        <span className="text-white font-medium">{template.defaultCurrency}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Payment Terms:</span>
                                        <span className="text-white font-medium">{template.defaultPaymentTerms}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Due Days:</span>
                                        <span className="text-white font-medium">{template.defaultDueDays} days</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Line Items:</span>
                                        <span className="text-white font-medium">{lineItems.length}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleCreateFromTemplate(template.id)}
                                        className="flex-1 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Use
                                    </button>
                                    <button
                                        onClick={() => handleEdit(template)}
                                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Template Form Modal */}
            {showForm && (
                <TemplateForm
                    template={editingTemplate}
                    onClose={() => {
                        setShowForm(false);
                        setEditingTemplate(null);
                    }}
                    onSuccess={fetchTemplates}
                />
            )}
        </div>
    );
}
