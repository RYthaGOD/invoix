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
    authMode: 'traditional' | 'passkey' | null;  // Current authentication mode
    isLoading: boolean;
    login: (mode?: 'traditional' | 'passkey') => Promise<void>;  // Support dual modes
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    lazorkitWallet: any; // Exposed for transaction signing in other components
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { publicKey, signMessage, connected, disconnect } = useWallet();
    const { toast } = useToast();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<'traditional' | 'passkey' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lazorkitWallet, setLazorkitWallet] = useState<any>(null);

    // Load LazorKit hook dynamically
    useEffect(() => {
        if (!lazorkitWallet) {
            import('@lazorkit/wallet')
                .then((module) => {
                    // Create hook instance on successful import
                    setLazorkitWallet(module.useWallet());
                })
                .catch((e) => {
                    console.warn('[Auth] LazorKit not available:', e);
                });
        }
    }, [lazorkitWallet]);

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
                setAuthMode(data.authMode || 'traditional');  // Track auth mode from session
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

    const login = async (mode: 'traditional' | 'passkey' = 'traditional') => {
        // Passkey authentication via LazorKit
        if (mode === 'passkey') {
            if (!lazorkitWallet) {
                toast({
                    title: "Passkey auth loading...",
                    description: "Please wait a moment while we initialize security features.",
                    variant: "default",
                });
                return;
            }

            try {
                setIsLoading(true);

                // Connect with LazorKit (triggers WebAuthn prompt)
                const walletInfo = await lazorkitWallet.connect({ feeMode: 'paymaster' });

                // Defensive null checks
                if (!walletInfo || !walletInfo.smartWallet) {
                    throw new Error("Invalid wallet response from LazorKit");
                }

                const smartWalletAddress = walletInfo.smartWallet;

                // Create message to sign
                const timestamp = Date.now();
                const message = `Sign in to Invoix at ${timestamp}`;

                // Sign message (LazorKit handles WebAuthn signature)
                const signature = await lazorkitWallet.signMessage(message);

                if (!signature) {
                    throw new Error("Failed to generate signature");
                }

                // Send to backend for verification
                const response = await fetch("/api/auth/login/passkey", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        smartWalletAddress: walletInfo.smartWallet, // FIX: Use correct property from walletInfo
                        message,
                        signature,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || "Passkey authentication failed");
                }

                const data = await response.json();
                setIsAuthenticated(true);
                setWalletAddress(data.walletAddress);
                setAuthMode('passkey');

                toast({
                    title: "Login successful",
                    description: `Authenticated with passkey`,
                });
            } catch (error: any) {
                console.error("Passkey login error:", error);
                toast({
                    title: "Passkey login failed",
                    description: error.message || "Could not authenticate with passkey",
                    variant: "destructive",
                });
                setIsAuthenticated(false);
                setWalletAddress(null);
                setAuthMode(null);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Traditional wallet authentication
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
            setAuthMode('traditional');

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

            // Disconnect LazorKit if using passkey mode
            if (authMode === 'passkey' && lazorkitWallet && lazorkitWallet.disconnect) {
                try {
                    await lazorkitWallet.disconnect();
                } catch (e) {
                    console.warn('[Auth] LazorKit disconnect failed:', e);
                }
            }

            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });

            setIsAuthenticated(false);
            setWalletAddress(null);
            setAuthMode(null);

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
                authMode,  // Expose auth mode to consumers
                isLoading,
                login,
                logout,
                checkAuth,
                lazorkitWallet,
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
