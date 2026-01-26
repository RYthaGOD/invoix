/**
 * Application Constants
 * 
 * Centralized configuration values for consistency and easy maintenance
 */

// ========================================
// MARKETPLACE CONSTANTS
// ========================================

export const MARKETPLACE_YIELD_THRESHOLDS = {
    EXCELLENT: 15,  // >= 15% yield (emerald/green)
    GOOD: 10,       // >= 10% yield (blue)
    MODERATE: 5,    // >= 5% yield (yellow)
    LOW: 0          // < 5% yield (gray)
} as const;

export const MARKETPLACE_URGENCY_THRESHOLDS = {
    URGENT_DAYS: 7,     // <= 7 days until due is urgent
    WARNING_DAYS: 14,   // <= 14 days is warning
} as const;

export const MARKETPLACE_PAGINATION = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
    LOAD_MORE_THRESHOLD: 20,
} as const;

// ========================================
// RISK SCORING CONSTANTS
// ========================================

export const RISK_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'very_high'
} as const;

export const RISK_SCORE_RANGES = {
    LOW: { min: 0, max: 29 },
    MEDIUM: { min: 30, max: 59 },
    HIGH: { min: 60, max: 79 },
    VERY_HIGH: { min: 80, max: 100 },
} as const;

// ========================================
// CREDIT SCORE CONSTANTS
// ========================================

export const CREDIT_TIERS = {
    PRIME: 'prime',
    STANDARD: 'standard',
    FAIR: 'fair',
    DEVELOPING: 'developing',
    NEW: 'new'
} as const;

export const CREDIT_SCORE_RANGES = {
    PRIME: { min: 750, max: 850 },
    STANDARD: { min: 650, max: 749 },
    FAIR: { min: 550, max: 649 },
    DEVELOPING: { min: 300, max: 549 },
    NEW: { min: 0, max: 299 },
} as const;

// ========================================
// PAYMENT CONSTANTS
// ========================================

export const PAYMENT_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    FAILED: 'failed'
} as const;

export const INVOICE_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
} as const;

// ========================================
// TIME CONSTANTS
// ========================================

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

export const CACHE_TTL = {
    SHORT: 30 * TIME.SECOND,    // 30 seconds
    MEDIUM: 5 * TIME.MINUTE,    // 5 minutes
    LONG: 30 * TIME.MINUTE,     // 30 minutes
    VERY_LONG: 2 * TIME.HOUR,   // 2 hours
} as const;

export const SESSION_DURATION = {
    DEFAULT: 24 * TIME.HOUR,     // 24 hours
    REMEMBER_ME: 30 * TIME.DAY,  // 30 days
} as const;

// ========================================
// RATE LIMITING CONSTANTS
// ========================================

export const RATE_LIMITS = {
    GLOBAL: {
        WINDOW_MS: 15 * TIME.MINUTE,
        MAX_REQUESTS: 1000,
    },
    API: {
        WINDOW_MS: 15 * TIME.MINUTE,
        MAX_REQUESTS: 100,
    },
    AUTH: {
        WINDOW_MS: 60 * TIME.MINUTE,
        MAX_REQUESTS: 20,
    },
    STRICT: {
        WINDOW_MS: 15 * TIME.MINUTE,
        MAX_REQUESTS: 10,
    },
} as const;

// ========================================
// SOLANA CONSTANTS
// ========================================

export const SOLANA_ADDRESS_LENGTH = {
    MIN: 32,
    MAX: 44
} as const;

export const SOLANA_SIGNATURE_LENGTH = {
    MIN: 87,
    MAX: 88
} as const;

export const CONFIRMATION_TIMEOUT = {
    DEFAULT: 60 * TIME.SECOND,
    FAST: 30 * TIME.SECOND,
} as const;

// ========================================
// VALIDATION CONSTANTS
// ========================================

export const VALIDATION = {
    INVOICE_NUMBER_MAX_LENGTH: 50,
    DESCRIPTION_MAX_LENGTH: 500,
    LINE_ITEM_MAX_LENGTH: 200,
    MAX_LINE_ITEMS: 100,
    MIN_AMOUNT: 0.01,
    MAX_AMOUNT: 1000000000,
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 30,
} as const;

// ========================================
// API CONSTANTS
// ========================================

export const API_RESPONSE_CODES = {
    SUCCESS: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const;

export const REQUEST_SIZE_LIMITS = {
    JSON: '1mb',
    UPLOAD: '10mb',
} as const;

// ========================================
// UI CONSTANTS
// ========================================

export const ANIMATION_DURATION = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
} as const;

export const DEBOUNCE_DELAY = {
    SEARCH: 300,
    AUTOSAVE: 1000,
    RESIZE: 150,
} as const;

export const TOAST_DURATION = {
    SHORT: 3 * TIME.SECOND,
    MEDIUM: 5 * TIME.SECOND,
    LONG: 10 * TIME.SECOND,
} as const;

// ========================================
// FEATURE FLAGS
// ========================================

// Feature flags - some read from environment variables for runtime configuration
const getArciumMxeEnabled = (): boolean => {
    // In Node.js environment, check process.env
    if (typeof process !== 'undefined' && process.env) {
        return process.env.ENABLE_ARCIUM_ENCRYPTION === 'true';
    }
    // In browser environment, check for Vite env vars
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        return (import.meta as any).env.VITE_ENABLE_ARCIUM_ENCRYPTION === 'true';
    }
    return false;
};

export const FEATURES = {
    ENABLE_MARKETPLACE: true,
    ENABLE_ARCIUM_MXE: getArciumMxeEnabled(),  // Synced with ENABLE_ARCIUM_ENCRYPTION env var
    ENABLE_SUBSCRIPTIONS: true,
    ENABLE_WEBHOOKS: true,
    ENABLE_EMAIL_NOTIFICATIONS: false,  // Mock mode
    ENABLE_REAL_TIME_UPDATES: false,
} as const;

// ========================================
// CURRENCY CONSTANTS
// ========================================

export const SUPPORTED_CURRENCIES = [
    'USDC',
    'USDT',
    'SOL',
    'EURC',
] as const;

export const DEFAULT_CURRENCY = 'USDC' as const;

export const CURRENCY_DECIMALS = {
    USDC: 6,
    USDT: 6,
    SOL: 9,
    EURC: 6,
} as const;

// ========================================
// TYPE EXPORTS
// ========================================

export type RiskLevel = typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
export type CreditTier = typeof CREDIT_TIERS[keyof typeof CREDIT_TIERS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];
