import React from "react";
import { UseFormRegister, Control, useFieldArray, FieldErrors } from "react-hook-form";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency-utils";

interface LineItem {
    description: string;
    quantity: string;
    unitPrice: string;
}

interface LineItemEditorProps {
    register: UseFormRegister<any>;
    control: Control<any>;
    errors: FieldErrors<{ lineItems: LineItem[] }>;
    watch: any;
    currency?: string;
    solPrice?: number | null;
}

export function LineItemEditor({ register, control, errors, watch, currency = "USDC", solPrice }: LineItemEditorProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "lineItems",
    });

    const lineItems = watch("lineItems");
    const currencySymbol = getCurrencySymbol(currency);

    return (
        <div className="card-flat p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
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

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-3 items-center mb-2 px-1">
                <div className="col-span-12 md:col-span-5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                </div>
                <div className="col-span-6 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</label>
                </div>
                <div className="col-span-6 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Price</label>
                </div>
                <div className="col-span-10 md:col-span-2 text-right">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</label>
                </div>
                <div className="col-span-2 md:col-span-1">
                    {/* Actions column - no label */}
                </div>
            </div>

            <div className="space-y-3">
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-12 md:col-span-5">
                            <input
                                {...register(`lineItems.${index}.description` as const, { required: "Description required" })}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Item description"
                            />
                            {errors.lineItems?.[index]?.description && (
                                <p className="text-red-400 text-xs mt-1">{errors.lineItems[index]?.description?.message as string}</p>
                            )}
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <input
                                {...register(`lineItems.${index}.quantity` as const, { min: 0 })}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Qty"
                            />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <input
                                {...register(`lineItems.${index}.unitPrice` as const, { min: 0 })}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Price"
                            />
                        </div>
                        <div className="col-span-10 md:col-span-2 text-right pt-2">
                            <div className="text-foreground font-mono">
                                {currencySymbol}{((parseFloat(lineItems[index]?.quantity || "0") * parseFloat(lineItems[index]?.unitPrice || "0"))).toFixed(2)}
                            </div>
                            {currency === "SOL" && solPrice && (
                                <div className="text-xs text-muted-foreground">
                                    ≈ ${((parseFloat(lineItems[index]?.quantity || "0") * parseFloat(lineItems[index]?.unitPrice || "0")) * solPrice).toFixed(2)} USD
                                </div>
                            )}
                        </div>
                        <div className="col-span-2 md:col-span-1 flex justify-end">
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
        </div>
    );
}
