/**
 * Tax Data Export Service
 * 
 * Aggregates payment data for tax reporting purposes.
 * Users can export annual summaries, CSV, and PDF reports to file their own taxes.
 * 
 * NOTE: Invoix does NOT file tax forms on behalf of users.
 * This service only provides data export for self-filing.
 */

import { db, schema } from "./db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { safeAdd } from "@shared/math";
import { logger } from "./logger";

export interface TaxSummary {
    taxYear: number;
    walletAddress: string;
    summary: {
        totalReceived: string;
        totalSent: string;
        netIncome: string;
        transactionCount: number;
        platformFeesPaid: string;
        currency: string;
    };
    monthlyBreakdown: MonthlyTaxData[];
    byCustomer: CustomerTaxData[];
    byVendor: VendorTaxData[];
}

export interface MonthlyTaxData {
    month: string;
    monthNumber: number;
    received: string;
    sent: string;
    invoiceCount: number;
    paymentCount: number;
}

export interface CustomerTaxData {
    customerWallet: string;
    customerName?: string;
    totalAmount: string;
    invoiceCount: number;
    paidInvoices: number;
}

export interface VendorTaxData {
    vendorWallet: string;
    vendorName?: string;
    totalAmount: string;
    invoiceCount: number;
    paidAmount: string;
}

export interface TransactionExport {
    date: string;
    type: 'income' | 'expense';
    invoiceNumber: string;
    counterparty: string;
    description: string;
    amount: string;
    currency: string;
    status: string;
    paymentDate?: string;
    paymentMethod?: string;
}

/**
 * Get comprehensive annual tax summary for a wallet
 */
export async function getAnnualTaxSummary(
    walletAddress: string,
    taxYear: number
): Promise<TaxSummary> {
    logger.info(`Generating tax summary for ${walletAddress.slice(0, 8)}... year ${taxYear}`, "tax");

    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear, 11, 31, 23, 59, 59);

    // Get all invoices where user is invoicer (income)
    const receivedInvoices = await db.query.invoices.findMany({
        where: and(
            eq(schema.invoices.invoicerWalletAddress, walletAddress),
            gte(schema.invoices.createdAt, yearStart),
            lte(schema.invoices.createdAt, yearEnd)
        ),
        orderBy: [desc(schema.invoices.createdAt)]
    });

    // Get all invoices where user is invoicee (expenses)
    const sentInvoices = await db.query.invoices.findMany({
        where: and(
            eq(schema.invoices.invoiceeWalletAddress, walletAddress),
            gte(schema.invoices.createdAt, yearStart),
            lte(schema.invoices.createdAt, yearEnd)
        ),
        orderBy: [desc(schema.invoices.createdAt)]
    });

    // Calculate totals
    let totalReceived = "0";
    let platformFeesPaid = "0";
    receivedInvoices.forEach(inv => {
        totalReceived = safeAdd(totalReceived, inv.paidAmount);
        platformFeesPaid = safeAdd(platformFeesPaid, inv.platformFee || "0");
    });

    let totalSent = "0";
    sentInvoices.forEach(inv => {
        totalSent = safeAdd(totalSent, inv.paidAmount);
    });

    // Monthly breakdown
    const monthlyBreakdown = calculateMonthlyBreakdown(
        receivedInvoices,
        sentInvoices,
        taxYear
    );

    // Group by customer
    const byCustomer = groupByCustomer(receivedInvoices);

    // Group by vendor
    const byVendor = groupByVendor(sentInvoices);

    return {
        taxYear,
        walletAddress,
        summary: {
            totalReceived,
            totalSent,
            netIncome: safeAdd(totalReceived, `-${totalSent}`),
            transactionCount: receivedInvoices.length + sentInvoices.length,
            platformFeesPaid,
            currency: "USD" // TODO: Multi-currency support
        },
        monthlyBreakdown,
        byCustomer,
        byVendor
    };
}

/**
 * Calculate monthly breakdown for the year
 */
function calculateMonthlyBreakdown(
    receivedInvoices: any[],
    sentInvoices: any[],
    taxYear: number
): MonthlyTaxData[] {
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const breakdown: MonthlyTaxData[] = [];

    for (let month = 0; month < 12; month++) {
        const received = receivedInvoices
            .filter(inv => new Date(inv.createdAt).getMonth() === month)
            .reduce((sum, inv) => safeAdd(sum, inv.paidAmount), "0");

        const sent = sentInvoices
            .filter(inv => new Date(inv.createdAt).getMonth() === month)
            .reduce((sum, inv) => safeAdd(sum, inv.paidAmount), "0");

        const receivedCount = receivedInvoices.filter(
            inv => new Date(inv.createdAt).getMonth() === month
        ).length;

        const sentCount = sentInvoices.filter(
            inv => new Date(inv.createdAt).getMonth() === month
        ).length;

        breakdown.push({
            month: monthNames[month],
            monthNumber: month + 1,
            received,
            sent,
            invoiceCount: receivedCount + sentCount,
            paymentCount: receivedCount + sentCount // Simplified
        });
    }

    return breakdown;
}

/**
 * Group received invoices by customer
 */
function groupByCustomer(invoices: any[]): CustomerTaxData[] {
    const customerMap = new Map<string, CustomerTaxData>();

    invoices.forEach(inv => {
        const existing = customerMap.get(inv.invoiceeWalletAddress);
        if (existing) {
            existing.totalAmount = safeAdd(existing.totalAmount, inv.totalAmount);
            existing.invoiceCount++;
            if (inv.status === 'paid') existing.paidInvoices++;
        } else {
            customerMap.set(inv.invoiceeWalletAddress, {
                customerWallet: inv.invoiceeWalletAddress,
                totalAmount: inv.totalAmount,
                invoiceCount: 1,
                paidInvoices: inv.status === 'paid' ? 1 : 0
            });
        }
    });

    return Array.from(customerMap.values())
        .sort((a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount));
}

/**
 * Group sent invoices by vendor
 */
function groupByVendor(invoices: any[]): VendorTaxData[] {
    const vendorMap = new Map<string, VendorTaxData>();

    invoices.forEach(inv => {
        const existing = vendorMap.get(inv.invoicerWalletAddress);
        if (existing) {
            existing.totalAmount = safeAdd(existing.totalAmount, inv.totalAmount);
            existing.paidAmount = safeAdd(existing.paidAmount, inv.paidAmount);
            existing.invoiceCount++;
        } else {
            vendorMap.set(inv.invoicerWalletAddress, {
                vendorWallet: inv.invoicerWalletAddress,
                totalAmount: inv.totalAmount,
                paidAmount: inv.paidAmount,
                invoiceCount: 1
            });
        }
    });

    return Array.from(vendorMap.values())
        .sort((a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount));
}

/**
 * Get detailed transaction list for CSV export
 */
export async function getTransactionExport(
    walletAddress: string,
    taxYear: number
): Promise<TransactionExport[]> {
    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear, 11, 31, 23, 59, 59);

    const receivedInvoices = await db.query.invoices.findMany({
        where: and(
            eq(schema.invoices.invoicerWalletAddress, walletAddress),
            gte(schema.invoices.createdAt, yearStart),
            lte(schema.invoices.createdAt, yearEnd)
        ),
        orderBy: [desc(schema.invoices.createdAt)]
    });

    const sentInvoices = await db.query.invoices.findMany({
        where: and(
            eq(schema.invoices.invoiceeWalletAddress, walletAddress),
            gte(schema.invoices.createdAt, yearStart),
            lte(schema.invoices.createdAt, yearEnd)
        ),
        orderBy: [desc(schema.invoices.createdAt)]
    });

    const transactions: TransactionExport[] = [];

    // Add income transactions
    receivedInvoices.forEach(inv => {
        transactions.push({
            date: new Date(inv.createdAt).toISOString().split('T')[0],
            type: 'income',
            invoiceNumber: inv.invoiceNumber,
            counterparty: inv.invoiceeWalletAddress,
            description: inv.description || "Invoice payment",
            amount: inv.paidAmount,
            currency: inv.currency,
            status: inv.status,
            paymentDate: inv.paidAt ? new Date(inv.paidAt).toISOString().split('T')[0] : undefined,
            paymentMethod: "Solana"
        });
    });

    // Add expense transactions
    sentInvoices.forEach(inv => {
        transactions.push({
            date: new Date(inv.createdAt).toISOString().split('T')[0],
            type: 'expense',
            invoiceNumber: inv.invoiceNumber,
            counterparty: inv.invoicerWalletAddress,
            description: inv.description || "Invoice payment",
            amount: inv.paidAmount,
            currency: inv.currency,
            status: inv.status,
            paymentDate: inv.paidAt ? new Date(inv.paidAt).toISOString().split('T')[0] : undefined,
            paymentMethod: "Solana"
        });
    });

    // Sort by date descending
    return transactions.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}
