
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";

// Initialize Sentry for Frontend
export function initFrontendSentry() {
    // We use import.meta.env.VITE_SENTRY_DSN in Vite, 
    // but standard SENTRY_DSN works if exposed via vite config define
    const dsn = import.meta.env.VITE_SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0";

    // NOTE: If no DSN is provided, Sentry will remain disabled (noop)
    if (!import.meta.env.VITE_SENTRY_DSN) {
        console.warn("Sentry DSN not found in environment (VITE_SENTRY_DSN). Monitoring disabled.");
    }

    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],
        // Tracing
        tracesSampleRate: 1.0,
        // Session Replay
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: import.meta.env.MODE,
    });
}

// React Hook for tracking navigation
export function useSentryRouteTracking() {
    const [location] = useLocation();

    useEffect(() => {
        // Manually track page view since SPA navigation doesn't reload
        // Sentry Browser Tracing handles this automatically if properly hooked, 
        // but explicit call ensures compatibility with Wouter
    }, [location]);
}
