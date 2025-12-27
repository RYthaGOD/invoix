
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Loader2, Zap, ShieldCheck, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

import { Connection, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer"; // Ensure buffer is available

const TOKEN_ADDRESS = "AMFBfC8moRTmo4JKCBjmBXVTftMZTsgqDyb8SSL6pump";


export default function CommunityNFTDrop() {
    const { publicKey, signTransaction } = useWallet();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // BLOCKER: Set to false to enable minting
    const BLOCK_MINT = true;

    const copyAddress = async () => {
        await navigator.clipboard.writeText(TOKEN_ADDRESS);
        setCopied(true);
        toast({
            title: "Address Copied",
            description: "Token contract address copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePurchase = async () => {
        if (!publicKey) {
            toast({
                title: "Connect Wallet",
                description: "Please connect your wallet to purchase.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            // 1. Create Invoice (Step 1 of Flow)
            const response = await apiRequest("POST", "/api/community-drop/create-invoice", {
                walletAddress: publicKey.toString(),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || "Failed to create invoice");
            }

            // 2. Redirect to Payment Page
            // The "Claim" (Mint) happens AFTER payment on that page.
            setLocation(`/pay/${data.invoiceId}`);

        } catch (error: any) {
            console.error("Purchase error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to start purchase.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-background via-background/90 to-primary/5 -z-10" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] -z-10" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full"
            >
                <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl relative overflow-hidden">
                    {/* Decorative shine */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
                            INVOIX Exclusive
                        </CardTitle>
                        <CardDescription className="text-lg mt-2">
                            Community Genesis Edition
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="aspect-square relative rounded-xl overflow-hidden border border-border shadow-inner bg-black/20 group">
                            <img
                                src="/uploads/invoix-exclusive.jpg"
                                alt="INVOIX Exclusive NFT"
                                className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => (e.currentTarget.src = "https://placehold.co/400x400/101010/FFF?text=Exclusive+NFT")}
                            />
                            {/* Limited Edition Badge */}
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-full shadow-lg z-10 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Limited: 1000
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                <span className="text-white font-medium text-sm">Preview</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                                <h3 className="font-semibold text-primary flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Exclusive Benefits
                                </h3>
                                <ul className="mt-2 space-y-2 text-sm text-foreground/80">
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary">•</span>
                                        <span>Early access to premium features</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary">•</span>
                                        <span>Voting rights in future governance</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-primary">•</span>
                                        <span>Discounted platform fees forever</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 rounded-lg bg-background border border-border">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Holders</p>
                                    <p className="text-xl font-bold text-green-500">$0.50</p>
                                    <p className="text-[10px] text-muted-foreground">In SOL</p>
                                </div>
                                <div className="p-3 rounded-lg bg-background border border-border">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Standard</p>
                                    <p className="text-xl font-bold">$5.00</p>
                                    <p className="text-[10px] text-muted-foreground">In SOL</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {!publicKey ? (
                            <WalletMultiButton className="w-full !bg-primary !h-12 !rounded-lg" />
                        ) : BLOCK_MINT ? (
                            <Button className="w-full h-12 text-lg font-bold bg-muted text-muted-foreground cursor-not-allowed" disabled>
                                Mint Opening Soon
                            </Button>
                        ) : (
                            <Button
                                onClick={handlePurchase}
                                className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating Invoice...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4 fill-current" />
                                        Purchase Instantly
                                    </>
                                )}
                            </Button>
                        )}

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={copyAddress}
                                className="group flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-xs text-muted-foreground hover:text-white font-mono"
                            >
                                <span className="text-primary/70 group-hover:text-primary">CA:</span>
                                {TOKEN_ADDRESS.slice(0, 6)}...{TOKEN_ADDRESS.slice(-6)}
                                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 group-hover:text-primary transition-colors" />}
                            </button>

                            <p className="text-xs text-center text-muted-foreground opacity-60">
                                Processed via secure on-chain SOL Invoice. <br />
                                NFT airdropped immediately upon payment.
                            </p>
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}
