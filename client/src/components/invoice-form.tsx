import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { FileText, User, Loader2, Lock, ShieldCheck, Info, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader } from "@/components/ui/loader"; // Import premium loader
import { CurrencySelector } from "@/components/currency-selector";
import { LineItemEditor } from "@/components/line-item-editor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { safeAdd, safeMultiply, safeSubtract } from "@shared/math";
import { getCurrencySymbol } from "@/lib/currency-utils";
import { PrivacyControls } from "./privacy-controls";

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
    solPrice?: number | null; // For USD conversion display
}

export function InvoiceForm({
    defaultValues,
    onSubmit,
    isSubmitting,
    mintingStatus,
    connected,
    className,
    templates = [],
    onTemplateSelect,
    solPrice
}: InvoiceFormProps) {
    const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<InvoiceFormData>({
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
    const currency = watch("currency");
    const currencySymbol = getCurrencySymbol(currency || "USDC");

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
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card p-6"
                >
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
                </motion.div>
            )}

            {/* Basic Information */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="glass-card p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" />
                    Invoice Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2" id="tour-client-select">
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            Customer Wallet Address *
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">The Solana address that will receive this invoice and pay the funds.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
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
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
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

                    <div id="tour-currency-select">
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
            </motion.div>

            {/* Editor & Calculations */}
            <motion.div
                id="tour-items-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <LineItemEditor
                    register={register}
                    control={control}
                    errors={errors}
                    watch={watch}
                    currency={currency}
                    solPrice={solPrice}
                />
            </motion.div>

            <motion.div
                className="glass-card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
            >
                {/* Totals Display */}
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                        <div className="text-right text-gray-400">Subtotal:</div>
                        <div className="text-right text-white font-medium">{currencySymbol}{parseFloat(subtotal).toFixed(2)}</div>

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
                        <div className="text-right text-white">{currencySymbol}{parseFloat(taxAmount).toFixed(2)}</div>

                        <div className="text-right text-gray-400">
                            Discount: {currencySymbol}
                            <input
                                {...register("discountAmount")}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-500"
                                placeholder="0"
                            />
                        </div>
                        <div className="text-right text-white">-{currencySymbol}{parseFloat(discountVal).toFixed(2)}</div>

                        <div className="text-right text-gray-300 font-semibold text-lg pt-3 border-t border-white/10">
                            Total:
                        </div>
                        <div className="text-right pt-3 border-t border-white/10">
                            <div className="text-purple-400 font-bold text-xl">
                                {currencySymbol}{parseFloat(total).toFixed(2)}
                            </div>
                            {currency === "SOL" && solPrice && (
                                <div className="text-sm text-gray-400 mt-1">
                                    ≈ ${(parseFloat(total) * solPrice).toFixed(2)} USD
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Privacy & NFT Options */}
            <motion.div
                className="glass-card p-6"
                id="tour-mint-settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
            >
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-400" />
                    Privacy & Features
                </h2>

                <div className="space-y-6">
                    {/* Service Fee Info */}
                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                        <Info className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
                        <div>
                            <div className="text-white text-sm font-semibold flex items-center gap-2">
                                Safe and Secure Anti-Spam Protection
                                <div className="relative group/tooltip">
                                    <HelpCircle className="w-3 h-3 text-gray-500 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded text-xs text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                                        Small fee prevents network congestion and ensures transaction priority.
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Creating an invoice requires a small service fee of <strong className="text-white">0.0001 SOL</strong> (~$0.02) to verify legitimacy.
                            </p>
                        </div>
                    </div>

                    <label className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/10">
                        <div className="pt-1">
                            <input
                                {...register("isPrivate")}
                                type="checkbox"
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                            />
                        </div>
                        <div className="flex-1">
                            <div className="text-white font-medium group-hover:text-purple-300 transition-colors flex items-center gap-3">
                                Private Invoice
                                <ShieldCheck className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-gray-400 text-sm">
                                Hide amounts and wallet addresses from public view.
                            </div>
                        </div>
                    </label>

                    <label className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/10">
                        <div className="pt-1">
                            <input
                                {...register("mintNFT")}
                                type="checkbox"
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                            />
                        </div>
                        <div className="flex-1">
                            <div className="text-white font-medium group-hover:text-purple-300 transition-colors">
                                Mint as NFT {connected ? "(Client-Side)" : ""} 🎨
                            </div>
                            <div className="text-gray-400 text-sm">
                                Create a tradeable, verified invoice NFT.
                                <span className="text-yellow-400/80 block mt-1 text-xs">
                                    ⚠️ Transaction fee (~0.002 SOL) payed by you.
                                </span>
                            </div>
                        </div>
                    </label>

                    <div className="space-y-3">
                        <PrivacyControls register={register} watch={watch} setValue={setValue} />
                    </div>
                </div>
            </motion.div>

            {/* Submit */}
            <motion.div
                className="flex justify-end pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
            >
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
            </motion.div>

            {/* Status Overlay (for minting) */}
            {mintingStatus && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
                    <div className="glass-card p-10 rounded-2xl flex flex-col items-center gap-6 max-w-md text-center border-primary/20 shadow-2xl shadow-primary/10">
                        {/* Use Premium Loader here, resized via CSS scaling or container if needed, but standard is fine */}
                        <div className="scale-75">
                            <Loader />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-heading font-bold gradient-text">Processing...</h3>
                            <p className="text-secondary-foreground font-medium text-lg">{mintingStatus}</p>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                            Please check your wallet for signature requests.
                        </p>
                    </div>
                </div>
            )}
        </form>
    );
}
