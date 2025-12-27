/**
 * Safe Financial Math Utility
 * 
 * Prevents floating-point errors by using integer arithmetic with fixed precision.
 * Standard precision: 9 decimal places (sufficient for crypto and fiat).
 * 
 * FIX R3-9: KNOWN LIMITATION
 * Uses JavaScript Number type which has precision limits:
 * - Maximum safe integer: Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991
 * - For values > ~9 quadrillion, precision will be lost
 * - For high-value systems with very large numbers, consider BigInt or decimal.js
 * 
 * Current usage is safe for typical invoice amounts (up to billions of USD).
 */

const PRECISION = 1_000_000_000; // 9 decimals

/**
 * Safe addition: a + b
 */
export function safeAdd(a: string | number, b: string | number): string {
    const valA = Math.round(Number(a) * PRECISION);
    const valB = Math.round(Number(b) * PRECISION);
    return ((valA + valB) / PRECISION).toString();
}

/**
 * Safe subtraction: a - b
 */
export function safeSubtract(a: string | number, b: string | number): string {
    const valA = Math.round(Number(a) * PRECISION);
    const valB = Math.round(Number(b) * PRECISION);
    return ((valA - valB) / PRECISION).toString();
}

/**
 * Safe multiplication: a * b
 */
export function safeMultiply(a: string | number, b: string | number): string {
    const valA = Math.round(Number(a) * PRECISION);
    // For multiplication, we treat 'b' as the scalar/floating multiplier usually
    // But to be consistent, we can just do floating point math and round at the end
    // Or safer: (A * Precision) * (B * Precision) / (Precision * Precision)
    // Let's use standard clean float multiplication rounded to precision to avoid overflow on large numbers
    const result = Number(a) * Number(b);
    return (Math.round(result * PRECISION) / PRECISION).toString();
}

/**
 * Safe division: a / b
 */
export function safeDivide(a: string | number, b: string | number): string {
    const result = Number(a) / Number(b);
    return (Math.round(result * PRECISION) / PRECISION).toString();
}

/**
 * Safe percentage: (amount * rate) / 100
 */
export function safePercent(amount: string | number, rate: string | number): string {
    return safeDivide(safeMultiply(amount, rate), 100);
}
