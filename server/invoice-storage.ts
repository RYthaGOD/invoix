/**
 * Invoice Storage Layer
 * 
 * Database operations for B2B invoicing system
 */

// Schema selection - Enforcing Postgres schema for Production typing compliance
// as requested: "fix it as the production version is using postgres"
import * as schema from "@shared/invoice-schema";
// import * as sqliteSchema from "@shared/invoice-schema-sqlite"; // disabled for strict typing

// const isSQLite = !process.env.DATABASE_URL;
// const schema = isSQLite ? sqliteSchema : pgSchema;

const {
  invoices,
  invoiceLineItems,
  payments,
  invoiceTemplates,
  businessProfiles,
  customerProfiles,
  paymentReceiptNFTs,
  businessIdentityNFTs,
  systemSettings, // Added systemSettings here
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
} from "@shared/invoice-schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, isNotNull } from "drizzle-orm";
import { safeAdd, safeSubtract } from "@shared/math";

export interface IInvoiceStorage {
  // Invoice operations
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getInvoices(invoicerWallet: string, filters?: InvoiceFilters): Promise<Invoice[]>;
  getInvoicesForCustomer(invoiceeWallet: string, filters?: InvoiceFilters): Promise<Invoice[]>;
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
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
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
  getInvoiceTemplate(id: string): Promise<any | undefined>;
  getInvoiceTemplates(ownerWallet: string): Promise<any[]>;
  createInvoiceTemplate(template: any): Promise<any>;
  updateInvoiceTemplate(id: string, updates: any): Promise<any | undefined>;
  deleteInvoiceTemplate(id: string): Promise<boolean>;

  // Stats and analytics
  getInvoiceStats(walletAddress: string): Promise<InvoiceStats>;
  getCustomerStats(businessWallet: string, customerWallet: string): Promise<CustomerStats>;
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

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    // Ensure strict type compatibility for Postgres
    const insertData: any = { ...invoice };
    if (typeof insertData.dueDate === 'string') {
      insertData.dueDate = new Date(insertData.dueDate);
    }
    const [newInvoice] = await db.insert(invoices).values(insertData).returning();
    return newInvoice as Invoice;
  }

  async createInvoiceWithItems(invoice: InsertInvoice, lineItems?: Omit<InsertLineItem, 'invoiceId'>[]): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      // 1. Create Invoice
      const insertData: any = { ...invoice };
      if (typeof insertData.dueDate === 'string') {
        insertData.dueDate = new Date(insertData.dueDate);
      }

      const [newInvoice] = await tx.insert(invoices).values(insertData).returning();

      // 2. Create Line Items if present
      if (lineItems && lineItems.length > 0) {
        const itemsToInsert = lineItems.map(item => ({
          ...item,
          invoiceId: newInvoice.id,
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
    const [newItem] = await db.insert(invoiceLineItems).values(lineItem).returning();
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

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    const rows = await db.select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));
    return rows as Payment[];
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
    // Check for duplicate transaction signature to ensure idempotency
    if (payment.txSignature) {
      const existingPayment = await db.select()
        .from(payments)
        .where(eq(payments.txSignature, payment.txSignature))
        .limit(1);
      
      if (existingPayment.length > 0) {
        // Payment with this transaction signature already exists
        throw new Error(`Payment already processed: transaction ${payment.txSignature} has already been recorded`);
      }
    }

    // Use a transaction to ensure atomicity between payment and invoice updates
    const result = await db.transaction(async (tx) => {
      // Insert the payment
      const [newPayment] = await tx.insert(payments).values(payment).returning();

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
    const allInvoices = await this.getInvoices(walletAddress);

    const totalInvoices = allInvoices.length;
    const totalAmount = allInvoices.reduce((sum, inv) => safeAdd(sum, inv.totalAmount), "0");
    const paidAmount = allInvoices.reduce((sum, inv) => safeAdd(sum, inv.paidAmount), "0");
    const pendingAmount = safeSubtract(totalAmount, paidAmount);

    // Count overdue invoices (past due date and not fully paid)
    const now = new Date();
    const overdueCount = allInvoices.filter(inv =>
      inv.status !== "paid" &&
      inv.status !== "cancelled" &&
      inv.dueDate < now
    ).length;

    // Calculate average payment days for paid invoices
    const paidInvoices = allInvoices.filter(inv => inv.status === "paid" && inv.paidAt);
    const averagePaymentDays = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
        const days = Math.floor((inv.paidAt!.getTime() - inv.invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / paidInvoices.length
      : 0;

    return {
      totalInvoices,
      totalAmount: parseFloat(totalAmount).toFixed(2),
      paidAmount: parseFloat(paidAmount).toFixed(2),
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

  async getInvoiceTemplate(id: string): Promise<any | undefined> {
    const [template] = await db.select().from(invoiceTemplates).where(eq(invoiceTemplates.id, id)).limit(1);
    return template;
  }

  async getInvoiceTemplates(ownerWallet: string): Promise<any[]> {
    return await db.select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.ownerWalletAddress, ownerWallet))
      .orderBy(desc(invoiceTemplates.createdAt));
  }

  async createInvoiceTemplate(template: any): Promise<any> {
    const [newTemplate] = await db.insert(invoiceTemplates).values(template).returning();
    return newTemplate;
  }

  async updateInvoiceTemplate(id: string, updates: any): Promise<any | undefined> {
    const [updated] = await db
      .update(invoiceTemplates)
      .set(updates)
      .where(eq(invoiceTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteInvoiceTemplate(id: string): Promise<boolean> {
    const result = await db.delete(invoiceTemplates).where(eq(invoiceTemplates.id, id)).returning();
    return result.length > 0;
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
}

// Singleton instance
const invoiceStorage = new InvoiceStorage();
export { invoiceStorage };
