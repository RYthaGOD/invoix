import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface AnalyticsStats {
    pageViews: number;
    uniqueWallets: number;
    isLoading: boolean;
}

// Global cache for stats to avoid refetching too often
let cachedStats: AnalyticsStats | null = null;
let lastFetchTime = 0;

export function useAnalytics() {
    const [location] = useLocation();

    // Track Page Views
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await fetch("/api/analytics/event", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventType: "page_view",
                        path: location,
                        userAgent: navigator.userAgent
                    })
                });
            } catch (err) {
                console.warn("Analytics tracking failed", err);
            }
        };

        trackPageView();
    }, [location]);

    // Function to track wallet connections
    const trackWalletConnect = async (walletAddress: string) => {
        try {
            await fetch("/api/analytics/event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: "wallet_connect",
                    path: location,
                    walletAddress,
                    userAgent: navigator.userAgent
                })
            });
        } catch (err) {
            console.warn("Wallet tracking failed", err);
        }
    };

    return { trackWalletConnect };
}

export function useAnalyticsStats() {
    const [stats, setStats] = useState<AnalyticsStats>(
        cachedStats || { pageViews: 0, uniqueWallets: 0, isLoading: true }
    );

    useEffect(() => {
        const fetchStats = async () => {
            // Simple cache validity check (1 minute)
            const now = Date.now();
            if (cachedStats && (now - lastFetchTime < 60000)) {
                setStats(cachedStats);
                return;
            }

            try {
                const res = await fetch("/api/analytics/stats");
                if (res.ok) {
                    const data = await res.json();
                    const newStats = {
                        pageViews: data.pageViews || 0,
                        uniqueWallets: data.uniqueWallets || 0,
                        isLoading: false
                    };
                    cachedStats = newStats;
                    lastFetchTime = now;
                    setStats(newStats);
                }
            } catch (error) {
                console.warn("Failed to fetch analytics stats");
                setStats(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchStats();
    }, []);

    return stats;
}
