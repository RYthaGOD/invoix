import { useState, useEffect, useRef } from 'react';

/**
 * Hook to connect to the backend WebSocket and listen for global stats updates.
 * Falls back to basic polling if WS fails, but primarily driven by server push.
 */
export function useWebSocketStats() {
    const [globalStats, setGlobalStats] = useState<{
        totalInvoices: number;
        totalUsers: number;
        encryptedInvoices: number;
        totalVolume: string;    // changed to string to match backend
        totalPaidVolume: string; // New field
        isLive: boolean; // Tracking connection status
        volumes: { currency: string; amount: string }[];
    }>({
        totalInvoices: 0,
        totalUsers: 0,
        encryptedInvoices: 0,
        totalVolume: "0",
        totalPaidVolume: "0",
        isLive: false, // Default to not live until connected
        volumes: []
    });

    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Function to establish connection
        const connect = () => {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl = `${protocol}//${window.location.host}/ws`;

            console.debug("Connecting to stats WebSocket:", wsUrl);
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.debug("Stats WebSocket Connected");
                setWsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === "global_stats_update") {
                        setGlobalStats(prev => ({
                            ...prev,
                            ...message.data,
                            isLive: true
                        }));
                    }
                } catch (err) {
                    console.error("Failed to parse WS message:", err);
                }
            };

            ws.onclose = () => {
                console.debug("Stats WebSocket Disconnected");
                setWsConnected(false);
                setGlobalStats(prev => ({ ...prev, isLive: false }));

                // Reconnect after 3 seconds
                setTimeout(connect, 3000);
            };

            ws.onerror = (error) => {
                console.error("WebSocket Error:", error);
                ws.close();
            };

            wsRef.current = ws;
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return {
        globalStats,
        isConnected: wsConnected
    };
}
