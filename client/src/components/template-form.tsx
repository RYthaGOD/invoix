/**
 * Template Form Component
 * 
 * Modal form for creating and editing invoice templates
 */

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { X, Plus, Trash2 } from "lucide-react";
import { CurrencySelector } from "./currency-selector";
import { getStablecoinConfig } from "@shared/stablecoin-config";

interface LineItem {
    description: string;
    quantity: string;
    unitPrice: string;
}

interface TemplateFormProps {
    template?: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function TemplateForm({ template, onClose, onSuccess }: TemplateFormProps) {
    const { publicKey } = useWallet();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: template?.name || "",
        description: template?.description || "",
        defaultCurrency: template?.defaultCurrency || "USDC",
        defaultPaymentTerms: template?.defaultPaymentTerms || "Net 30",
        defaultDueDays: template?.defaultDueDays || 30,
    });
    const [lineItems, setLineItems] = useState<LineItem[]>(
        template?.defaultLineItems
            ? JSON.parse(template.defaultLineItems)
            : [{ description: "", quantity: "1", unitPrice: "0" }]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;

        setLoading(true);
        try {
            const url = template
                ? `/api/templates/${template.id}?wallet=${publicKey.toBase58()}`
                : `/api/templates?wallet=${publicKey.toBase58()}`;

            const method = template ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    defaultLineItems: lineItems.filter(item => item.description),
                }),
            });

            const data = await response.json();
            if (data.success) {
                onSuccess();
                onClose();
            } else {
                alert(data.message || "Failed to save template");
            }
        } catch (error) {
            console.error("Failed to save template:", error);
            alert("Failed to save template");
        } finally {
            setLoading(false);
        }
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { description: "", quantity: "1", unitPrice: "0" }]);
    };

    const removeLineItem = (index: number) => {
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
        const updated = [...lineItems];
        updated[index][field] = value;
        setLineItems(updated);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="glass-card p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">
                        {template ? "Edit Template" : "Create Template"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Template Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Template Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g., Monthly Consulting"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Brief description of this template"
                        />
                    </div>

                    {/* Currency and Payment Terms */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Default Currency *
                            </label>
                            <CurrencySelector
                                value={formData.defaultCurrency}
                                onChange={(value) => setFormData({ ...formData, defaultCurrency: value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Payment Terms *
                            </label>
                            <select
                                value={formData.defaultPaymentTerms}
                                onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="Due on Receipt">Due on Receipt</option>
                                <option value="Net 15">Net 15</option>
                                <option value="Net 30">Net 30</option>
                                <option value="Net 60">Net 60</option>
                                <option value="Net 90">Net 90</option>
                            </select>
                        </div>
                    </div>

                    {/* Due Days */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Default Due Days *
                        </label>
                        <input
                            type="number"
                            value={formData.defaultDueDays}
                            onChange={(e) => setFormData({ ...formData, defaultDueDays: parseInt(e.target.value) })}
                            min="1"
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Default Line Items
                            </label>
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {lineItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2">
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                                        placeholder="Description"
                                        className="col-span-6 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                                        placeholder="Qty"
                                        min="1"
                                        className="col-span-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                                        placeholder="Price"
                                        min="0"
                                        step="0.01"
                                        className="col-span-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeLineItem(index)}
                                        className="col-span-1 px-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                        >
                            {loading ? "Saving..." : template ? "Update Template" : "Create Template"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
