/**
 * B2B Invoicing System Schema - SQLite Version (Local Dev)
 * 
 * Defines database tables for a privacy-first invoicing system on Solana
 * Compatible with SQLite for local testing without Postgres
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// CORE INVOICING TABLES
// ============================================

/**
 * Invoices - Main invoice records
 */
export const invoices = sqliteTable("invoices", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceNumber: text("invoice_number").notNull().unique(),

    // Parties
    invoicerWalletAddress: text("invoicer_wallet_address").notNull(),
    invoiceeWalletAddress: text("invoicee_wallet_address").notNull(),

    // Details
    invoiceDate: integer("invoice_date", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
    description: text("description"),
    notes: text("notes"),

    // Currency
    currency: text("currency").notNull().default("USDC"),
    tokenMint: text("token_mint"),
    tokenDecimals: integer("token_decimals").notNull().default(6),

    // Amounts (Stored as text for precision, similar to decimal)
    subtotal: text("subtotal").notNull(),
    taxAmount: text("tax_amount").notNull().default("0"),
    discountAmount: text("discount_amount").notNull().default("0"),
    totalAmount: text("total_amount").notNull(),

    // Status
    status: text("status").notNull().default("draft"),
    paidAmount: text("paid_amount").notNull().default("0"),
    remainingAmount: text("remaining_amount").notNull(),

    // Payment Details
    paymentTerms: text("payment_terms"),
    paymentInstructions: text("payment_instructions"),

    // Privacy
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(true),
    hideAmounts: integer("hide_amounts", { mode: "boolean" }).notNull().default(true),
    hideParties: integer("hide_parties", { mode: "boolean" }).notNull().default(true),

    // Arcium
    isArciumEncrypted: integer("is_arcium_encrypted", { mode: "boolean" }).notNull().default(false),
    arciumEncryptedData: text("arcium_encrypted_data"),
    arciumEncryptionKey: text("arcium_encryption_key"),
    arciumComputationId: text("arcium_computation_id"),
    arciumAllowedParties: text("arcium_allowed_parties"), // Stored as JSON string

    // x402
    x402ServiceFeeUSD: text("x402_service_fee_usd").notNull().default("0.01"),
    x402FeePaid: integer("x402_fee_paid", { mode: "boolean" }).notNull().default(false),
    x402PaymentSignature: text("x402_payment_signature"),

    // NFT
    nftMint: text("nft_mint"),
    nftMerkleTree: text("nft_merkle_tree"),
    nftLeafIndex: integer("nft_leaf_index"),
    nftMetadataUri: text("nft_metadata_uri"),
    nftMintedAt: integer("nft_minted_at", { mode: "timestamp" }),
    nftTransferredTo: text("nft_transferred_to"),
    nftBurnedAt: integer("nft_burned_at", { mode: "timestamp" }),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    viewedAt: integer("viewed_at", { mode: "timestamp" }),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
});

/**
 * Invoice Line Items
 */
export const invoiceLineItems = sqliteTable("invoice_line_items", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),

    lineNumber: integer("line_number").notNull(),
    description: text("description").notNull(),

    quantity: text("quantity").notNull().default("1"),
    unitPrice: text("unit_price").notNull(),
    lineTotal: text("line_total").notNull(),

    taxRate: text("tax_rate"),
    discountRate: text("discount_rate"),

    sku: text("sku"),
    category: text("category"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * Payments
 */
export const payments = sqliteTable("payments", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),

    paymentNumber: text("payment_number").notNull(),
    paymentMethod: text("payment_method").notNull().default("solana"),

    amount: text("amount").notNull(),
    currency: text("currency").notNull(),

    txSignature: text("tx_signature").notNull().unique(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    blockTime: integer("block_time", { mode: "timestamp" }),
    slot: integer("slot"),

    status: text("status").notNull().default("pending"),
    confirmations: integer("confirmations").notNull().default(0),

    isArciumEncrypted: integer("is_arcium_encrypted", { mode: "boolean" }).notNull().default(false),
    arciumEncryptedData: text("arcium_encrypted_data"),
    arciumEncryptionKey: text("arcium_encryption_key"),

    paymentNotes: text("payment_notes"),
    errorMessage: text("error_message"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});

/**
 * Invoice Templates
 */
export const invoiceTemplates = sqliteTable("invoice_templates", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

    name: text("name").notNull(),
    description: text("description"),
    ownerWalletAddress: text("owner_wallet_address").notNull(),

    defaultCurrency: text("default_currency").notNull().default("USDC"),
    defaultTokenMintAddress: text("default_token_mint_address").notNull(),
    defaultPaymentTerms: text("default_payment_terms").default("Net 30"),
    defaultDueDays: integer("default_due_days").notNull().default(30),

    defaultLineItems: text("default_line_items"),

    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * Business Profiles
 */
export const businessProfiles = sqliteTable("business_profiles", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerWalletAddress: text("owner_wallet_address").notNull().unique(),

    businessName: text("business_name").notNull(),
    businessEmail: text("business_email"),
    businessPhone: text("business_phone"),
    businessAddress: text("business_address"),
    businessWebsite: text("business_website"),

    taxId: text("tax_id"),
    taxRegistrationNumber: text("tax_registration_number"),

    logoUrl: text("logo_url"),
    brandColor: text("brand_color").default("#3b82f6"),

    defaultInvoicePrefix: text("default_invoice_prefix").default("INV"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    defaultPaymentTerms: text("default_payment_terms").default("Net 30"),

    defaultPrivacySettings: integer("default_privacy_settings", { mode: "boolean" }).notNull().default(true),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * Customer Profiles
 */
export const customerProfiles = sqliteTable("customer_profiles", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    businessWalletAddress: text("business_wallet_address").notNull(),
    customerWalletAddress: text("customer_wallet_address").notNull(),

    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),

    customerNotes: text("customer_notes"),
    paymentTerms: text("payment_terms").default("Net 30"),

    totalInvoicesSent: integer("total_invoices_sent").notNull().default(0),
    totalAmountInvoiced: text("total_amount_invoiced").notNull().default("0"),
    totalAmountPaid: text("total_amount_paid").notNull().default("0"),
    averagePaymentDays: integer("average_payment_days"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * x402 Micropayments
 */
export const x402Micropayments = sqliteTable("x402_micropayments", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerWalletAddress: text("owner_wallet_address").notNull(),

    paymentType: text("payment_type").notNull(),
    resourceUrl: text("resource_url").notNull(),
    amountUSDC: text("amount_usdc").notNull(),
    amountMicroUSDC: text("amount_micro_usdc").notNull(),

    txSignature: text("tx_signature").notNull(),
    network: text("network").notNull().default("solana-mainnet"),
    status: text("status").notNull().default("pending"),

    x402Version: integer("x402_version").notNull().default(1),
    paymentScheme: text("payment_scheme").notNull().default("exact"),
    facilitatorUrl: text("facilitator_url"),
    description: text("description"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});

/**
 * Payment Receipt NFTs
 */
export const paymentReceiptNFTs = sqliteTable("payment_receipt_nfts", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    paymentId: text("payment_id").notNull().references(() => payments.id),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),

    nftMint: text("nft_mint").notNull().unique(),
    nftMetadataUri: text("nft_metadata_uri").notNull(),
    nftOwner: text("nft_owner").notNull(),

    receiptNumber: text("receipt_number").notNull().unique(),
    amount: text("amount").notNull(),
    currency: text("currency").notNull(),
    paymentDate: integer("payment_date", { mode: "timestamp" }).notNull(),
    taxYear: integer("tax_year").notNull(),

    txSignature: text("tx_signature").notNull(),
    nftMintSignature: text("nft_mint_signature").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * Business Identity NFTs
 */
export const businessIdentityNFTs = sqliteTable("business_identity_nfts", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    businessProfileId: text("business_profile_id").notNull()
        .references(() => businessProfiles.id),

    nftMint: text("nft_mint").notNull().unique(),
    nftMetadataUri: text("nft_metadata_uri").notNull(),
    nftOwner: text("nft_owner").notNull(),

    verificationLevel: text("verification_level").notNull().default("basic"),
    verifiedBy: text("verified_by"),
    verificationDate: integer("verification_date", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }),

    totalInvoicesIssued: integer("total_invoices_issued").notNull().default(0),
    totalRevenueProcessed: text("total_revenue_processed"),
    businessRating: text("business_rating"),

    nftMintSignature: text("nft_mint_signature").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * Invoice Marketplace
 */
export const invoiceMarketplace = sqliteTable("invoice_marketplace", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),

    nftMint: text("nft_mint").notNull(),
    nftMerkleTree: text("nft_merkle_tree").notNull(),
    nftLeafIndex: integer("nft_leaf_index").notNull(),

    seller: text("seller").notNull(),
    faceValue: text("face_value").notNull(),
    askingPrice: text("asking_price").notNull(),
    discountRate: text("discount_rate").notNull(),
    currency: text("currency").notNull(),

    status: text("status").notNull().default("active"),
    listedAt: integer("listed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }),

    soldAt: integer("sold_at", { mode: "timestamp" }),
    soldTo: text("sold_to"),
    salePrice: text("sale_price"),
    saleTxSignature: text("sale_tx_signature"),

    listingDescription: text("listing_description"),
    minBuyerRating: text("min_buyer_rating"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// ============================================
// RELATIONS
// ============================================

export const invoicesRelations = relations(invoices, ({ many }) => ({
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
// RE-EXPORT ZOD SCHEMAS (Compatible)
// ============================================
// We can reuse the same Zod schemas even though types changed slightly (e.g. decimal -> string)
// createInsertSchema might behave differently if it reads from sqliteTable vs pgTable
// But for now, we will just export types based on this schema.

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}).extend({
    invoicerWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
    invoiceeWalletAddress: z.string().min(32, "Invalid Solana wallet address"),
    tokenMint: z.string().min(32, "Invalid token mint address").optional(),
    tokenMintAddress: z.string().min(32, "Invalid token mint address").optional(), // Compat
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

export const insertPaymentSchema = createInsertSchema(payments).omit({
    id: true,
    createdAt: true,
}).extend({
    invoiceId: z.string().uuid(),
    txSignature: z.string().min(88, "Invalid Solana transaction signature"),
    amount: z.string().refine(val => parseFloat(val) > 0, "Payment amount must be positive"),
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

// ... existing code ...

/**
 * Auth Nonces (Replay Prevention)
 */
export const authNonces = sqliteTable("auth_nonces", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    walletAddress: text("wallet_address").notNull(),
    signature: text("signature").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type AuthNonce = typeof authNonces.$inferSelect;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;

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

