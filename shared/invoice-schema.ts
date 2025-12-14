/**
 * B2B Invoicing System Schema
 * 
 * Defines database tables for a privacy-first invoicing system on Solana
 * with Arcium v0.5 encryption for confidential transactions
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// CORE INVOICING TABLES
// ============================================

/**
 * Invoices - Main invoice records
 * Stores invoice metadata and encrypted details using Arcium
 */
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(), // Human-readable invoice #

  // Parties (invoicer and invoicee)
  invoicerWalletAddress: text("invoicer_wallet_address").notNull(), // Business sending invoice
  invoiceeWalletAddress: text("invoicee_wallet_address").notNull(), // Customer receiving invoice

  // Invoice Details
  invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  description: text("description"), // Brief description
  notes: text("notes"), // Internal notes

  // Currency & Payment Details
  currency: text("currency").notNull().default("USDC"), // USDC, USDT, PYUSD, EURC
  tokenMint: text("token_mint"), // SPL token mint address for the currency
  tokenDecimals: integer("token_decimals").notNull().default(6), // Usually 6 for stablecoins, 9 for SOL

  subtotal: decimal("subtotal", { precision: 18, scale: 9 }).notNull(), // Sum of line items
  taxAmount: decimal("tax_amount", { precision: 18, scale: 9 }).notNull().default("0"),
  discountAmount: decimal("discount_amount", { precision: 18, scale: 9 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 18, scale: 9 }).notNull(), // Final amount due

  // Payment Status
  status: text("status").notNull().default("draft"), // draft, sent, viewed, partial, paid, overdue, cancelled
  paidAmount: decimal("paid_amount", { precision: 18, scale: 9 }).notNull().default("0"),
  remainingAmount: decimal("remaining_amount", { precision: 18, scale: 9 }).notNull(),

  // Payment Details
  paymentTerms: text("payment_terms"), // e.g., "Net 30", "Due on receipt"
  paymentInstructions: text("payment_instructions"), // Instructions for customer

  // Privacy Settings (leveraging our privacy implementation)
  isPrivate: boolean("is_private").notNull().default(true),
  hideAmounts: boolean("hide_amounts").notNull().default(true), // Hide amounts from public view
  hideParties: boolean("hide_parties").notNull().default(true), // Hide wallet addresses

  // Arcium v0.5 Confidential Computing
  isArciumEncrypted: boolean("is_arcium_encrypted").notNull().default(false),
  arciumEncryptedData: text("arcium_encrypted_data"), // Encrypted invoice details
  arciumEncryptionKey: text("arcium_encryption_key"),
  arciumComputationId: text("arcium_computation_id"),
  arciumAllowedParties: text("arcium_allowed_parties").array(), // Can include auditors

  // x402 Micropayment Fee (for using invoice service)
  x402ServiceFeeUSD: decimal("x402_service_fee_usd", { precision: 18, scale: 6 }).notNull().default("0.01"), // $0.01 per invoice
  x402FeePaid: boolean("x402_fee_paid").notNull().default(false),
  x402PaymentSignature: text("x402_payment_signature"),

  // NFT Integration (pNFT for tradeable invoices)
  nftMint: text("nft_mint"), // NFT mint address
  nftMerkleTree: text("nft_merkle_tree"), // Merkle tree for compressed NFT
  nftLeafIndex: integer("nft_leaf_index"), // Position in merkle tree
  nftMetadataUri: text("nft_metadata_uri"), // URI to NFT metadata
  nftMintedAt: timestamp("nft_minted_at"), // When NFT was minted
  nftTransferredTo: text("nft_transferred_to"), // For invoice financing (NFT sold to buyer)
  nftBurnedAt: timestamp("nft_burned_at"), // When NFT was burned (paid/cancelled)

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"), // When invoice was sent to customer
  viewedAt: timestamp("viewed_at"), // When customer first viewed
  paidAt: timestamp("paid_at"), // When fully paid
  cancelledAt: timestamp("cancelled_at"),

  // Privacy v2
  privacySalt: text("privacy_salt"), // 32-byte hex salt for preventing rainbow table attacks
});

/**
 * Serializes invoice data into a canonical string for consistent hashing
 * Used by both Backend (NFT Minting) and Frontend (Verification)
 * Format: description|amount|lineItemsString|salt
 */
export function serializeInvoiceForHashing(invoice: any): string {
  // 1. Amount: Strict 2 decimal places
  const amount = Number(invoice.totalAmount).toFixed(2);

  // 2. Line Items: Sort and Format
  // We expect invoice.lineItems to be populated
  let lineItemsString = "";
  if (invoice.lineItems && Array.isArray(invoice.lineItems)) {
    // Sort by line number to ensure order
    const sortedItems = [...invoice.lineItems].sort((a, b) => a.lineNumber - b.lineNumber);

    lineItemsString = sortedItems.map(item => {
      const qty = Number(item.quantity).toString(); // remove trailing zeros if any? keep simple
      const price = Number(item.unitPrice).toFixed(2);
      // Clean description of pipe characters to avoid injection
      const cleanDesc = (item.description || "").replace(/\|/g, "");
      return `${cleanDesc}|${qty}|${price}`;
    }).join("|");
  }

  // 3. Salt
  const salt = invoice.privacySalt || "";

  // 4. Description
  const description = (invoice.description || "").replace(/\|/g, "");

  // Canonical String
  return `${description}|${amount}|${lineItemsString}|${salt}`;
}

/**
 * Invoice Line Items - Individual products/services on an invoice
 */
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),

  // Line Item Details
  lineNumber: integer("line_number").notNull(), // Order of items (1, 2, 3...)
  description: text("description").notNull(), // Product or service description

  // Quantity and Pricing
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 18, scale: 9 }).notNull(),
  lineTotal: decimal("line_total", { precision: 18, scale: 9 }).notNull(), // quantity * unitPrice

  // Optional Tax/Discount per line
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // e.g., 8.5 for 8.5%
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }), // e.g., 10 for 10% off

  // Product/Service Metadata
  sku: text("sku"), // Product SKU if applicable
  category: text("category"), // e.g., "Consulting", "Software", "Hardware"

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Payments - Payment records for invoices
 * Tracks individual payment transactions on Solana
 */
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),

  // Payment Details
  paymentNumber: text("payment_number").notNull(), // Human-readable payment reference
  paymentMethod: text("payment_method").notNull().default("solana"), // solana, bank_transfer, etc.

  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(),
  currency: text("currency").notNull(), // Should match invoice currency

  // Solana Transaction
  txSignature: text("tx_signature").notNull().unique(), // On-chain signature
  fromAddress: text("from_address").notNull(), // Payer wallet
  toAddress: text("to_address").notNull(), // Recipient wallet (invoicer)
  blockTime: timestamp("block_time"), // When tx was confirmed on-chain
  slot: integer("slot"), // Solana slot number

  // Payment Status
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  confirmations: integer("confirmations").notNull().default(0),

  // Accounting & Compliance
  usdValueAtPayment: decimal("usd_value_at_payment", { precision: 18, scale: 6 }), // USD value at time of payment
  isBusinessExpense: boolean("is_business_expense").notNull().default(false), // User-flagged business expense

  // Arcium Encryption (optional - for sensitive payment notes)
  isArciumEncrypted: boolean("is_arcium_encrypted").notNull().default(false),
  arciumEncryptedData: text("arcium_encrypted_data"),
  arciumEncryptionKey: text("arcium_encryption_key"),

  // Metadata
  paymentNotes: text("payment_notes"), // Optional notes from payer
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

/**
 * Invoice Templates - Reusable invoice templates for businesses
 */
export const invoiceTemplates = pgTable("invoice_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Template Metadata
  name: text("name").notNull(), // e.g., "Monthly Consulting", "Hourly Services"
  description: text("description"),
  ownerWalletAddress: text("owner_wallet_address").notNull(),

  // Default Settings
  defaultCurrency: text("default_currency").notNull().default("USDC"),
  defaultTokenMintAddress: text("default_token_mint_address").notNull(),
  defaultPaymentTerms: text("default_payment_terms").default("Net 30"),
  defaultDueDays: integer("default_due_days").notNull().default(30), // Days until due

  // Default Line Items (JSON array)
  defaultLineItems: text("default_line_items"), // JSON: [{ description, quantity, unitPrice }]

  // Template Settings
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Business Profiles - Store business information for invoicers
 */
export const businessProfiles = pgTable("business_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerWalletAddress: text("owner_wallet_address").notNull().unique(),

  // Business Information
  businessName: text("business_name").notNull(),
  businessEmail: text("business_email"),
  businessPhone: text("business_phone"),
  businessAddress: text("business_address"),
  businessWebsite: text("business_website"),

  // Tax Information
  taxId: text("tax_id"), // EIN, VAT number, etc.
  taxRegistrationNumber: text("tax_registration_number"),

  // Branding
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#3b82f6"), // Hex color

  // Invoice Settings
  defaultInvoicePrefix: text("default_invoice_prefix").default("INV"), // e.g., "INV-2025-001"
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  defaultPaymentTerms: text("default_payment_terms").default("Net 30"),

  // Privacy Preferences
  defaultPrivacySettings: boolean("default_privacy_settings").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Customer Profiles - Store customer information for invoicees
 */
export const customerProfiles = pgTable("customer_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessWalletAddress: text("business_wallet_address").notNull(), // Invoicer who owns this customer
  customerWalletAddress: text("customer_wallet_address").notNull(), // Customer's wallet

  // Customer Information
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),

  // Business Relationship
  customerNotes: text("customer_notes"),
  paymentTerms: text("payment_terms").default("Net 30"), // Custom terms for this customer

  // Stats
  totalInvoicesSent: integer("total_invoices_sent").notNull().default(0),
  totalAmountInvoiced: decimal("total_amount_invoiced", { precision: 18, scale: 9 }).notNull().default("0"),
  totalAmountPaid: decimal("total_amount_paid", { precision: 18, scale: 9 }).notNull().default("0"),
  averagePaymentDays: integer("average_payment_days"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// EXISTING TABLES (Adapted from legacy)
// ============================================

/**
 * x402 Micropayments - For invoice service fees
 * Repurposed from trading bot to invoice service payments
 */
export const x402Micropayments = pgTable("x402_micropayments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerWalletAddress: text("owner_wallet_address").notNull(),

  // Payment details
  paymentType: text("payment_type").notNull(), // "invoice_creation", "invoice_send", "payment_processing"
  resourceUrl: text("resource_url").notNull(),
  amountUSDC: decimal("amount_usdc", { precision: 18, scale: 6 }).notNull(),
  amountMicroUSDC: text("amount_micro_usdc").notNull(),

  // Transaction details
  txSignature: text("tx_signature").notNull(),
  network: text("network").notNull().default("solana-mainnet"),
  status: text("status").notNull().default("pending"),

  // x402 protocol metadata
  x402Version: integer("x402_version").notNull().default(1),
  paymentScheme: text("payment_scheme").notNull().default("exact"),
  facilitatorUrl: text("facilitator_url"),
  description: text("description"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

// ============================================
// pNFT TABLES (Programmable NFTs for Invoicing)
// ============================================

/**
 * Payment Receipt NFTs - NFT proof of payment for tax/audit
 * Minted when a payment is recorded to provide immutable receipts
 */
export const paymentReceiptNFTs = pgTable("payment_receipt_nfts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").notNull().references(() => payments.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),

  // NFT Details
  nftMint: text("nft_mint").notNull().unique(), // NFT mint address
  nftMetadataUri: text("nft_metadata_uri").notNull(), // Metadata URI
  nftOwner: text("nft_owner").notNull(), // Current owner (payment recipient)

  // Receipt Information
  receiptNumber: text("receipt_number").notNull().unique(), // Human-readable receipt #
  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(),
  currency: text("currency").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  taxYear: integer("tax_year").notNull(), // For tax filing

  // Transaction Details
  txSignature: text("tx_signature").notNull(), // Original payment tx
  nftMintSignature: text("nft_mint_signature").notNull(), // NFT mint tx

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Business Identity NFTs - Verified business credentials
 * Provides trust signals and KYB verification
 */
export const businessIdentityNFTs = pgTable("business_identity_nfts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessProfileId: varchar("business_profile_id").notNull()
    .references(() => businessProfiles.id),

  // NFT Details
  nftMint: text("nft_mint").notNull().unique(), // NFT mint address
  nftMetadataUri: text("nft_metadata_uri").notNull(),
  nftOwner: text("nft_owner").notNull(), // Business wallet

  // Verification Details
  verificationLevel: text("verification_level").notNull().default("basic"), // basic, verified, premium
  verifiedBy: text("verified_by"), // KYB provider (e.g., "Civic", "Synaps")
  verificationDate: timestamp("verification_date").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration for reverification

  // Business Metrics (at time of minting)
  totalInvoicesIssued: integer("total_invoices_issued").notNull().default(0),
  totalRevenueProcessed: decimal("total_revenue_processed", { precision: 18, scale: 9 }),
  businessRating: decimal("business_rating", { precision: 3, scale: 2 }), // e.g., 4.75

  // NFT Transaction
  nftMintSignature: text("nft_mint_signature").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Invoice Marketplace - For selling invoices before payment (invoice financing)
 * Enables businesses to sell invoices as NFTs for immediate cash flow
 */
export const invoiceMarketplace = pgTable("invoice_marketplace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),

  // NFT Details
  nftMint: text("nft_mint").notNull(), // Invoice NFT mint
  nftMerkleTree: text("nft_merkle_tree").notNull(),
  nftLeafIndex: integer("nft_leaf_index").notNull(),

  // Listing Details
  seller: text("seller").notNull(), // Original invoicer
  faceValue: decimal("face_value", { precision: 18, scale: 9 }).notNull(), // Invoice total
  askingPrice: decimal("asking_price", { precision: 18, scale: 9 }).notNull(), // Sale price
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }).notNull(), // % discount
  currency: text("currency").notNull(),

  // Listing Status
  status: text("status").notNull().default("active"), // active, sold, cancelled
  listedAt: timestamp("listed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional listing expiration

  // Sale Details
  soldAt: timestamp("sold_at"),
  soldTo: text("sold_to"), // Buyer wallet
  salePrice: decimal("sale_price", { precision: 18, scale: 9 }),
  saleTxSignature: text("sale_tx_signature"),

  // Metadata
  listingDescription: text("listing_description"),
  minBuyerRating: decimal("min_buyer_rating", { precision: 3, scale: 2 }), // e.g., 3.0 minimum

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// RELATIONS
// ============================================

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  lineItems: many(invoiceLineItems),
  payments: many(payments),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentReceiptNFTsRelations = relations(paymentReceiptNFTs, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentReceiptNFTs.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [paymentReceiptNFTs.invoiceId],
    references: [invoices.id],
  }),
}));

export const businessIdentityNFTsRelations = relations(businessIdentityNFTs, ({ one }) => ({
  businessProfile: one(businessProfiles, {
    fields: [businessIdentityNFTs.businessProfileId],
    references: [businessProfiles.id],
  }),
}));

export const invoiceMarketplaceRelations = relations(invoiceMarketplace, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceMarketplace.invoiceId],
    references: [invoices.id],
  }),
}));

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoicerWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  invoiceeWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  tokenMintAddress: z.string().min(32, "Invalid token mint address"),
  totalAmount: z.string().refine(val => parseFloat(val) > 0, "Total amount must be positive"),
  dueDate: z.date().or(z.string()),
});

export const insertLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  invoiceId: z.string().uuid(),
  quantity: z.string().refine(val => parseFloat(val) > 0, "Quantity must be positive"),
  unitPrice: z.string().refine(val => parseFloat(val) >= 0, "Unit price cannot be negative"),
});

export const insertInvoiceWithItemsSchema = insertInvoiceSchema.extend({
  lineItems: z.array(insertLineItemSchema.omit({ invoiceId: true })).optional(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
}).extend({
  invoiceId: z.string().uuid(),
  txSignature: z.string().min(88, "Invalid Solana transaction signature"), // Fixed: Solana signatures are 88 chars
  amount: z.string().refine(val => parseFloat(val) > 0, "Payment amount must be positive"),
  usdValueAtPayment: z.string().optional(), // Optional: can be passed from client or fetched
  isBusinessExpense: z.boolean().optional(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ownerWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  businessName: z.string().min(1, "Business name required"),
});

export const insertCustomerProfileSchema = createInsertSchema(customerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  businessWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  customerWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  customerName: z.string().min(1, "Customer name required"),
});

export const insertPaymentReceiptNFTSchema = createInsertSchema(paymentReceiptNFTs).omit({
  id: true,
  createdAt: true,
}).extend({
  paymentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  nftMint: z.string().min(32, "Invalid NFT mint address"),
  nftOwner: z.string().min(32, "Invalid owner wallet address"),
  amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive"),
});

export const insertBusinessIdentityNFTSchema = createInsertSchema(businessIdentityNFTs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  businessProfileId: z.string().uuid(),
  nftMint: z.string().min(32, "Invalid NFT mint address"),
  nftOwner: z.string().min(32, "Invalid owner wallet address"),
  verificationLevel: z.enum(["basic", "verified", "premium"]),
});

export const insertInvoiceMarketplaceSchema = createInsertSchema(invoiceMarketplace).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceId: z.string().uuid(),
  nftMint: z.string().min(32, "Invalid NFT mint address"),
  seller: z.string().min(32, "Invalid seller wallet address"),
  faceValue: z.string().refine(val => parseFloat(val) > 0, "Face value must be positive"),
  askingPrice: z.string().refine(val => parseFloat(val) > 0, "Asking price must be positive"),
});

export const insertInvoiceTemplateSchema = createInsertSchema(invoiceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ownerWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
  name: z.string().min(1, "Template name required"),
});

// ============================================
// SYSTEM TABLES
// ============================================

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// SECURITY TABLES
// ============================================

/**
 * Auth Nonces - Prevents signature replay attacks
 * Stores used signatures with an expiration
 */
export const authNonces = pgTable("auth_nonces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  signature: text("signature").notNull().unique(), // The used signature
  expiresAt: timestamp("expires_at").notNull(), // When this nonce record can be purged
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type InsertInvoiceTemplate = z.infer<typeof insertInvoiceTemplateSchema>;

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = z.infer<typeof insertCustomerProfileSchema>;

export type PaymentReceiptNFT = typeof paymentReceiptNFTs.$inferSelect;
export type InsertPaymentReceiptNFT = z.infer<typeof insertPaymentReceiptNFTSchema>;

export type BusinessIdentityNFT = typeof businessIdentityNFTs.$inferSelect;
export type InsertBusinessIdentityNFT = z.infer<typeof insertBusinessIdentityNFTSchema>;

export type InvoiceMarketplaceListing = typeof invoiceMarketplace.$inferSelect;
export type InsertInvoiceMarketplaceListing = z.infer<typeof insertInvoiceMarketplaceSchema>;

// Backwards compatibility aliases
export type SelectInvoice = Invoice;
export type SelectPayment = Payment;
export type SelectBusinessProfile = BusinessProfile;


export type X402Micropayment = typeof x402Micropayments.$inferSelect;
