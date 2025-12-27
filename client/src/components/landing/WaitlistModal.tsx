
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
    const { publicKey } = useWallet();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        projectName: "",
        useCaseDescription: ""
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!publicKey) {
            toast({
                title: "Wallet Required",
                description: "Please connect your wallet to apply.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/waitlist/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: publicKey.toString(),
                    ...formData
                })
            });

            const data = await response.json();

            if (data.success) {
                setIsSuccess(true);
            } else if (response.status === 409) {
                // Already listed
                setIsSuccess(true); // Treat as success UI-wise but different message
                toast({
                    title: "Application Received",
                    description: "You have already applied! we are reviewing it."
                });
            } else {
                throw new Error(data.message || "Failed to apply");
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[#0f0f11] border border-white/10 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <h2 className="text-xl font-bold font-heading text-white">
                            Developer Access request
                        </h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {isSuccess ? (
                            <div className="text-center py-8">
                                <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Application Received!</h3>
                                <p className="text-muted-foreground">
                                    We have received your request. You will receive an email once your API key is approved.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="mt-6 btn-primary w-full py-2 rounded-lg"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Project Name</label>
                                    <input
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        placeholder="My Awesome DApp"
                                        value={formData.projectName}
                                        onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        placeholder="dev@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-400">Use Case Description</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all resize-none"
                                        placeholder="Describe how you plan to use the API..."
                                        value={formData.useCaseDescription}
                                        onChange={(e) => setFormData({ ...formData, useCaseDescription: e.target.value })}
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isLoading || !publicKey}
                                        className="w-full btn-primary h-12 rounded-lg font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : !publicKey ? (
                                            "Connect Wallet to Apply"
                                        ) : (
                                            "Submit Application"
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
