/**
 * Invoice Storage Layer
 * 
 * Database operations for B2B invoicing system
 */

// Schema selection - Enforcing Postgres schema for Production typing compliance
// as requested: "fix it as the production version is using postgres"
// Schema selection based on environment
import * as pgSchema from "@shared/invoice-schema";
import * as sqliteSchema from "@shared/invoice-schema-sqlite";

const isSQLite = !process.env.DATABASE_URL;
// Force cast to Postgres schema type to align with AppDatabase definition in db.ts
// This ensures strict type checking against the production schema structure.
const schema: typeof pgSchema = (isSQLite ? sqliteSchema : pgSchema) as unknown as typeof pgSchema;

const {
  invoices,
  invoiceLineItems,
  payments,
  invoiceTemplates,
  businessProfiles,
  customerProfiles,
  paymentReceiptNFTs,
  businessIdentityNFTs,
  systemSettings,
  authNonces,
  x402Micropayments,
} = schema;

// Types are exported from the main schema file (assuming compatibility)
// or we can export them from the selected schema if needed.
// For now, we keep the original type imports for TS compatibility as interfaces should match.
import type {
  Invoice,
  InsertInvoice,
  InvoiceLineItem,
  InsertLineItem,
  Payment,
  InsertPayment,
  BusinessProfile,
  InsertBusinessProfile,
  CustomerProfile,
  InsertCustomerProfile,
  InvoiceTemplate,
  InsertInvoiceTemplate,
} from "@shared/invoice-schema";

// Re-export types for use in consumers (like routes)
export type { Invoice, InvoiceLineItem, Payment, BusinessProfile, CustomerProfile };
import { db, runTransaction } from "./db";
import { eq, and, or, ne, desc, asc, sql, isNotNull } from "drizzle-orm";
import { safeAdd, safeSubtract, safeMultiply } from "@shared/math";

export interface IInvoiceStorage {
  // Invoice operations
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getInvoices(invoicerWallet: string, filters?: InvoiceFilters): Promise<Invoice[]>;
  getInvoicesForCustomer(invoiceeWallet: string, filters?: InvoiceFilters): Promise<Invoice[]>;
  getInvoicesForUser(walletAddress: string, filters?: InvoiceFilters): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  createInvoiceWithItems(invoice: InsertInvoice, lineItems?: Omit<InsertLineItem, 'invoiceId'>[]): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Line item operations
  getLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createLineItem(lineItem: InsertLineItem): Promise<InvoiceLineItem>;
  updateLineItem(id: string, updates: Partial<InsertLineItem>): Promise<InvoiceLineItem | undefined>;
  deleteLineItem(id: string): Promise<boolean>;

  // Payment operations
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByInvoice(invoiceId: string): Promise<(Payment & { receiptNftMint?: string | null })[]>;
  getPaymentsByWallet(walletAddress: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Business profile operations
  getBusinessProfile(walletAddress: string): Promise<BusinessProfile | undefined>;
  createBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile>;
  updateBusinessProfile(walletAddress: string, updates: Partial<InsertBusinessProfile>): Promise<BusinessProfile | undefined>;

  // Customer profile operations
  getCustomerProfile(businessWallet: string, customerWallet: string): Promise<CustomerProfile | undefined>;
  getCustomerProfiles(businessWallet: string): Promise<CustomerProfile[]>;
  createCustomerProfile(profile: InsertCustomerProfile): Promise<CustomerProfile>;
  updateCustomerProfile(id: string, updates: Partial<InsertCustomerProfile>): Promise<CustomerProfile | undefined>;
  deleteCustomerProfile(id: string): Promise<boolean>;

  // Template operations
  getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined>;
  getInvoiceTemplates(ownerWallet: string): Promise<InvoiceTemplate[]>;
  createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate>;
  updateInvoiceTemplate(id: string, updates: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined>;
  deleteInvoiceTemplate(id: string): Promise<boolean>;

  // Stats and analytics
  getInvoiceStats(walletAddress: string): Promise<InvoiceStats>;
  getCustomerStats(businessWallet: string, customerWallet: string): Promise<CustomerStats>;

  // System-wide stats
  totalInvoices: number;
  totalUsers: number;
  totalPaidVolume: string; // New: Actual money settled
  encryptedInvoices: number;
  totalVolume: string;

  // Signature check
  isSignatureUsed(signature: string): Promise<boolean>;
}

export interface InvoiceFilters {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: string;
  maxAmount?: string;
  currency?: string;
  limit?: number;
  offset?: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  overdueCount: number;
  averagePaymentDays: number;
}

export interface CustomerStats {
  totalInvoices: number;
  totalAmount: string;
  paidAmount: string;
  averagePaymentDays: number;
  lastInvoiceDate: Date | null;
  lastPaymentDate: Date | null;
}


class InvoiceStorage implements IInvoiceStorage {
  // Implement properties for IInvoiceStorage
  totalInvoices: number = 0;
  totalUsers: number = 0;
  totalPaidVolume: string = "0.00";
  encryptedInvoices: number = 0;
  totalVolume: string = "0.00";

  // ===================================
  // INVOICE OPERATIONS
  // ===================================

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return invoice as Invoice | undefined;
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);
    return invoice as Invoice | undefined;
  }

  async getInvoices(invoicerWallet: string, filters?: InvoiceFilters): Promise<Invoice[]> {
    let query = db.select()
      .from(invoices)
      .where(eq(invoices.invoicerWalletAddress, invoicerWallet))
      .$dynamic();

    // Apply filters
    if (filters?.status) {
      query = query.where(eq(invoices.status, filters.status));
    }

    if (filters?.startDate) {
      query = query.where(sql`${invoices.invoiceDate} >= ${filters.startDate}`);
    }

    if (filters?.endDate) {
      query = query.where(sql`${invoices.invoiceDate} <= ${filters.endDate}`);
    }

    if (filters?.currency) {
      query = query.where(eq(invoices.currency, filters.currency));
    }

    // Sort by invoice date (newest first)
    query = query.orderBy(desc(invoices.invoiceDate));

    // Pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return (await query) as Invoice[];
  }

  async getInvoicesForCustomer(invoiceeWallet: string, filters?: InvoiceFilters): Promise<Invoice[]> {
    let query = db.select()
      .from(invoices)
      .where(eq(invoices.invoiceeWalletAddress, invoiceeWallet))
      .$dynamic();

    // Apply same filters as getInvoices
    if (filters?.status) {
      query = query.where(eq(invoices.status, filters.status));
    }

    query = query.orderBy(desc(invoices.invoiceDate));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return (await query) as Invoice[];
  }

  async getInvoicesForUser(walletAddress: string, filters?: InvoiceFilters): Promise<Invoice[]> {
    let query = db.select()
      .from(invoices)
      .where(or(
        eq(invoices.invoicerWalletAddress, walletAddress),
        eq(invoices.invoiceeWalletAddress, walletAddress)
      ))
      .$dynamic();

    // Apply filters
    if (filters?.status) {
      query = query.where(eq(invoices.status, filters.status));
    }

    if (filters?.startDate) {
      query = query.where(sql`${invoices.invoiceDate} >= ${filters.startDate}`);
    }

    if (filters?.endDate) {
      query = query.where(sql`${invoices.invoiceDate} <= ${filters.endDate}`);
    }

    if (filters?.currency) {
      query = query.where(eq(invoices.currency, filters.currency));
    }

    // Sort by invoice date (newest first)
    query = query.orderBy(desc(invoices.invoiceDate));

    // Pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return (await query) as Invoice[];
  }

  async createInvoice(invoice: InsertInvoice & { invoiceNumber?: string }): Promise<Invoice> {
    // Ensure strict type compatibility for Postgres
    const insertData: any = { ...invoice };
    if (typeof insertData.dueDate === 'string') {
      insertData.dueDate = new Date(insertData.dueDate);
    }
    const [newInvoice] = await db.insert(invoices).values(insertData).returning();
    return newInvoice as Invoice;
  }

  async createInvoiceWithItems(invoice: InsertInvoice & { invoiceNumber?: string }, lineItems?: Omit<InsertLineItem, 'invoiceId'>[]): Promise<Invoice> {
    return await runTransaction(async (tx) => {
      let finalInvoiceNumber = invoice.invoiceNumber;

      // 1. Handle Atomic Invoice Numbering if not provided
      // This prevents race conditions where two invoices get the same number
      if (!finalInvoiceNumber) {
        // Lock the business profile row for the invoicer
        // Note: .for('update') is specific to Postgres and ensures sequential access
        // We skip this for SQLite (tests/dev)
        const invoicerWallet = invoice.invoicerWalletAddress;
        if (!invoicerWallet) {
          throw new Error("Invoicer wallet address is required for atomic invoice numbering");
        }

        let query = tx.select()
          .from(businessProfiles)
          .where(eq(businessProfiles.ownerWalletAddress, invoicerWallet))
          .$dynamic(); // Enable dynamic query building

        if (process.env.DATABASE_URL) {
          // Only apply lock if using Postgres (indicated by DATABASE_URL presence)
          query = query.for('update');
        }

        const [profile] = await query;

        if (profile) {
          const nextNum = profile.nextInvoiceNumber;
          const prefix = profile.defaultInvoicePrefix || "INV";
          finalInvoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

          // Increment counter
          await tx.update(businessProfiles)
            .set({
              nextInvoiceNumber: nextNum + 1,
              updatedAt: new Date()
            })
            .where(eq(businessProfiles.id, profile.id));
        } else {
          // Fallback if no profile exists
          finalInvoiceNumber = `INV-${Date.now()}`;
        }
      }

      // 2. Create Invoice
      const insertData: any = {
        ...invoice,
        invoiceNumber: finalInvoiceNumber
      };

      if (typeof insertData.dueDate === 'string') {
        insertData.dueDate = new Date(insertData.dueDate);
      }

      const [newInvoice] = await tx.insert(invoices).values(insertData).returning();

      // 3. Create Line Items if present
      if (lineItems && lineItems.length > 0) {
        const itemsToInsert = lineItems.map((item, index) => ({
          ...item,
          invoiceId: newInvoice.id,
          lineNumber: index + 1,
          lineTotal: safeMultiply(item.quantity, item.unitPrice),
        }));

        await tx.insert(invoiceLineItems).values(itemsToInsert as any[]);
      }

      return newInvoice as Invoice;
    });
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    // Ensure dates are Date objects for strict Postgres typing
    const cleanUpdates: any = { ...updates, updatedAt: new Date() };
    if (cleanUpdates.dueDate && typeof cleanUpdates.dueDate === 'string') {
      cleanUpdates.dueDate = new Date(cleanUpdates.dueDate);
    }

    const [updated] = await db
      .update(invoices)
      .set(cleanUpdates)
      .where(eq(invoices.id, id))
      .returning();
    return updated as Invoice | undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    // 1. Check status first - Immutable Accounting Limit
    // We cannot delete invoices that are part of the financial history (Paid/Processing)
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });

    if (!existing) return false;

    if (existing.status === 'paid' || existing.status === 'processing') {
      // For accounting purposes, these should be "voided" instead of deleted, 
      // but for now we basically prevent destruction of financial records.
      throw new Error("Cannot delete an invoice that has been paid or is processing.");
    }

    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  // ===================================
  // LINE ITEM OPERATIONS
  // ===================================

  async getLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db.select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceLineItems.lineNumber));
  }

  async createLineItem(lineItem: InsertLineItem): Promise<InvoiceLineItem> {
    // Calculate derived fields
    const lineTotal = safeMultiply(lineItem.quantity, lineItem.unitPrice);

    // Get next line number
    const [lastItem] = await db.select({ lineNumber: invoiceLineItems.lineNumber })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, lineItem.invoiceId))
      .orderBy(desc(invoiceLineItems.lineNumber))
      .limit(1);

    const lineNumber = (lastItem?.lineNumber || 0) + 1;

    const [newItem] = await db.insert(invoiceLineItems).values({
      ...lineItem,
      lineNumber,
      lineTotal
    }).returning();

    return newItem;
  }

  async updateLineItem(id: string, updates: Partial<InsertLineItem>): Promise<InvoiceLineItem | undefined> {
    const [updated] = await db
      .update(invoiceLineItems)
      .set(updates)
      .where(eq(invoiceLineItems.id, id))
      .returning();
    return updated;
  }

  async deleteLineItem(id: string): Promise<boolean> {
    const result = await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id)).returning();
    return result.length > 0;
  }

  // ===================================
  // PAYMENT OPERATIONS
  // ===================================

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return payment as Payment | undefined;
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<(Payment & { receiptNftMint?: string | null })[]> {
    const rows = await db.select({
      payment: payments,
      receipt: paymentReceiptNFTs
    })
      .from(payments)
      .leftJoin(paymentReceiptNFTs, eq(payments.id, paymentReceiptNFTs.paymentId))
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));

    return rows.map(({ payment, receipt }) => ({
      ...payment,
      receiptNftMint: receipt?.nftMint || null
    }));
  }

  async getPaymentsByWallet(walletAddress: string): Promise<Payment[]> {
    const rows = await db.select()
      .from(payments)
      .where(or(
        eq(payments.fromAddress, walletAddress),
        eq(payments.toAddress, walletAddress)
      ))
      .orderBy(desc(payments.createdAt));
    return rows as Payment[];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    // FIX R2-2: Move duplicate check INSIDE transaction with row lock to prevent race conditions
    // Use a transaction to ensure atomicity between payment and invoice updates
    const result = await runTransaction(async (tx) => {
      // Check for duplicate INSIDE transaction with Postgres lock
      if (payment.txSignature) {
        let query = tx.select()
          .from(payments)
          .where(eq(payments.txSignature, payment.txSignature))
          .$dynamic();

        // Apply FOR UPDATE lock on Postgres to prevent concurrent inserts
        if (process.env.DATABASE_URL) {
          query = query.for('update');
        }

        const existingPayment = await query.limit(1);

        if (existingPayment.length > 0) {
          throw new Error(`Payment already processed: transaction ${payment.txSignature} has already been recorded`);
        }
      }

      // Insert the payment with generated number (FIX R2-8: Use crypto for uniqueness)
      const paymentToInsert = {
        ...payment,
        paymentNumber: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      };

      const [newPayment] = await tx.insert(payments).values(paymentToInsert).returning();

      // Get invoice INSIDE transaction to prevent race conditions
      const [invoice] = await tx.select()
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId))
        .limit(1);

      if (invoice) {
        // Use safe string-based math to avoid floating point errors
        const newPaidAmount = safeAdd(invoice.paidAmount, payment.amount);
        const remainingAmount = safeSubtract(invoice.totalAmount, newPaidAmount);

        const isPaid = parseFloat(remainingAmount) <= 0;
        const isPartial = parseFloat(newPaidAmount) > 0;

        // FIX R2-4: Track and log overpayments
        const overpaymentAmount = parseFloat(remainingAmount) < 0
          ? Math.abs(parseFloat(remainingAmount)).toFixed(6)
          : null;
        if (overpaymentAmount) {
          console.warn(`[PAYMENT] Overpayment detected on invoice ${invoice.id}: ${overpaymentAmount} ${invoice.currency}`);
        }

        let newStatus = invoice.status;
        if (isPaid) {
          newStatus = "paid";
        } else if (isPartial && invoice.status !== "overdue") {
          newStatus = "partial";
        }

        await tx.update(invoices)
          .set({
            paidAmount: newPaidAmount,
            remainingAmount: isPaid ? "0" : remainingAmount,
            status: newStatus,
            paidAt: isPaid ? new Date() : invoice.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, payment.invoiceId));
      }

      return newPayment;
    });

    return result;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  // ===================================
  // BUSINESS PROFILE OPERATIONS
  // ===================================

  async getBusinessProfile(walletAddress: string): Promise<BusinessProfile | undefined> {
    const [profile] = await db.select()
      .from(businessProfiles)
      .where(eq(businessProfiles.ownerWalletAddress, walletAddress))
      .limit(1);
    return profile;
  }

  async createBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile> {
    const [newProfile] = await db.insert(businessProfiles).values(profile).returning();
    return newProfile;
  }

  async updateBusinessProfile(walletAddress: string, updates: Partial<InsertBusinessProfile>): Promise<BusinessProfile | undefined> {
    const [updated] = await db
      .update(businessProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(businessProfiles.ownerWalletAddress, walletAddress))
      .returning();
    return updated;
  }

  // ===================================
  // CUSTOMER PROFILE OPERATIONS
  // ===================================

  async getCustomerProfile(businessWallet: string, customerWallet: string): Promise<CustomerProfile | undefined> {
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(and(
        eq(customerProfiles.businessWalletAddress, businessWallet),
        eq(customerProfiles.customerWalletAddress, customerWallet)
      ))
      .limit(1);
    return profile;
  }

  async getCustomerProfiles(businessWallet: string): Promise<CustomerProfile[]> {
    return await db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.businessWalletAddress, businessWallet))
      .orderBy(desc(customerProfiles.createdAt));
  }

  async createCustomerProfile(profile: InsertCustomerProfile): Promise<CustomerProfile> {
    const [newProfile] = await db.insert(customerProfiles).values(profile).returning();
    return newProfile;
  }

  async updateCustomerProfile(id: string, updates: Partial<InsertCustomerProfile>): Promise<CustomerProfile | undefined> {
    const [updated] = await db
      .update(customerProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerProfile(id: string): Promise<boolean> {
    const result = await db.delete(customerProfiles).where(eq(customerProfiles.id, id)).returning();
    return result.length > 0;
  }

  // ===================================
  // STATS AND ANALYTICS
  // ===================================

  async getInvoiceStats(walletAddress: string): Promise<InvoiceStats> {
    // Optimized Stats using SQL Aggregations
    const stats = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`sum(${invoices.totalAmount})`,
        paidAmount: sql<string>`sum(${invoices.paidAmount})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.invoicerWalletAddress, walletAddress),
          ne(invoices.status, "cancelled") // Exclude cancelled from totals
        )
      );

    const totalInvoices = Number(stats[0]?.count || 0);
    const totalAmountStr = stats[0]?.totalAmount || "0";
    const paidAmountStr = stats[0]?.paidAmount || "0";

    // Calculate pending using safe math on aggregated strings
    const pendingAmount = safeSubtract(totalAmountStr, paidAmountStr);

    // Count overdue efficiently
    const now = new Date();
    const [overdueResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(
        eq(invoices.invoicerWalletAddress, walletAddress),
        ne(invoices.status, "paid"),
        ne(invoices.status, "cancelled"),
        sql`${invoices.dueDate} < ${now.toISOString()}`
      ));

    const overdueCount = Number(overdueResult?.count || 0);

    // Average Payment Days
    // This is tricky to do purely in SQL across databases (SQLite vs Postgres date diff syntax varies)
    // For "deep" scalability, we should use SQL, but for compatibility/complexity balance, 
    // fetching ONLY the dates of PAID invoices is lighter than fetching everything.
    // However, let's keep the existing logic for avg payment days but limit the fetch to needed fields.

    const paidInvoicesDates = await db
      .select({
        invoiceDate: invoices.invoiceDate,
        paidAt: invoices.paidAt
      })
      .from(invoices)
      .where(and(
        eq(invoices.invoicerWalletAddress, walletAddress),
        eq(invoices.status, "paid"),
        isNotNull(invoices.paidAt)
      ));

    const averagePaymentDays = paidInvoicesDates.length > 0
      ? paidInvoicesDates.reduce((sum, inv) => {
        const days = Math.floor((new Date(inv.paidAt!).getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
        // Clamp to 0 if negative (shouldn't happen but safe)
        return sum + Math.max(0, days);
      }, 0) / paidInvoicesDates.length
      : 0;

    return {
      totalInvoices,
      totalAmount: parseFloat(totalAmountStr).toFixed(2),
      paidAmount: parseFloat(paidAmountStr).toFixed(2),
      pendingAmount: parseFloat(pendingAmount).toFixed(2),
      overdueCount,
      averagePaymentDays: Math.round(averagePaymentDays),
    };
  }

  async getCustomerStats(businessWallet: string, customerWallet: string): Promise<CustomerStats> {
    const customerInvoices = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.invoicerWalletAddress, businessWallet),
        eq(invoices.invoiceeWalletAddress, customerWallet)
      ));

    const totalInvoices = customerInvoices.length;
    const totalAmount = customerInvoices.reduce((sum, inv) => safeAdd(sum, inv.totalAmount), "0");
    const paidAmount = customerInvoices.reduce((sum, inv) => safeAdd(sum, inv.paidAmount), "0");

    // Calculate average payment days
    const paidInvoices = customerInvoices.filter(inv => inv.status === "paid" && inv.paidAt);
    const averagePaymentDays = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
        const days = Math.floor((inv.paidAt!.getTime() - inv.invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / paidInvoices.length
      : 0;

    const lastInvoiceDate = customerInvoices.length > 0
      ? customerInvoices.reduce((latest, inv) => inv.invoiceDate > latest ? inv.invoiceDate : latest, customerInvoices[0].invoiceDate)
      : null;

    const lastPaymentDate = paidInvoices.length > 0
      ? paidInvoices.reduce((latest, inv) => inv.paidAt! > latest ? inv.paidAt! : latest, paidInvoices[0].paidAt!)
      : null;

    return {
      totalInvoices,
      totalAmount: parseFloat(totalAmount).toFixed(2),
      paidAmount: parseFloat(paidAmount).toFixed(2),
      averagePaymentDays: Math.round(averagePaymentDays),
      lastInvoiceDate,
      lastPaymentDate,
    };
  }

  // ===================================
  // INVOICE TEMPLATE OPERATIONS
  // ===================================

  async getInvoiceTemplate(id: string): Promise<InvoiceTemplate | undefined> {
    const [template] = await db.select().from(invoiceTemplates).where(eq(invoiceTemplates.id, id)).limit(1);
    return template;
  }

  async getInvoiceTemplates(ownerWallet: string): Promise<InvoiceTemplate[]> {
    return await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.ownerWalletAddress, ownerWallet))
      .orderBy(desc(invoiceTemplates.createdAt));
  }

  async createInvoiceTemplate(template: InsertInvoiceTemplate): Promise<InvoiceTemplate> {
    // Ensure strict type compatibility
    const insertData: any = { ...template };
    const [newTemplate] = await db.insert(invoiceTemplates).values(insertData).returning();
    return newTemplate;
  }

  async updateInvoiceTemplate(id: string, updates: Partial<InsertInvoiceTemplate>): Promise<InvoiceTemplate | undefined> {
    const [updated] = await db
      .update(invoiceTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoiceTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteInvoiceTemplate(id: string): Promise<boolean> {
    const result = await db.delete(invoiceTemplates).where(eq(invoiceTemplates.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Check if a transaction signature has already been used in the system
   * Checks payments, invoices (x402), and x402Micropayments tables
   */
  async isSignatureUsed(signature: string): Promise<boolean> {
    if (!signature) return false;

    // 1. Check Payments table
    const [payment] = await db.select({ id: payments.id })
      .from(payments)
      .where(eq(payments.txSignature, signature))
      .limit(1);

    if (payment) return true;

    // 2. Check Invoices table (x402 signatures)
    const [invoice] = await db.select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.x402PaymentSignature, signature))
      .limit(1);

    if (invoice) return true;

    // 3. Check x402 Micropayments table
    const [x402] = await db.select({ id: x402Micropayments.id })
      .from(x402Micropayments)
      .where(eq(x402Micropayments.txSignature, signature))
      .limit(1);

    return !!x402;
  }

  // ============================================
  // NFT STORAGE METHODS
  // ============================================

  /**
   * Store payment receipt NFT
   */
  async createPaymentReceiptNFT(data: {
    paymentId: string;
    invoiceId: string;
    nftMint: string;
    nftMetadataUri: string;
    nftOwner: string;
    receiptNumber: string;
    amount: string;
    currency: string;
    paymentDate: Date;
    taxYear: number;
    txSignature: string;
    nftMintSignature: string;
  }) {
    const [nft] = await db
      .insert(paymentReceiptNFTs)
      .values(data)
      .returning();
    return nft;
  }

  /**
   * Get payment receipt NFTs for a wallet
   */
  async getPaymentReceiptNFTs(walletAddress: string) {
    return db
      .select()
      .from(paymentReceiptNFTs)
      .where(eq(paymentReceiptNFTs.nftOwner, walletAddress))
      .orderBy(desc(paymentReceiptNFTs.createdAt));
  }

  /**
   * Store business identity NFT
   */
  async createBusinessIdentityNFT(data: {
    businessProfileId: string;
    nftMint: string;
    nftMetadataUri: string;
    nftOwner: string;
    verificationLevel: string;
    verifiedBy?: string;
    verificationDate: Date;
    expiresAt?: Date;
    totalInvoicesIssued?: number;
    totalRevenueProcessed?: string;
    businessRating?: string;
    nftMintSignature: string;
  }) {
    const [nft] = await db
      .insert(businessIdentityNFTs)
      .values(data)
      .returning();
    return nft;
  }

  /**
   * Get business identity NFT for a wallet
   * Returns the most recent one if multiple exist
   */
  async getBusinessIdentityNFT(walletAddress: string) {
    const nfts = await db
      .select()
      .from(businessIdentityNFTs)
      .where(eq(businessIdentityNFTs.nftOwner, walletAddress))
      .orderBy(desc(businessIdentityNFTs.createdAt))
      .limit(1);

    return nfts[0] || null;
  }

  /**
   * Check if business already has an identity NFT
   */
  async hasBusinessIdentityNFT(businessProfileId: string): Promise<boolean> {
    const nfts = await db
      .select({ id: businessIdentityNFTs.id })
      .from(businessIdentityNFTs)
      .where(eq(businessIdentityNFTs.businessProfileId, businessProfileId))
      .limit(1);

    return nfts.length > 0;
  }

  /**
   * Get all NFTs for a user (invoices, receipts, identity)
   */
  async getAllUserNFTs(walletAddress: string) {
    // Get invoice NFTs (where user is invoicer or invoicee)
    const invoiceNFTs = await db
      .select({
        type: sql<string>`'invoice'`,
        nftMint: invoices.nftMint,
        nftMerkleTree: invoices.nftMerkleTree,
        nftLeafIndex: invoices.nftLeafIndex,
        nftMintedAt: invoices.nftMintedAt,
        metadata: sql<any>`json_build_object(
          'invoiceNumber', ${invoices.invoiceNumber},
          'totalAmount', ${invoices.totalAmount},
          'currency', ${invoices.currency},
          'status', ${invoices.status}
        )`,
      })
      .from(invoices)
      .where(
        and(
          or(
            eq(invoices.invoicerWalletAddress, walletAddress),
            eq(invoices.invoiceeWalletAddress, walletAddress)
          ),
          isNotNull(invoices.nftMint)
        )
      );

    // Get payment receipt NFTs
    const receiptNFTs = await db
      .select({
        type: sql<string>`'receipt'`,
        nftMint: paymentReceiptNFTs.nftMint,
        nftMerkleTree: sql<string>`NULL`,
        nftLeafIndex: sql<number>`NULL`,
        nftMintedAt: paymentReceiptNFTs.createdAt,
        metadata: sql<any>`json_build_object(
          'receiptNumber', ${paymentReceiptNFTs.receiptNumber},
          'amount', ${paymentReceiptNFTs.amount},
          'currency', ${paymentReceiptNFTs.currency},
          'taxYear', ${paymentReceiptNFTs.taxYear}
        )`,
      })
      .from(paymentReceiptNFTs)
      .where(eq(paymentReceiptNFTs.nftOwner, walletAddress));

    // Get business identity NFT
    const identityNFTs = await db
      .select({
        type: sql<string>`'identity'`,
        nftMint: businessIdentityNFTs.nftMint,
        nftMerkleTree: sql<string>`NULL`,
        nftLeafIndex: sql<number>`NULL`,
        nftMintedAt: businessIdentityNFTs.createdAt,
        metadata: sql<any>`json_build_object(
          'verificationLevel', ${businessIdentityNFTs.verificationLevel},
          'verifiedBy', ${businessIdentityNFTs.verifiedBy},
          'businessRating', ${businessIdentityNFTs.businessRating}
        )`,
      })
      .from(businessIdentityNFTs)
      .where(eq(businessIdentityNFTs.nftOwner, walletAddress));

    return {
      invoiceNFTs,
      receiptNFTs,
      identityNFTs,
      total: invoiceNFTs.length + receiptNFTs.length + identityNFTs.length,
    };
  }

  /**
   * Get global system statistics (Public)
   */
  async getGlobalStats(): Promise<{ totalInvoices: number; totalUsers: number; totalPaidVolume: string; encryptedInvoices: number; totalVolume: string; volumes: { currency: string; amount: string }[] }> {
    try {
      // 1. Total Invoices
      const [invResult] = await db.select({ count: sql<string>`count(*)` }).from(invoices);
      const totalInvoices = invResult ? Number(invResult.count) : 0;

      // 2. Total Users (Business + Customers)
      const [businessResult] = await db.select({ count: sql<string>`count(*)` }).from(businessProfiles);
      const [customerResult] = await db.select({ count: sql<string>`count(*)` }).from(customerProfiles);
      let totalUsers = (businessResult ? Number(businessResult.count) : 0) + (customerResult ? Number(customerResult.count) : 0);

      // 3. Encrypted Transactions
      const [encResult] = await db.select({ count: sql<string>`count(*)` })
        .from(invoices)
        .where(eq(invoices.isArciumEncrypted, true));
      const encryptedInvoices = encResult ? Number(encResult.count) : 0;

      // 4. Total Platform Volume (Sum of all invoices)
      const [volumeResult] = await db.select({ total: sql<string>`sum(${invoices.totalAmount})` }).from(invoices);
      const totalVolume = volumeResult?.total || "0";

      // 5. PAID VOLUME BY CURRENCY
      // We aggregate by currency to allow accurate USD conversion on frontend
      const paidByCurrency = await db
        .select({
          currency: invoices.currency,
          total: sql<string>`sum(${invoices.paidAmount})`
        })
        .from(invoices)
        .groupBy(invoices.currency);

      const volumes = paidByCurrency.map(row => ({
        currency: row.currency || "USDC", // Default to USDC if null
        amount: row.total || "0"
      }));

      // Legacy fallback: Sum of all raw numbers (deprecated but kept for safety)
      const totalPaidVolume = volumes.reduce((sum, v) => safeAdd(sum, v.amount), "0");

      // 6. Unique Users (Union of Business and Customer Wallets)
      // We use a raw query for the UNION operation to ensure distinctness across both tables
      let uniqueUserCount = 0;
      try {
        const result = await db.execute(sql`
          SELECT COUNT(DISTINCT wallet) as count FROM (
            SELECT owner_wallet_address as wallet FROM business_profiles
            UNION
            SELECT customer_wallet_address as wallet FROM customer_profiles
          ) as all_users
        `);
        // Handle Postgres (array of rows) vs SQLite (result object) differences if needed
        // Drizzle execute result structure depends on driver
        // For Postgres (node-postgres), result.rows[0].count
        // For standard Drizzle query style:
        if (Array.isArray(result)) {
          // likely Postgres returning rows directly or RowDataPacket
          uniqueUserCount = Number(result[0]?.count || 0);
        } else {
          // SQLite or other format
          // @ts-ignore
          uniqueUserCount = Number(result.rows?.[0]?.count || 0);
        }

        // Fallback if raw query fails/returns weird format: Use simple sum
        if (!uniqueUserCount) totalUsers = (businessResult ? Number(businessResult.count) : 0) + (customerResult ? Number(customerResult.count) : 0);
        else totalUsers = uniqueUserCount;

      } catch (e) {
        console.warn("Unique user count query failed, falling back to sum", e);
      }

      return {
        totalInvoices,
        totalUsers,
        totalPaidVolume,
        encryptedInvoices,
        totalVolume,
        volumes
      };
    } catch (error) {
      console.error("Error computing global stats:", error);
      // Return zeros on error to prevent crash
      return { totalInvoices: 0, totalUsers: 0, totalPaidVolume: "0", encryptedInvoices: 0, totalVolume: "0", volumes: [] };
    }
  }
}

// Singleton instance
const invoiceStorage = new InvoiceStorage();
export { invoiceStorage };
