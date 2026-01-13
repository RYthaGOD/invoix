import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AuthModeSelector } from "@/components/auth-mode-selector";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles } from "lucide-react";

export function OnboardingFlow() {
    const { isAuthenticated, isLoading } = useAuth();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // If not authenticated and not loading, show the modal
        // We defer this slightly to avoid flashing on initial load
        if (!isLoading && !isAuthenticated) {
            const timer = setTimeout(() => setOpen(true), 500);
            return () => clearTimeout(timer);
        } else {
            setOpen(false);
        }
    }, [isAuthenticated, isLoading]);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            // Prevent closing if forced onboarding (not authenticated)
            if (!val && !isAuthenticated) return;
            setOpen(val);
        }}>
            <DialogContent className="max-w-4xl bg-black/80 backdrop-blur-xl border-white/10 p-0 overflow-hidden sm:rounded-3xl">
                <div className="grid md:grid-cols-5 h-full">

                    {/* Visual Side Panel */}
                    <div className="hidden md:flex md:col-span-2 bg-gradient-to-br from-purple-900/50 to-black p-8 flex-col justify-between border-r border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                                <Sparkles className="w-6 h-6 text-purple-300" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Invoix</h2>
                            <p className="text-purple-200/70 text-sm leading-relaxed">
                                The privacy-first invoicing platform for the Solana ecosystem.
                            </p>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="text-xs font-mono text-purple-400/50 uppercase tracking-widest">
                                Features Unlocked
                            </div>
                            <ul className="space-y-3">
                                {["Zero-Knowledge Privacy", "Instant Settlement", "Audit-Ready Receipts"].map((item) => (
                                    <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
                        <DialogHeader className="mb-8 text-left">
                            <DialogTitle className="text-3xl font-bold mb-2">Sign In</DialogTitle>
                            <DialogDescription className="text-lg">
                                Choose your preferred way to access the platform.
                            </DialogDescription>
                        </DialogHeader>

                        <AuthModeSelector />

                        <div className="mt-8 text-center">
                            <p className="text-xs text-muted-foreground">
                                By connecting, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
