import Decimal from 'decimal.js';

// Configure Decimal for financial precision
// Solana uses 9 decimal places for SOL, 6 for USDC. 20 is safe margin.
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MonetaryValue = string | Decimal;

export class Monetary {
    private value: Decimal;

    constructor(value: MonetaryValue) {
        this.value = new Decimal(value);
    }

    static from(value: MonetaryValue): Monetary {
        return new Monetary(value);
    }

    // --- Arithmetic Operations ---

    add(other: MonetaryValue): Monetary {
        return new Monetary(this.value.plus(new Decimal(other)));
    }

    sub(other: MonetaryValue): Monetary {
        return new Monetary(this.value.minus(new Decimal(other)));
    }

    mul(other: MonetaryValue): Monetary {
        return new Monetary(this.value.times(new Decimal(other)));
    }

    div(other: MonetaryValue): Monetary {
        return new Monetary(this.value.dividedBy(new Decimal(other)));
    }

    // --- Comparison Operations ---

    eq(other: MonetaryValue): boolean {
        return this.value.equals(new Decimal(other));
    }

    gt(other: MonetaryValue): boolean {
        return this.value.greaterThan(new Decimal(other));
    }

    gte(other: MonetaryValue): boolean {
        return this.value.greaterThanOrEqualTo(new Decimal(other));
    }

    lt(other: MonetaryValue): boolean {
        return this.value.lessThan(new Decimal(other));
    }

    lte(other: MonetaryValue): boolean {
        return this.value.lessThanOrEqualTo(new Decimal(other));
    }

    // --- Output ---

    toString(): string {
        return this.value.toString();
    }

    toFixed(decimalPlaces: number = 2): string {
        return this.value.toFixed(decimalPlaces);
    }

    toDecimal(): Decimal {
        return this.value;
    }
}

// Helpers for quick usage without class instantiation overhead if preferred
export const safeAdd = (a: MonetaryValue, b: MonetaryValue): string => new Decimal(a).plus(new Decimal(b)).toString();
export const safeSub = (a: MonetaryValue, b: MonetaryValue): string => new Decimal(a).minus(new Decimal(b)).toString();
export const safeMul = (a: MonetaryValue, b: MonetaryValue): string => new Decimal(a).times(new Decimal(b)).toString();
export const safeDiv = (a: MonetaryValue, b: MonetaryValue): string => new Decimal(a).dividedBy(new Decimal(b)).toString();
