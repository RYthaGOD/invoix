import React from "react";
import { UseFormRegister, Control, useFieldArray, FieldErrors } from "react-hook-form";
import { Plus, Trash2, DollarSign } from "lucide-react";

interface LineItem {
    description: string;
    quantity: string;
    unitPrice: string;
}

interface LineItemEditorProps {
    register: UseFormRegister<any>;
    control: Control<any>;
    errors: FieldErrors<any>;
    watch: any;
}

export function LineItemEditor({ register, control, errors, watch }: LineItemEditorProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "lineItems",
    });

    const lineItems = watch("lineItems");

    return (
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
                        <div className="col-span-12 md:col-span-5">
                            <input
                                {...register(`lineItems.${index}.description` as const, { required: "Description required" })}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Qty"
                            />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <input
                                {...register(`lineItems.${index}.unitPrice` as const, { min: 0 })}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Price"
                            />
                        </div>
                        <div className="col-span-10 md:col-span-2 text-right text-white pt-2 font-mono">
                            ${((parseFloat(lineItems[index]?.quantity || "0") * parseFloat(lineItems[index]?.unitPrice || "0"))).toFixed(2)}
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
