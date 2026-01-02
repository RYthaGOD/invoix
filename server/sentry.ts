/**
 * Sentry Error Monitoring Configuration
 * 
 * Initialize this FIRST before any other imports in index.ts
 * to capture all errors from the start.
 * 
 * Sentry SDK v8+ uses automatic instrumentation - no manual middleware needed.
 */

import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry() {
    if (!SENTRY_DSN) {
        console.log("[Sentry] No SENTRY_DSN configured - error monitoring disabled");
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        release: process.env.npm_package_version || "1.0.0",

        // Performance Monitoring
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

        // Filter out health check noise
        beforeSend(event) {
            // Don't send errors from health checks
            if (event.request?.url?.includes("/health")) {
                return null;
            }
            return event;
        },

        // Add extra context
        initialScope: {
            tags: {
                component: "server",
            },
        },
    });

    console.log("[Sentry] Error monitoring initialized");
}

/**
 * Setup Express error handler - call AFTER all routes
 * Sentry v8+ uses setupExpressErrorHandler
 */
export function setupSentryErrorHandler(app: any) {
    if (SENTRY_DSN) {
        Sentry.setupExpressErrorHandler(app);
    }
}

/**
 * Dummy request handler - Sentry v8+ handles this automatically via init()
 * Keeping this for backwards compatibility in index.ts
 */
export function sentryRequestHandler() {
    return (_req: any, _res: any, next: any) => next();
}

/**
 * Set user context for better error tracking
 */
export function setSentryUser(walletAddress: string) {
    if (!SENTRY_DSN) return;
    Sentry.setUser({ id: walletAddress });
}

/**
 * Clear user context on logout
 */
export function clearSentryUser() {
    if (!SENTRY_DSN) return;
    Sentry.setUser(null);
}

/**
 * Capture a custom error with context
 */
export function captureError(error: Error, context?: Record<string, any>) {
    if (!SENTRY_DSN) return;
    Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    if (!SENTRY_DSN) return;
    Sentry.captureMessage(message, level);
}

export { Sentry };
