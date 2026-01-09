/**
 * Authentication Mode Selector
 * 
 * Allows users to choose between traditional wallet and passkey authentication
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Wallet, Zap, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

export function AuthModeSelector() {
    const { login } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const [selectedMode, setSelectedMode] = useState<'traditional' | 'passkey' | null>(null);



    const handleConnect = async (mode: 'traditional' | 'passkey') => {
        setSelectedMode(mode);
        setIsConnecting(true);
        try {
            await login(mode);
        } finally {
            setIsConnecting(false);
            setSelectedMode(null);
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Passkey Mode */}
            {/* Passkey Mode */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <Card
                    className="relative hover:shadow-xl transition-all duration-300 border-2 hover:border-primary cursor-pointer group"
                    onClick={() => !isConnecting && handleConnect('passkey')}
                >
                    <div className="absolute top-4 right-4">
                        <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-pink-500">
                            Recommended
                        </Badge>
                    </div>

                    <CardHeader className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Fingerprint className="w-8 h-8 text-white" />
                        </div>

                        <div>
                            <CardTitle className="text-2xl mb-2">Sign in with Passkey</CardTitle>
                            <CardDescription className="text-base">
                                Use your device biometrics or PIN - no seed phrase needed
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Zap className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Zero Gas Fees</p>
                                    <p className="text-sm text-muted-foreground">Your first invoice is sponsored</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Secure & Simple</p>
                                    <p className="text-sm text-muted-foreground">Fingerprint or Face ID authentication</p>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 group-hover:scale-105 transition-transform"
                            disabled={isConnecting && selectedMode !== 'passkey'}
                        >
                            {isConnecting && selectedMode === 'passkey' ? (
                                "Connecting..."
                            ) : (
                                <>
                                    Get Started
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Traditional Wallet Mode */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <Card
                    className="relative hover:shadow-xl transition-all duration-300 border-2 hover:border-primary cursor-pointer group"
                    onClick={() => !isConnecting && handleConnect('traditional')}
                >


                    <CardHeader className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Wallet className="w-8 h-8 text-white" />
                        </div>

                        <div>
                            <CardTitle className="text-2xl mb-2">Connect Wallet</CardTitle>
                            <CardDescription className="text-base">
                                Use Phantom, Solflare, or any Solana wallet
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Full Control</p>
                                    <p className="text-sm text-muted-foreground">You manage your own keys</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Wallet className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Crypto-Native</p>
                                    <p className="text-sm text-muted-foreground">For experienced DeFi users</p>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full group-hover:scale-105 transition-transform"
                            disabled={isConnecting && selectedMode !== 'traditional'}
                        >
                            {isConnecting && selectedMode === 'traditional' ? (
                                "Connecting..."
                            ) : (
                                <>
                                    Connect Wallet
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
