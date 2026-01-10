export const RiskConfig = {
    // Weights (Total should ideally sum to 100, though logic is additive)
    weights: {
        DAYS_UNTIL_DUE: 30, // Implicit in logic
        SELLER_SCORE: 25,
        CUSTOMER_SCORE: 25,
        INVOICE_SIZE: 10,
        INVOICE_AGE: 10
    },

    // Penalties (Points added to risk score)
    penalties: {
        OVERDUE: 35,
        DUE_SOON: 20, // < 7 days
        DUE_WITHIN_30: 10,

        SELLER_VERY_LOW: 25, // < 450
        SELLER_LOW: 20, // < 550
        SELLER_MEDIUM: 10, // < 650
        SELLER_GOOD: 5, // < 750

        CUSTOMER_VERY_LOW: 25,
        CUSTOMER_LOW: 20,
        CUSTOMER_MEDIUM: 10,
        CUSTOMER_GOOD: 5,

        LARGE_INVOICE: 10, // > 100k
        MEDIUM_INVOICE: 5, // > 10k

        OLD_INVOICE_90: 10, // > 90 days since issued
        OLD_INVOICE_60: 5  // > 60 days since issued
    },

    // Thresholds
    thresholds: {
        SELLER_V_LOW: 450,
        SELLER_LOW: 550,
        SELLER_MED: 650,
        SELLER_GOOD: 750,

        LARGE_AMOUNT: 100000,
        MEDIUM_AMOUNT: 10000
    }
};

export interface RiskAssessment {
    score: number;
    level: 'low' | 'medium' | 'high' | 'very_high';
    flags: string[];
}
