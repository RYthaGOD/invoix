
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ShieldCheck, Rocket, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function CommunityNFTDrop() {
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
                                className="object-cover w-full h-full grayscale opacity-50"
                                onError={(e) => (e.currentTarget.src = "https://placehold.co/400x400/101010/FFF?text=Coming+Soon")}
                            />
                            {/* Coming Soon Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                                <Rocket className="w-12 h-12 text-primary mb-2 animate-pulse" />
                                <span className="text-xl font-bold text-white tracking-widest uppercase">Coming Soon</span>
                            </div>
                        </div>

                        <div className="space-y-4 opacity-70">
                            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                                <h3 className="font-semibold text-primary flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Expected Benefits
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
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Link href="/invoices">
                            <Button variant="outline" className="w-full gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Dashboard
                            </Button>
                        </Link>
                        <p className="text-xs text-center text-muted-foreground opacity-60">
                            Join our community to be notified when the drop goes live.
                        </p>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}

