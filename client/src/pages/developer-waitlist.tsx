import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Code, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function DeveloperWaitlistPage() {
    const { publicKey } = useWallet();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        projectName: "",
        useCaseDescription: ""
    });

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
            const res = await fetch("/api/waitlist/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    walletAddress: publicKey.toString()
                })
            });

            const data = await res.json();

            if (!res.ok) {
                // Check if already applied
                if (data.message?.includes("already applied")) {
                    setIsSuccess(true); // Treat as success/status view
                    toast({
                        title: "Application Received",
                        description: "You have already applied. We made a note of it!",
                    });
                    return;
                }
                throw new Error(data.message || "Failed to submit application");
            }

            setIsSuccess(true);
            toast({
                title: "Application Submitted!",
                description: "We'll verify your developer profile and email you shortly.",
            });

        } catch (error: any) {
            toast({
                title: "Submission Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center bg-background/50">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full glass-card p-8 text-center"
                >
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Application Received</h2>
                    <p className="text-gray-400 mb-8">
                        Thanks for your interest in the Invoix Developer API. We are manually reviewing applications to ensure network stability.
                    </p>
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Status</p>
                        <div className="flex items-center gap-2 text-yellow-400">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                            </span>
                            <span className="font-mono text-sm">Under Review</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
                <Code className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold font-heading mb-4">Invoix Developer API</h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Integrate reliable Solana payments and invoicing directly into your dApp.
                    Apply for an API Key to get started.
                </p>
            </div>

            <div className="max-w-xl mx-auto glass-card p-8 relative overflow-hidden">
                {/* Decorative Gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none -mr-32 -mt-32" />

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Project Name
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="My Awesome dApp"
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-purple-500/50 focus:outline-none transition-colors"
                            value={formData.projectName}
                            onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Developer Email
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="dev@example.com"
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-purple-500/50 focus:outline-none transition-colors"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Use Case Description
                        </label>
                        <textarea
                            required
                            placeholder="How will you use the Invoicing API?"
                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-purple-500/50 focus:outline-none transition-colors h-32 resize-none"
                            value={formData.useCaseDescription}
                            onChange={e => setFormData({ ...formData, useCaseDescription: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            We use this to approximate rate limits.
                        </p>
                    </div>

                    <div className="pt-4">
                        {!publicKey ? (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm text-center">
                                Please connect your wallet via the navbar to submit.
                            </div>
                        ) : (
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full btn-primary h-12 flex items-center justify-center gap-2 group"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Request Access
                                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
