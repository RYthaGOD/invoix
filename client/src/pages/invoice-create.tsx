/**
 * Invoice Creation Form
 * 
 * Complete form for creating new invoices with:
 * - Line item management
 * - Automatic calculations
 * - Privacy settings
 * - NFT auto-mint option
 * - Arcium encryption option
 */

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2, Lock, DollarSign, Calendar, User, FileText } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/use-auth";
import { CurrencySelector } from "@/components/currency-selector";
import { getStablecoinConfig } from "@shared/stablecoin-config";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceFormData {
  invoiceeWalletAddress: string;
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

export default function InvoiceCreate() {
  const [, navigate] = useLocation();
  const { publicKey, connected } = useWallet();
  const { isAuthenticated, walletAddress, login, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Check authentication on mount
  useEffect(() => {
    if (connected && !isAuthenticated && !authLoading) {
      // Prompt user to login
      setError("Please login to create invoices");
    }
  }, [connected, isAuthenticated, authLoading]);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      currency: "USDC",
      paymentTerms: "Net 30",
      taxRate: "0",
      discountAmount: "0",
      isPrivate: true,
      mintNFT: true,
      encryptWithArcium: false,
      lineItems: [{ description: "", quantity: "1", unitPrice: "0" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  // Load templates on mount
  useEffect(() => {
    if (publicKey) {
      fetchTemplates();
    }
  }, [publicKey]);

  const fetchTemplates = async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`/api/templates?wallet=${publicKey.toBase58()}`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates.filter((t: any) => t.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  // Handle template selection
  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) return;
    setSelectedTemplate(templateId);

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Parse line items
    const lineItems = template.defaultLineItems ? JSON.parse(template.defaultLineItems) : [];

    // Reset form with template data
    const formData: any = {
      currency: template.defaultCurrency,
      paymentTerms: template.defaultPaymentTerms,
      lineItems: lineItems.length > 0 ? lineItems : [{ description: "", quantity: "1", unitPrice: "0" }],
    };

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.defaultDueDays);
    formData.dueDate = dueDate.toISOString().split('T')[0];

    // Update form
    Object.keys(formData).forEach(key => {
      if (key === 'lineItems') {
        // Clear existing items and add new ones
        while (fields.length > 0) {
          remove(0);
        }
        formData.lineItems.forEach((item: any) => {
          append(item);
        });
      } else {
        (control as any)._formValues[key] = formData[key];
      }
    });
  };

  const lineItems = watch("lineItems");
  const taxRate = watch("taxRate");
  const discountAmount = watch("discountAmount");

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || "0");
    const unitPrice = parseFloat(item.unitPrice || "0");
    return sum + (quantity * unitPrice);
  }, 0);

  const taxAmount = subtotal * (parseFloat(taxRate || "0") / 100);
  const discount = parseFloat(discountAmount || "0");
  const total = subtotal + taxAmount - discount;

  const onSubmit = async (data: InvoiceFormData) => {
    // Check authentication first
    if (!isAuthenticated || !walletAddress) {
      setError("Please login with your wallet first");
      await login(); // Trigger login flow
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Prepare invoice data (no need to send invoicerWalletAddress - server gets it from session)
      const invoiceData = {
        invoiceNumber,
        invoiceeWalletAddress: data.invoiceeWalletAddress,
        description: data.description,
        notes: data.notes,
        dueDate: new Date(data.dueDate).toISOString(),
        currency: data.currency,
        tokenMint: getStablecoinConfig(data.currency)?.mint || data.currency,
        tokenDecimals: 6, // All stablecoins use 6 decimals
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: data.discountAmount,
        totalAmount: total.toString(),
        remainingAmount: total.toString(),
        paidAmount: "0",
        status: "draft",
        paymentTerms: data.paymentTerms,
        isPrivate: data.isPrivate,
        hideAmounts: data.isPrivate,
        hideParties: data.isPrivate,
        mintNFT: data.mintNFT,
        encryptWithArcium: data.encryptWithArcium,
        allowedParties: data.encryptWithArcium
          ? [walletAddress, data.invoiceeWalletAddress]
          : undefined,
      };

      // Create invoice (session cookie sent automatically)
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Important: send session cookie
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle authentication errors
        if (errorData.code === "NOT_AUTHENTICATED") {
          setError("Session expired. Please login again");
          await login();
          return;
        }

        throw new Error(errorData.message || "Failed to create invoice");
      }

      const result = await response.json();

      // Add line items
      for (const item of data.lineItems) {
        if (item.description && parseFloat(item.quantity) > 0) {
          const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);

          await fetch(`/api/invoices/${result.invoice.id}/line-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: lineTotal.toString(),
              lineNumber: data.lineItems.indexOf(item) + 1,
            }),
          });
        }
      }

      // Success! Navigate to invoice detail
      navigate(`/invoices/${result.invoice.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/invoices")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Invoice</h1>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated && connected && (
            <button
              onClick={login}
              disabled={authLoading}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {authLoading ? "Loading..." : "Login"}
            </button>
          )}
          {isAuthenticated && walletAddress && (
            <div className="text-sm text-gray-400">
              Logged in: {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="glass-card border border-red-500/30 bg-red-500/10 p-4 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="glass-card p-6">
              <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Start from Template (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Select a template --</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-sm text-gray-400 mt-2">
                  Template applied! You can modify the fields below as needed.
                </p>
              )}
            </div>
          )}

          {/* Basic Information */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Invoice Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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
                {...register("description")}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Brief description of this invoice"
              />
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

          {/* Line Items */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-400" />
                Line Items
              </h2>
              <button
                type="button"
                onClick={() => append({ description: "", quantity: "1", unitPrice: "0" })}
                className="smoke-shadow px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-5">
                    <input
                      {...register(`lineItems.${index}.description` as const)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Item description"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      {...register(`lineItems.${index}.quantity` as const)}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      {...register(`lineItems.${index}.unitPrice` as const)}
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Price"
                    />
                  </div>
                  <div className="col-span-2 text-right text-white pt-2">
                    ${((parseFloat(lineItems[index]?.quantity || "0") * parseFloat(lineItems[index]?.unitPrice || "0"))).toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                <div className="text-right text-gray-400">Subtotal:</div>
                <div className="text-right text-white font-medium">${subtotal.toFixed(2)}</div>

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
                <div className="text-right text-white">${taxAmount.toFixed(2)}</div>

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
                <div className="text-right text-white">-${discount.toFixed(2)}</div>

                <div className="text-right text-gray-300 font-semibold text-lg pt-3 border-t border-white/10">
                  Total:
                </div>
                <div className="text-right text-purple-400 font-bold text-xl pt-3 border-t border-white/10">
                  ${total.toFixed(2)}
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
                    Mint as NFT 🎨
                  </div>
                  <div className="text-gray-400 text-sm">
                    Create a tradeable NFT for this invoice (~$0.001 cost)
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

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate("/invoices")}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="smoke-shadow px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
