import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { User, Lock, Loader2, FileText } from "lucide-react";
import { CurrencySelector } from "@/components/currency-selector";
import { LineItemEditor } from "@/components/line-item-editor";
import { safeAdd, safeMultiply, safeSubtract } from "@shared/math";
import { useAuth } from "@/hooks/use-auth";

export interface LineItem {
    description: string;
    quantity: string;
    unitPrice: string;
}

export interface InvoiceFormData {
    invoiceeWalletAddress: string;
    customerEmail?: string;
    description: string;
    notes: string;
    dueDate: string;
    currency: string;
    paymentTerms: string;
    lineItems: LineItem[];
    taxRate: string;
    discountAmount: string;
    isPrivate: boolean;
    mintNFT: boolean;
    encryptWithArcium: boolean;
}

interface InvoiceFormProps {
    defaultValues?: Partial<InvoiceFormData>;
    onSubmit: (data: InvoiceFormData) => Promise<void>;
    isSubmitting: boolean;
    mintingStatus?: string;
    connected: boolean;
    className?: string;
    templates?: any[]; // Pass templates if available
    onTemplateSelect?: (templateId: string) => void;
}

export function InvoiceForm({
    defaultValues,
    onSubmit,
    isSubmitting,
    mintingStatus,
    connected,
    className,
    templates = [],
    onTemplateSelect
}: InvoiceFormProps) {
    const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<InvoiceFormData>({
        defaultValues: {
            currency: "USDC",
            customerEmail: "",
            paymentTerms: "Net 30",
            taxRate: "0",
            discountAmount: "0",
            isPrivate: true,
            mintNFT: true,
            encryptWithArcium: false,
            lineItems: [{ description: "", quantity: "1", unitPrice: "0" }],
            ...defaultValues
        },
    });

    // Watch values for calculations
    const lineItems = watch("lineItems");
    const taxRate = watch("taxRate");
    const discountAmount = watch("discountAmount");

    // Calculate Totals Live
    const subtotal = lineItems.reduce((acc, item) => {
        const qty = item.quantity || "0";
        const price = item.unitPrice || "0";
        return safeAdd(acc, safeMultiply(qty, price));
    }, "0");

    const taxAmount = safeMultiply(subtotal, safeMultiply(taxRate || "0", "0.01"));
    const discountVal = discountAmount || "0";
    const totalWithTax = safeAdd(subtotal, taxAmount);
    const total = safeSubtract(totalWithTax, discountVal);

    // Allow parent to reset form when template changes
    useEffect(() => {
        if (defaultValues) {
            reset((prev) => ({ ...prev, ...defaultValues }));
        }
    }, [defaultValues, reset]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${className}`}>

            {/* Template Selector (Optional) */}
            {templates.length > 0 && onTemplateSelect && (
                <div className="glass-card p-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Start from Template (Optional)
                    </label>
                    <select
                        onChange={(e) => onTemplateSelect(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">-- Select a template --</option>
                        {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Basic Information */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" />
                    Invoice Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Customer Wallet Address *
                        </label>
                        <input
                            {...register("invoiceeWalletAddress", {
                                required: "Customer wallet address is required",
                                minLength: { value: 32, message: "Invalid Solana wallet address" }
                            })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Customer's Solana wallet address"
                        />
                        {errors.invoiceeWalletAddress && (
                            <p className="text-red-400 text-xs mt-1">{errors.invoiceeWalletAddress.message}</p>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Customer Email (Optional)
                        </label>
                        <input
                            {...register("customerEmail", {
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: "Invalid email address"
                                }
                            })}
                            type="email"
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="customer@example.com (for notifications)"
                        />
                        {errors.customerEmail && (
                            <p className="text-red-400 text-xs mt-1">{errors.customerEmail.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Due Date *
                        </label>
                        <input
                            {...register("dueDate", { required: "Due date is required" })}
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        {errors.dueDate && (
                            <p className="text-red-400 text-xs mt-1">{errors.dueDate.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Currency *
                        </label>
                        <Controller
                            name="currency"
                            control={control}
                            render={({ field }) => (
                                <CurrencySelector
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Payment Terms
                        </label>
                        <select
                            {...register("paymentTerms")}
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

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description
                    </label>
                    <input
                        {...register("description", { required: "Description is required" })}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Brief description of this invoice"
                    />
                    {errors.description && (
                        <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
                    )}
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Notes (Internal)
                    </label>
                    <textarea
                        {...register("notes")}
                        rows={3}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Internal notes (not visible to customer)"
                    />
                </div>
            </div>

            {/* Editor & Calculations */}
            <LineItemEditor
                register={register}
                control={control}
                errors={errors}
                watch={watch}
            />

            <div className="glass-card p-6">
                {/* Totals Display */}
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                        <div className="text-right text-gray-400">Subtotal:</div>
                        <div className="text-right text-white font-medium">${parseFloat(subtotal).toFixed(2)}</div>

                        <div className="text-right text-gray-400">
                            <input
                                {...register("taxRate")}
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="0"
                            />
                            % Tax:
                        </div>
                        <div className="text-right text-white">${parseFloat(taxAmount).toFixed(2)}</div>

                        <div className="text-right text-gray-400">
                            Discount: $
                            <input
                                {...register("discountAmount")}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="0"
                            />
                        </div>
                        <div className="text-right text-white">-${parseFloat(discountVal).toFixed(2)}</div>

                        <div className="text-right text-gray-300 font-semibold text-lg pt-3 border-t border-white/10">
                            Total:
                        </div>
                        <div className="text-right text-purple-400 font-bold text-xl pt-3 border-t border-white/10">
                            ${parseFloat(total).toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Privacy & NFT Options */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-400" />
                    Privacy & Features
                </h2>

                <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            {...register("isPrivate")}
                            type="checkbox"
                            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                        />
                        <div>
                            <div className="text-white font-medium group-hover:text-purple-300 transition-colors">
                                Private Invoice
                            </div>
                            <div className="text-gray-400 text-sm">
                                Hide amounts and wallet addresses from public view
                            </div>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            {...register("mintNFT")}
                            type="checkbox"
                            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                        />
                        <div>
                            <div className="text-white font-medium group-hover:text-purple-300 transition-colors">
                                Mint as NFT {connected ? "(Client-Side)" : ""} 🎨
                            </div>
                            <div className="text-gray-400 text-sm">
                                Create a tradeable NFT.
                                <span className="text-yellow-400 ml-1">
                                    ⚠️ Transaction fee (~0.002 SOL) payed by you.
                                </span>
                            </div>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            {...register("encryptWithArcium")}
                            type="checkbox"
                            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                        />
                        <div>
                            <div className="text-white font-medium group-hover:text-purple-300 transition-colors">
                                Arcium Encryption 🔐
                            </div>
                            <div className="text-gray-400 text-sm">
                                End-to-end encryption using Arcium v0.5 MXE
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="smoke-shadow px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        "Create Invoice"
                    )}
                </button>
            </div>

            {/* Status Overlay (for minting) */}
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
        </form>
    );
}
