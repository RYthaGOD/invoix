/**
 * Currency utilities for display formatting
 */

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
    SOL: "◎",
    USDC: "$",
    USDT: "$",
    PYUSD: "$",
    EURC: "€",
};

/**
 * Get the display symbol for a given currency code
 * @param currency - Currency code (e.g., "SOL", "USDC", "EURC")
 * @returns Symbol string (e.g., "◎", "$", "€")
 */
export function getCurrencySymbol(currency: string): string {
    return CURRENCY_SYMBOLS[currency] || currency + " ";
}

/**
 * Format an amount with the appropriate currency symbol
 * @param amount - Numeric amount to format
 * @param currency - Currency code
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "◎1.50", "$100.00")
 */
export function formatCurrencyAmount(
    amount: number | string,
    currency: string,
    decimals: number = 2
): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${num.toFixed(decimals)}`;
}

/**
 * Check if a currency is a stablecoin (USD-pegged)
 */
export function isStablecoin(currency: string): boolean {
    return ["USDC", "USDT", "PYUSD"].includes(currency);
}

/**
 * Check if a currency needs USD conversion display
 */
export function needsUsdConversion(currency: string): boolean {
    return currency === "SOL";
}
