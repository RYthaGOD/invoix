/**
 * Authentication Hook
 * 
 * Provides Sign-In With Solana (SIWS) authentication
 * Manages user session state and login/logout flows
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import bs58 from "bs58";

interface AuthContextType {
    isAuthenticated: boolean;
    walletAddress: string | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { publicKey, signMessage, connected, disconnect } = useWallet();
    const { toast } = useToast();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check authentication status on mount and wallet change
    useEffect(() => {
        checkAuth();
    }, [publicKey]);

    // Detect wallet/session mismatch and auto-logout stale session
    useEffect(() => {
        if (isAuthenticated && walletAddress && connected && publicKey) {
            const connectedWallet = publicKey.toBase58();
            if (connectedWallet !== walletAddress) {
                console.warn(`[AUTH] Wallet mismatch detected: Session=${walletAddress.slice(0, 8)}... Connected=${connectedWallet.slice(0, 8)}...`);

                toast({
                    title: "Session Expired",
                    description: "You switched wallets. Please sign in again.",
                    variant: "destructive",
                });

                // Clear the stale session
                fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include"
                }).then(() => {
                    setIsAuthenticated(false);
                    setWalletAddress(null);
                }).catch(console.error);
            }
        }
    }, [isAuthenticated, walletAddress, connected, publicKey]);

    const checkAuth = async () => {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "include", // Important: send cookies
            });

            if (response.ok) {
                const data = await response.json();
                setIsAuthenticated(data.authenticated);
                setWalletAddress(data.walletAddress || null);
            } else {
                setIsAuthenticated(false);
                setWalletAddress(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            setIsAuthenticated(false);
            setWalletAddress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async () => {
        if (!publicKey || !signMessage) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);

            // Create message to sign
            const timestamp = Date.now();
            const message = `Sign in to SolanaInvoice at ${timestamp}`;
            const messageBytes = new TextEncoder().encode(message);

            // Request signature from wallet
            const signature = await signMessage(messageBytes);
            const signatureBase58 = bs58.encode(signature);

            // Send to backend for verification
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Important: receive cookies
                body: JSON.stringify({
                    walletAddress: publicKey.toBase58(),
                    message,
                    signature: signatureBase58,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Authentication failed");
            }

            const data = await response.json();
            setIsAuthenticated(true);
            setWalletAddress(data.walletAddress);

            toast({
                title: "Login successful",
                description: `Authenticated as ${data.walletAddress.slice(0, 8)}...`,
            });
        } catch (error: any) {
            console.error("Login error:", error);
            toast({
                title: "Login failed",
                description: error.message || "Could not authenticate wallet",
                variant: "destructive",
            });
            setIsAuthenticated(false);
            setWalletAddress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            setIsLoading(true);

            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });

            setIsAuthenticated(false);
            setWalletAddress(null);

            toast({
                title: "Logged out",
                description: "You have been logged out successfully",
            });
        } catch (error) {
            console.error("Logout error:", error);
            toast({
                title: "Logout failed",
                description: "Could not logout properly",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                walletAddress,
                isLoading,
                login,
                logout,
                checkAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
