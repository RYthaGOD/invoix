import { RiskConfig, RiskAssessment } from "./config";
export type { RiskAssessment };

export function calculateRiskScore(
    invoice: any,
    sellerScore: number | null,
    customerScore: number | null
): RiskAssessment {
    const flags: string[] = [];
    let riskScore = 0;
    const { penalties, thresholds } = RiskConfig;

    // 1. Days until due
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
        riskScore += penalties.OVERDUE;
        flags.push('OVERDUE');
    } else if (daysUntilDue < 7) {
        riskScore += penalties.DUE_SOON;
        flags.push('DUE_SOON');
    } else if (daysUntilDue < 30) {
        riskScore += penalties.DUE_WITHIN_30;
    }
    // Longer due dates = lower risk (up to 5 points reduction)
    else {
        riskScore += Math.max(0, 10 - Math.floor(daysUntilDue / 30) * 2);
    }

    // 2. Seller credit score
    if (!sellerScore || sellerScore < thresholds.SELLER_V_LOW) {
        riskScore += penalties.SELLER_VERY_LOW;
        flags.push('LOW_SELLER_SCORE');
    } else if (sellerScore < thresholds.SELLER_LOW) {
        riskScore += penalties.SELLER_LOW;
    } else if (sellerScore < thresholds.SELLER_MED) {
        riskScore += penalties.SELLER_MEDIUM;
    } else if (sellerScore < thresholds.SELLER_GOOD) {
        riskScore += penalties.SELLER_GOOD;
    }

    // 3. Customer credit score
    if (!customerScore || customerScore < thresholds.SELLER_V_LOW) {
        riskScore += penalties.CUSTOMER_VERY_LOW;
        flags.push('LOW_CUSTOMER_SCORE');
    } else if (customerScore < thresholds.SELLER_LOW) {
        riskScore += penalties.CUSTOMER_LOW;
        flags.push('UNKNOWN_CUSTOMER'); // Or 'LOW_CUSTOMER_SCORE' depending on interpretation of 'unknown'
    } else if (customerScore < thresholds.SELLER_MED) {
        riskScore += penalties.CUSTOMER_MEDIUM;
    } else if (customerScore < thresholds.SELLER_GOOD) {
        riskScore += penalties.CUSTOMER_GOOD;
    }

    // 4. Invoice size
    const amount = parseFloat(invoice.totalAmount);
    if (amount > thresholds.LARGE_AMOUNT) {
        riskScore += penalties.LARGE_INVOICE;
        flags.push('LARGE_INVOICE');
    } else if (amount > thresholds.MEDIUM_AMOUNT) {
        riskScore += penalties.MEDIUM_INVOICE;
    }

    // 5. Invoice age
    const invoiceDate = new Date(invoice.invoiceDate);
    const daysSinceIssued = Math.ceil((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceIssued > 90) {
        riskScore += penalties.OLD_INVOICE_90;
        flags.push('OLD_INVOICE');
    } else if (daysSinceIssued > 60) {
        riskScore += penalties.OLD_INVOICE_60;
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'very_high';
    if (riskScore <= 25) level = 'low';
    else if (riskScore <= 50) level = 'medium';
    else if (riskScore <= 75) level = 'high';
    else level = 'very_high';

    return {
        score: Math.min(100, riskScore),
        level,
        flags,
    };
}
