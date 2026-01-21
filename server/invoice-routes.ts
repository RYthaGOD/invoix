/**
 * Invoice API Routes
 * 
 * Complete REST API for B2B invoicing system
 */

import type { Express } from "express";
import { logger } from "./logger";
import { invoiceStorage } from "./invoice-storage";
import { asyncHandler } from "./error-handler";
import { safeSub as safeSubtract, safeAdd, safeMul as safeMultiply } from "@shared/monetary";
import Decimal from "decimal.js";
import {
  insertInvoiceSchema,
  insertInvoiceWithItemsSchema,
  insertLineItemSchema,
  insertPaymentSchema,
} from "@shared/invoice-schema";

import { requireWalletOwnership, strictRateLimit } from "./security";
import { validateApiKey } from "./middleware/api-auth";
import { getArciumService } from "./arcium-service";
import { getArciumOnChainService } from "./arcium-onchain-service";
import { getInvoiceNFTService } from "./nft-service";
import { getEmailService } from "./email-service"; // Import Email Service
import { emitWebhookEvent, WEBHOOK_EVENTS } from "./webhook-service";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { verifyStablecoinPayment } from "./stablecoin-payment-service";

import { Connection, clusterApiUrl } from "@solana/web3.js";
import {
  TREASURY_WALLET_ADDRESS,
  TOKEN_MINTS,
  DEFAULT_TOKEN_MINT,
  PLATFORM_FEE_RATE
} from "@shared/config";
import { registerDynamicImageRoutes } from "./endpoints/dynamic-image";
import rateLimit from "express-rate-limit"; // Added rateLimit import
import { logMetadataAccess } from "./utils/audit-logger"; // Added logger import

import type { Request, Response } from "express";

// Extended Request type for authenticated routes
interface AuthenticatedRequest extends Request {
  authenticatedWallet?: string;
  authMode?: string;
  smartWalletPda?: string;
  session: Request['session'] & {
    walletAddress?: string;
    authMode?: string;
    smartWalletPda?: string;
  };
}

/**
 * Register invoice-related API routes
 */
export async function registerInvoiceRoutes(app: Express): Promise<void> {

  // ============================================
  // INVOICE ROUTES
  // ============================================

  // Register Dynamic Image Routes (SVGs)
  registerDynamicImageRoutes(app);

  /**
   * Create a new invoice
   * POST /api/invoices
  /**
   * Create a new invoice
   * POST /api/invoices
   * Requires authentication (Wallet Session OR API Key)
   */
  app.post("/api/invoices", validateApiKey, requireWalletOwnership, strictRateLimit, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 1. Authenticated User (from middleware)
    const authenticatedWallet = req.authenticatedWallet!;
    logger.info("Invoice creation request received", "invoice", {
      wallet: authenticatedWallet,
      body: { ...req.body, lineItems: req.body.lineItems?.length }, // Log safe summary
    });

    // 2. Authorization & Defaults
    // If tokenMintAddress is missing, map from currency or use default
    let tokenMintAddress = req.body.tokenMintAddress;
    if (!tokenMintAddress) {
      const currency = req.body.currency || "USDC";
      tokenMintAddress = TOKEN_MINTS[currency] || DEFAULT_TOKEN_MINT;
    }
    const tokenMint = tokenMintAddress;

    // "Normalization" - Ensure we construct a clean object for validation
    // Instead of mutating req.body, create a new input object
    const invoiceInput = {
      ...req.body,
      invoicerWalletAddress: authenticatedWallet,
      tokenMintAddress,
      tokenMint
      // status defaults to 'draft' via Zod if not provided
      // paidAmount defaults to '0' via Zod
    };

    // 3. Validation
    const validatedData = insertInvoiceWithItemsSchema.parse(invoiceInput);
    const { lineItems, ...invoiceData } = validatedData;

    // 4. Calculations (Subtotal, Fee, Total)
    const subtotal = lineItems?.reduce((sum, item) => {
      const itemTotal = safeMultiply(item.quantity, item.unitPrice);
      return safeAdd(sum, itemTotal);
    }, "0") || "0";

    const finalSubtotal = (invoiceData as any).subtotal || subtotal;

    // Calculate Platform Fee (1% of subtotal)
    // The platform fee is added ON TOP of the invoice total
    const platformFee = safeMultiply(finalSubtotal, PLATFORM_FEE_RATE);

    // Total = Subtotal + Tax - Discount + PlatformFee
    const taxAmount = (invoiceData as any).taxAmount || "0";
    const discountAmount = (invoiceData as any).discountAmount || "0";
    const calculatedTotal = safeAdd(
      safeSubtract(safeAdd(finalSubtotal, taxAmount), discountAmount),
      platformFee
    );

    const remainingAmount = safeSubtract(calculatedTotal, (invoiceData as any).paidAmount || "0");
    const invoiceNumber = (invoiceData as any).invoiceNumber;

    // 5. Persistence
    const invoice = await invoiceStorage.createInvoiceWithItems(
      {
        ...invoiceData,
        invoiceNumber,
        subtotal: finalSubtotal,
        taxAmount,
        discountAmount,
        platformFee,
        totalAmount: calculatedTotal,
        dueDate: new Date(invoiceData.dueDate),
        invoicerWalletAddress: authenticatedWallet,
        remainingAmount: remainingAmount,
        x402FeePaid: true,
        x402PaymentSignature: invoiceData.x402PaymentSignature,
        x402ServiceFeeUSD: "0.015",
      } as any,
      lineItems
    );

    // 6. Side Effects (Async)

    // A. Capture Customer Email
    if (req.body.customerEmail && invoiceData.invoiceeWalletAddress) {
      try {
        const existingProfile = await db.query.customerProfiles.findFirst({
          where: eq(schema.customerProfiles.customerWalletAddress, invoiceData.invoiceeWalletAddress)
        });

        if (existingProfile) {
          await db.update(schema.customerProfiles)
            .set({ customerEmail: req.body.customerEmail })
            .where(eq(schema.customerProfiles.id, existingProfile.id));
        } else {
          await db.insert(schema.customerProfiles).values({
            customerWalletAddress: invoiceData.invoiceeWalletAddress,
            businessWalletAddress: authenticatedWallet,
            customerEmail: req.body.customerEmail,
            customerName: "New Customer",
            totalInvoicesSent: 1,
            totalAmountInvoiced: calculatedTotal.toString()
          });
        }
      } catch (profileErr) {
        logger.warn("Failed to save customer email", "invoice", { error: profileErr });
      }
    }

    // B. Credit Score Update
    try {
      const { creditScoringService } = await import("./credit-scoring-service");
      creditScoringService.updateScoreOnInvoiceCreated({
        invoicerWalletAddress: invoice.invoicerWalletAddress,
        invoiceeWalletAddress: invoice.invoiceeWalletAddress,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      }).catch(err => logger.warn("Credit score update failed", "credit", { error: err.message }));
    } catch (creditErr) {
      logger.warn("Credit scoring service unavailable", "credit", { error: creditErr });
    }

    // C. Arcium Encryption
    if (req.body.encryptWithArcium) {
      if (!req.body.allowedParties || req.body.allowedParties.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Privacy Error: allowedParties (Invoicer + Invoicee) must be specified for Arcium encryption."
        });
      }

      try {
        const arciumService = getArciumService();
        if (!arciumService.isAvailable()) {
          throw new Error("Arcium Confidential Computing service is unavailable");
        }

        const encryptedResult = await arciumService.encryptTransaction(
          {
            amount: invoice.totalAmount,
            tokenAmount: invoice.totalAmount,
            fromAddress: invoice.invoicerWalletAddress,
            toAddress: invoice.invoiceeWalletAddress,
            txSignature: invoice.invoiceNumber,
            timestamp: Date.now(),
            description: invoice.description || "",
            paymentTerms: invoice.paymentTerms || "",
            notes: invoice.notes || "",
            items: (lineItems || []).map((item: any) => ({
              description: item.description,
              quantity: new Decimal(item.quantity).toNumber(),
              price: new Decimal(item.unitPrice).toNumber()
            })),
          },
          req.body.allowedParties
        );

        if (encryptedResult.success) {
          // 1. Update Invoice with Encrypted Blob AND SCRUB plaintext
          await invoiceStorage.updateInvoice(invoice.id, {
            isArciumEncrypted: true,
            arciumEncryptedData: encryptedResult.encryptedData,
            arciumEncryptionKey: encryptedResult.encryptionKey,
            arciumComputationId: encryptedResult.mxeComputationId,
            arciumAllowedParties: req.body.allowedParties,
            // PRIVACY SCRUBBING
            description: "🔒 Encrypted Invoice Data",
            notes: "Details are encrypted using Arcium Confidential Computing.",
            paymentTerms: "Confidential",
          });
          invoice.isArciumEncrypted = true;

          // 2. Scrub Line Items (Replace with single placeholder to maintain subtotal)
          // We must delete all existing items and replace with one aggregated placeholder
          await db.delete(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoice.id));

          await db.insert(schema.invoiceLineItems).values({
            invoiceId: invoice.id,
            lineNumber: 1,
            description: "🔒 Encrypted Services",
            quantity: "1",
            unitPrice: invoice.subtotal, // Maintain connection to subtotal for basic display validity, but hide details
            lineTotal: invoice.subtotal,
          });

        } else {
          throw new Error(`Encryption failed: ${encryptedResult.error}`);
        }
      } catch (arciumError: any) {
        console.error("Arcium Encryption Failed:", arciumError.message);
        try {
          await invoiceStorage.deleteInvoice(invoice.id);
        } catch (deleteErr) { /* ignore */ }

        return res.status(503).json({
          success: false,
          message: `Confidential Computing Error: ${arciumError.message}. The invoice was not created to protect your privacy.`
        });
      }
    }

    // D. Create On-Chain Arcium Invoice Account (for marketplace support)
    // This derives the PDA that marketplace will need for listing
    if (process.env.ENABLE_ARCIUM_ENCRYPTION === "true") {
      try {
        const arciumOnChainService = getArciumOnChainService();
        const invoicePda = arciumOnChainService.getInvoicePdaPreview(
          invoice.invoicerWalletAddress,
          invoice.id
        );
        // Store the derived PDA - actual account creation happens when listing on marketplace
        await invoiceStorage.updateInvoice(invoice.id, {
          arciumInvoicePda: invoicePda,
        } as any);
        invoice.arciumInvoicePda = invoicePda;
        logger.info("Arcium invoice PDA derived", "arcium-onchain", {
          invoiceId: invoice.id,
          pda: invoicePda,
        });
      } catch (arciumOnChainErr: any) {
        logger.warn("Failed to derive Arcium invoice PDA", "arcium-onchain", {
          error: arciumOnChainErr.message,
        });
        // Non-blocking - invoice can still be created without on-chain account
      }
    }

    // Track invoice creation metrics
    const { recordInvoiceCreated } = await import('./metrics-service');
    recordInvoiceCreated(
      invoice.currency,
      invoice.status,
      invoice.isPrivate || false
    );

    // Emit INVOICE_CREATED webhook
    emitWebhookEvent(
      authenticatedWallet,
      WEBHOOK_EVENTS.INVOICE_CREATED,
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
        createdAt: new Date().toISOString()
      }
    ).catch((err) => logger.error("Failed to emit invoice.created webhook", "webhook", { error: err }));

    // 7. Response
    res.status(201).json({
      success: true,
      invoice,
      lineItems: lineItems || [],
      nftMinted: !!invoice.nftMint,
      message: "Invoice created successfully" + (invoice.nftMint ? " with NFT" : ""),
    });
  }));

  /**
   * Get invoices for authenticated wallet
   * GET /api/invoices?wallet=xxx
   */
  app.get("/api/invoices", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Prioritize session wallet over query param for security, though logic allows query param context
    // for filtering (e.g. "as invoicer" vs "as invoicee" if we supported that granularity).
    // Here we just use the authenticated wallet.
    const walletAddress = req.authenticatedWallet || req.query.wallet as string;

    const filters = {
      status: req.query.status as string | undefined,
      currency: req.query.currency as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    // Get invoices where user is invoicer OR invoicee (Optimized single query)
    const invoices = await invoiceStorage.getInvoicesForUser(walletAddress, filters);

    res.json({
      success: true,
      invoices,
      count: invoices.length,
    });
  }));

  /**
   * Get single invoice by ID
   * GET /api/invoices/:id
   * Public access for non-private, non-draft invoices
   * Authenticated access for invoicer/invoicee
   */
  app.get("/api/invoices/:id", asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const invoice = await invoiceStorage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Check if user is authenticated
    const walletAddress = req.session?.walletAddress || req.authenticatedWallet;

    if (walletAddress) {
      // Authenticated: verify access (invoicer or invoicee)
      const hasAccess =
        invoice.invoicerWalletAddress === walletAddress ||
        invoice.invoiceeWalletAddress === walletAddress;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: You don't have access to this invoice"
        });
      }
    } else {
      // Public Access: Only allow non-private, non-draft invoices
      const isPublicAccessible = !invoice.isPrivate && invoice.status !== "draft";

      if (!isPublicAccessible) {
        return res.status(403).json({
          success: false,
          message: "Authentication required: This invoice is private or in draft"
        });
      }
    }

    // Fetch line items
    let lineItems = await invoiceStorage.getLineItems(invoice.id);

    // --- ARCIUM DECRYPTION ---
    if (invoice.isArciumEncrypted && invoice.arciumEncryptedData && invoice.arciumEncryptionKey) {
      // Check if user is authorized (Invoicer, Invoicee, or Marketplace Buyer) to view decrypted data
      // PRIVACY FIX: Include nftTransferredTo for marketplace buyers who now own the invoice
      const authorizedParties = [
        ...(invoice.arciumAllowedParties || []),
        invoice.invoicerWalletAddress,
        invoice.invoiceeWalletAddress,
        (invoice as any).nftTransferredTo, // Marketplace buyer (new owner after purchase)
      ].filter(Boolean); // Remove null/undefined
      const canDecrypt = walletAddress && authorizedParties.includes(walletAddress);

      if (canDecrypt) {
        try {
          const arciumService = getArciumService();
          if (arciumService.isAvailable()) {
            const decryptedData = await arciumService.decryptTransaction(
              invoice.arciumEncryptedData,
              invoice.arciumEncryptionKey
            );

            if (decryptedData) {
              // Restore scrubbed fields for response
              invoice.description = decryptedData.description || invoice.description;
              invoice.notes = decryptedData.notes || invoice.notes;
              invoice.paymentTerms = decryptedData.paymentTerms || invoice.paymentTerms;

              // Restore line items
              if (decryptedData.items && Array.isArray(decryptedData.items)) {
                lineItems = decryptedData.items.map((item, idx) => ({
                  id: `virtual-${idx}`,
                  invoiceId: invoice.id,
                  description: item.description,
                  quantity: item.quantity.toString(),
                  unitPrice: item.price.toString(),
                  lineTotal: new Decimal(item.quantity).times(item.price).toString(),
                  lineNumber: idx + 1,
                  createdAt: new Date(),
                  sku: null,
                  category: null,
                  taxRate: null,
                  discountRate: null
                }));
              }
            }
          }
        } catch (decryptErr) {
          logger.error("Failed to decrypt invoice data", "arcium", { error: decryptErr });
          // Fallback to encrypted/scrubbed data
        }
      }
    }

    res.json({
      success: true,
      invoice: {
        ...invoice,
        lineItems,
      },
    });
  }));

  /**
   * Get invoice by invoice number
   * GET /api/invoices/number/:invoiceNumber?wallet=xxx
   * NOTE: Requires authentication to prevent invoice number guessing attacks
   */
  app.get("/api/invoices/number/:invoiceNumber", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceNumber } = req.params;
    const walletAddress = req.authenticatedWallet;

    const invoice = await invoiceStorage.getInvoiceByNumber(invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Verify access
    if (walletAddress) {
      const hasAccess =
        invoice.invoicerWalletAddress === walletAddress ||
        invoice.invoiceeWalletAddress === walletAddress;

      if (!hasAccess) {
        return res.status(403).json({
          message: "Unauthorized: You don't have access to this invoice"
        });
      }
    } else {
      // Public Access Rules matching GET /api/invoices/:id
      const isPublicAccessible = !invoice.isPrivate && invoice.status !== "draft";

      if (!isPublicAccessible) {
        return res.status(403).json({
          message: "Authentication required: This invoice is private or in draft"
        });
      }
    }

    let lineItems = await invoiceStorage.getLineItems(invoice.id);

    // --- ARCIUM DECRYPTION (Duplicate logic for number lookup) ---
    if (invoice.isArciumEncrypted && invoice.arciumEncryptedData && invoice.arciumEncryptionKey) {
      // PRIVACY FIX: Include nftTransferredTo for marketplace buyers who now own the invoice
      const authorizedParties = [
        ...(invoice.arciumAllowedParties || []),
        invoice.invoicerWalletAddress,
        invoice.invoiceeWalletAddress,
        (invoice as any).nftTransferredTo, // Marketplace buyer (new owner after purchase)
      ].filter(Boolean); // Remove null/undefined
      const canDecrypt = walletAddress && authorizedParties.includes(walletAddress);

      if (canDecrypt) {
        try {
          const arciumService = getArciumService();
          if (arciumService.isAvailable()) {
            const decryptedData = await arciumService.decryptTransaction(
              invoice.arciumEncryptedData,
              invoice.arciumEncryptionKey
            );

            if (decryptedData) {
              invoice.description = decryptedData.description || invoice.description;
              invoice.notes = decryptedData.notes || invoice.notes;
              invoice.paymentTerms = decryptedData.paymentTerms || invoice.paymentTerms;
              if (decryptedData.items && Array.isArray(decryptedData.items)) {
                lineItems = decryptedData.items.map((item, idx) => ({
                  id: `virtual-${idx}`,
                  invoiceId: invoice.id,
                  description: item.description,
                  quantity: item.quantity.toString(),
                  unitPrice: item.price.toString(),
                  lineTotal: new Decimal(item.quantity).times(item.price).toString(),
                  lineNumber: idx + 1,
                  createdAt: new Date(),
                  sku: null,
                  category: null,
                  taxRate: null,
                  discountRate: null
                }));
              }
            }
          }
        } catch (decryptErr) {
          logger.error("Failed to decrypt invoice (by number)", "arcium", { error: decryptErr });
        }
      }
    }

    res.json({
      success: true,
      invoice: {
        ...invoice,
        lineItems,
      },
    });
  }));

  /**
   * Update invoice
   * PATCH /api/invoices/:id?wallet=xxx
   */
  app.patch("/api/invoices/:id", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const walletAddress = req.authenticatedWallet!;

    const invoice = await invoiceStorage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Only invoicer can update
    if (invoice.invoicerWalletAddress !== walletAddress) {
      return res.status(403).json({
        message: "Unauthorized: Only the invoicer can update this invoice"
      });
    }

    // Don't allow updating paid invoices
    if (invoice.status === "paid") {
      return res.status(400).json({
        message: "Cannot update a paid invoice"
      });
    }

    const updateSchema = (insertInvoiceSchema as any).partial().omit({
      invoicerWalletAddress: true,
    });

    const updates = updateSchema.parse(req.body);
    const updated = await invoiceStorage.updateInvoice(id, updates);

    // --- EMAIL NOTIFICATION LOGIC ---
    if (req.body.status === "sent") {
      try {
        // Fetch full invoice details for email
        const fullInvoice = await invoiceStorage.getInvoice(id);

        if (fullInvoice && fullInvoice.invoiceeWalletAddress) {
          // Attempt to find customer email from profile (if exists) or just log it
          // For now, since we don't have a guaranteed email, we'll assume a placeholder or check customer profile

          // Try to find customer profile details linked to this invoicee wallet
          // This is a "best effort" look up
          const customerProfile = await db.query.customerProfiles.findFirst({
            where: eq(schema.customerProfiles.customerWalletAddress, fullInvoice.invoiceeWalletAddress)
          });

          // Fetch Business Profile for invoicer
          const businessProfile = await invoiceStorage.getBusinessProfile(fullInvoice.invoicerWalletAddress);

          // PRIORITY:
          // 1. Explicit email provided in request (from "Send Invoice" dialog)
          // 2. Email from Customer Profile
          // 3. Skip if no valid email
          const emailTo = req.body.customerEmail || customerProfile?.customerEmail;

          // If a new customer email was provided, update the profile for future use
          if (req.body.customerEmail && customerProfile && customerProfile.customerEmail !== req.body.customerEmail) {
            await invoiceStorage.updateCustomerProfile(customerProfile.id, {
              customerEmail: req.body.customerEmail,
              updatedAt: new Date()
            } as any);
            logger.debug(`Updated customer profile email: ${req.body.customerEmail}`, "invoice");
          }

          // FIX: Skip email if no valid address instead of sending to placeholder
          if (!emailTo || emailTo === "customer@example.com" || !emailTo.includes("@")) {
            logger.debug("No valid customer email found, skipping notification", "invoice");
          } else {
            const emailService = getEmailService();
            await emailService.sendInvoiceEmail({
              to: emailTo,
              invoiceNumber: fullInvoice.invoiceNumber,
              amount: fullInvoice.totalAmount.toString(),
              currency: fullInvoice.currency,
              dueDate: new Date(fullInvoice.dueDate).toLocaleDateString(),
              payLink: `${process.env.FRONTEND_URL || "http://localhost:5000"}/pay/${fullInvoice.id}`,
              businessName: businessProfile?.businessName || "B2B Solana Invoicer",
              replyTo: businessProfile?.businessEmail || undefined
            });
          }
        }
      } catch (emailErr) {
        logger.error("Failed to trigger email notification", "invoice", { error: emailErr });
        // Don't fail the request, just log error
      }
    }
    // --------------------------------

    // --- EMIT WEBHOOK: INVOICE.SENT ---
    if (updates.status === 'sent') {
      emitWebhookEvent(
        invoice.invoicerWalletAddress,
        WEBHOOK_EVENTS.INVOICE_SENT,
        {
          invoiceId: id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          customerWallet: invoice.invoiceeWalletAddress,
          sentAt: new Date().toISOString()
        }
      ).catch(err => logger.error("Failed to emit invoice.sent webhook", "webhook", { error: err }));
    }
    // -------------------------------------

    res.json({
      success: true,
      invoice: updated,
      message: "Invoice updated successfully",
    });
  }));

  /**
   * Delete/Cancel invoice
   * DELETE /api/invoices/:id?wallet=xxx
   */
  app.delete("/api/invoices/:id", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const walletAddress = req.authenticatedWallet!;

    const invoice = await invoiceStorage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Only invoicer can delete
    if (invoice.invoicerWalletAddress !== walletAddress) {
      return res.status(403).json({
        message: "Unauthorized: Only the invoicer can delete this invoice"
      });
    }

    // Can only delete draft invoices
    if (invoice.status !== "draft") {
      // Instead of deleting, mark as cancelled
      await invoiceStorage.updateInvoice(id, {
        status: "cancelled",
        cancelledAt: new Date(),
      });

      // --- EMIT WEBHOOK: INVOICE.CANCELLED ---
      emitWebhookEvent(
        invoice.invoicerWalletAddress,
        WEBHOOK_EVENTS.INVOICE_CANCELLED,
        {
          invoiceId: id,
          invoiceNumber: invoice.invoiceNumber,
          reason: "user_cancelled",
          cancelledAt: new Date().toISOString()
        }
      ).catch(err => logger.error("Failed to emit invoice.cancelled webhook", "webhook", { error: err }));

      return res.json({
        success: true,
        message: "Invoice cancelled successfully",
      });
    }

    const success = await invoiceStorage.deleteInvoice(id);

    res.json({
      success,
      message: success ? "Invoice deleted successfully" : "Failed to delete invoice",
    });
  }));

  /**
   * Bulk Remind
   * POST /api/invoices/bulk-remind
   * Sends email reminders for multiple invoices
   */
  app.post("/api/invoices/bulk-remind", requireWalletOwnership, strictRateLimit, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceIds } = req.body;
    const walletAddress = req.authenticatedWallet!;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ message: "No invoice IDs provided" });
    }

    // Limit batch size
    if (invoiceIds.length > 20) {
      return res.status(400).json({ message: "Cannot send more than 20 reminders at once" });
    }

    let successCount = 0;
    let failCount = 0;

    // Fetch invoices to ensure ownership and get details
    // Optimized: Could use a "where id in (...)" query, but loop is acceptable for <20 items
    const emailService = getEmailService();
    // Pre-fetch business profile once
    const businessProfile = await invoiceStorage.getBusinessProfile(walletAddress);
    const businessName = businessProfile?.businessName || "B2B Solana Invoicer";
    const replyTo = businessProfile?.businessEmail || undefined;

    for (const id of invoiceIds) {
      try {
        const invoice = await invoiceStorage.getInvoice(id);
        if (!invoice || invoice.invoicerWalletAddress !== walletAddress) {
          failCount++;
          continue;
        }

        if (invoice.status === "paid" || invoice.status === "cancelled") {
          // Skip non-remindable statuses
          continue;
        }

        // Determine Email Address
        let emailTo: string | undefined;
        if (invoice.invoiceeWalletAddress) {
          const customerProfile = await db.query.customerProfiles.findFirst({
            where: eq(schema.customerProfiles.customerWalletAddress, invoice.invoiceeWalletAddress)
          });
          emailTo = customerProfile?.customerEmail ?? undefined;
          if (emailTo === null) emailTo = undefined;
        }

        if (!emailTo || !emailTo.includes("@")) {
          // Cannot remind without email
          logger.debug(`Skipping reminder for invoice ${invoice.invoiceNumber}: No email found`, "bulk-remind");
          failCount++;
          continue;
        }

        await emailService.sendInvoiceEmail({
          to: emailTo,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount.toString(),
          currency: invoice.currency,
          dueDate: new Date(invoice.dueDate).toLocaleDateString(),
          payLink: `${process.env.FRONTEND_URL || "http://localhost:5000"}/pay/${invoice.id}`,
          businessName,
          replyTo
        });

        successCount++;
      } catch (err) {
        logger.error(`Failed to remind invoice ${id}`, "bulk-remind", { error: err });
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Sent ${successCount} reminders`,
      details: { sent: successCount, failed: failCount }
    });
  }));



  /**
   * Get invoice statistics for a wallet
   * GET /api/invoices/stats?wallet=xxx
   */
  app.get("/api/invoices/stats", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Logic: Use authenticated wallet directly
    const walletAddress = req.authenticatedWallet!;
    const stats = await invoiceStorage.getInvoiceStats(walletAddress);

    res.json({
      success: true,
      stats,
    });
  }));

  // ============================================
  // LINE ITEM ROUTES
  // ============================================

  /**
   * Add line item to invoice
   * POST /api/invoices/:id/line-items
   */
  app.post("/api/invoices/:id/line-items", requireWalletOwnership, strictRateLimit, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const walletAddress = req.authenticatedWallet!;

    const invoice = await invoiceStorage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Only invoicer can add line items
    if (invoice.invoicerWalletAddress !== walletAddress) {
      return res.status(403).json({
        message: "Unauthorized: Only the invoicer can add line items"
      });
    }

    // Check max line items (DoS protection)
    const currentItems = await db.select().from(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, id));
    if (currentItems.length >= 100) {
      return res.status(400).json({ message: "Limit reached: Maximum 100 line items allowed per invoice" });
    }

    const validatedData = insertLineItemSchema.parse({
      ...req.body,
      invoiceId: id,
    });

    const lineItem = await invoiceStorage.createLineItem(validatedData);

    res.status(201).json({
      success: true,
      lineItem,
      message: "Line item added successfully",
    });
  }));

  /**
   * Update line item
   * PATCH /api/line-items/:id?wallet=xxx
   */
  app.patch("/api/line-items/:id", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const walletAddress = req.authenticatedWallet!;

    // Security Check: Ensure user owns the invoice this line item belongs to
    const lineItemResult = await db.select()
      .from(schema.invoiceLineItems)
      .innerJoin(schema.invoices, eq(schema.invoiceLineItems.invoiceId, schema.invoices.id))
      .where(eq(schema.invoiceLineItems.id, id))
      .limit(1);

    if (lineItemResult.length === 0) {
      return res.status(404).json({ message: "Line item not found" });
    }

    const { invoices: invoice } = lineItemResult[0];

    if (invoice.invoicerWalletAddress !== walletAddress) {
      return res.status(403).json({ message: "Unauthorized: You do not own this invoice" });
    }

    const updateLineItemSchema = insertLineItemSchema.partial().omit({
      invoiceId: true // Cannot move line items between invoices
    });

    const validatedUpdates = updateLineItemSchema.parse(req.body);
    const updated = await invoiceStorage.updateLineItem(id, validatedUpdates);

    res.json({
      success: true,
      lineItem: updated,
      message: "Line item updated successfully",
    });
  }));

  /**
   * Delete line item
   * DELETE /api/line-items/:id?wallet=xxx
   */
  app.delete("/api/line-items/:id", requireWalletOwnership, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const walletAddress = req.authenticatedWallet!;

    // Security Check: Ensure user owns the invoice this line item belongs to
    const lineItemResult = await db.select()
      .from(schema.invoiceLineItems)
      .innerJoin(schema.invoices, eq(schema.invoiceLineItems.invoiceId, schema.invoices.id))
      .where(eq(schema.invoiceLineItems.id, id))
      .limit(1);

    if (lineItemResult.length === 0) {
      return res.status(404).json({ message: "Line item not found" });
    }

    const { invoices: invoice } = lineItemResult[0];

    if (invoice.invoicerWalletAddress !== walletAddress) {
      return res.status(403).json({ message: "Unauthorized: You do not own this invoice" });
    }

    const success = await invoiceStorage.deleteLineItem(id);

    res.json({
      success,
      message: success ? "Line item deleted successfully" : "Failed to delete line item",
    });
  }));

  // ============================================
  // PAYMENT ROUTES
  // ============================================

  /**
  /**
   * Record a payment for an invoice
   * POST /api/payments
   */

  app.post("/api/payments", strictRateLimit, asyncHandler(async (req, res) => {
    const validation = insertPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      try {
        logger.warn("Payment validation failed", "invoice", { error: validation.error.flatten() });
      } catch (e) { console.error("Logger error", e); }

      return res.status(400).json({
        message: "Invalid payment data",
        errors: validation.error.flatten()
      });
    }
    const validatedData = validation.data;


    // Verify invoice exists
    const invoice = await invoiceStorage.getInvoice(validatedData.invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Verify payment currency matches invoice
    if (validatedData.currency !== invoice.currency) {
      return res.status(400).json({
        message: `Payment currency (${validatedData.currency}) must match invoice currency (${invoice.currency})`
      });
    }

    // SECURITY: Verify transaction on-chain
    // We must ensure the user actually sent the funds
    // Default payment method is "solana_transfer" for backward compatibility.
    // All on-chain payments (USDC, EURC, SOL) use "solana_transfer".
    // Manual/off-chain payments would specify "manual" or "bank_transfer".
    // Define verification result variable in scope accessible to createPayment
    let verification: any = null;

    if (validatedData.paymentMethod === "solana_transfer" || !validatedData.paymentMethod) {
      // If it's a crypto payment, verify it
      const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"));

      logger.info(`Verifying payment tx: ${validatedData.txSignature} for ${validatedData.amount} ${validatedData.currency}`, "invoice");
      logger.debug(`Payment Verification Input`, "invoice", {
        txSignature: validatedData.txSignature,
        amount: validatedData.amount,
        currency: validatedData.currency,
        fromAddress: validatedData.fromAddress,
        toAddress: validatedData.toAddress,
        invoiceId: validatedData.invoiceId,
      });

      // Platform Fee Enforcement (1%)
      // We verify that the transaction split funds: 99% to Seller, 1% to Platform
      const totalAmount = new Decimal(validatedData.amount);
      const feeRate = new Decimal("0.01");
      // Calculate fee using high-precision math
      const feeAmount = totalAmount.times(feeRate).toString();
      const recipientAmount = totalAmount.minus(feeAmount).toString();

      logger.debug(`Payment Amount Calculations`, "invoice", {
        totalAmount,
        feeRate,
        feeAmount,
        recipientAmount,
        recipientAddress: validatedData.toAddress,
        treasuryAddress: TREASURY_WALLET_ADDRESS,
      });

      // --- SECURITY FIX: Dynamic Payee Routing (Marketplace Support) ---
      const expectedRecipient = invoice.nftTransferredTo || invoice.invoicerWalletAddress;

      verification = await verifyStablecoinPayment(
        connection,
        validatedData.txSignature || "",
        recipientAmount, // Pass as string
        expectedRecipient, // FIX: Use current owner
        validatedData.currency || "",
        feeAmount || "0", // Pass as string
        TREASURY_WALLET_ADDRESS
      );

      if (!verification.verified) {
        logger.error(`Payment verification failed`, "invoice", { verification });
        return res.status(400).json({
          message: `Payment verification failed: ${verification.error || "Transaction invalid"}`
        });
      }

      // --- SECURITY FIX: Payer Authorization ---
      if (verification.fromAddress !== invoice.invoiceeWalletAddress) {
        logger.warn("Unauthorized manual payment attempt", "security", {
          invoiceId: invoice.id,
          attemptedBy: verification.fromAddress,
          authorizedPayer: invoice.invoiceeWalletAddress
        });
        return res.status(403).json({
          message: "Unauthorized: Only the designated recipient can pay this invoice"
        });
      }

      logger.info("Payment Verified On-Chain", "invoice", { verification });

      // Global Replay Protection (checking across ALL payment types)
      const isReplay = await invoiceStorage.isSignatureUsed(validatedData.txSignature);
      if (isReplay) {
        return res.status(400).json({ message: "This transaction signature has already been used in another context (e.g. service fee or other payment)." });
      }
    } else {
      // MANUAL PAYMENT (e.g. Cash, Bank Transfer)
      // Only the Invoicer can record manual payments.
      // We need to check authentication manually here since the route is public for crypto payments.

      // Check session (assuming logic from requireWalletOwnership or similar)
      const session = req.session;
      if (!session || !session.walletAddress) {
        return res.status(401).json({ message: "Authentication required for manual payments" });
      }

      if (session.walletAddress !== invoice.invoicerWalletAddress) {
        return res.status(403).json({ message: "Unauthorized: Only the invoicer can record manual payments" });
      }
    }

    // Create payment (this auto-updates invoice status)
    // Pass the new accounting fields
    const payment = await invoiceStorage.createPayment({
      ...validatedData,
      // FIX R2-Verify: Use verified verified on-chain amount if available
      amount: (verification && verification.verified) ? verification.amount : validatedData.amount,
      // paymentNumber: `PAY-${Date.now()}`, // Removed as it doesn't exist in schema
      usdValueAtPayment: validatedData.usdValueAtPayment || undefined, // explicit pass
      isBusinessExpense: validatedData.isBusinessExpense || false,
    });

    // Get updated invoice
    const updatedInvoice = await invoiceStorage.getInvoice(validatedData.invoiceId);

    // --- METRICS TRACKING ---
    const { recordPaymentProcessed } = await import('./metrics-service');
    recordPaymentProcessed(
      payment.currency,
      'crypto',
      'success',
      parseFloat(payment.usdValueAtPayment || '0')
    );

    // --- WEBHOOK EMISSION ---
    if (updatedInvoice) {
      const eventType = updatedInvoice.status === 'paid'
        ? WEBHOOK_EVENTS.INVOICE_PAID
        : WEBHOOK_EVENTS.INVOICE_PARTIAL_PAID;

      emitWebhookEvent(
        invoice.invoicerWalletAddress,
        eventType,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          txSignature: payment.txSignature,
          payer: verification?.fromAddress || validatedData.fromAddress,
          timestamp: new Date().toISOString()
        }
      ).catch(err => logger.error("Failed to emit payment webhook", "webhook", { error: err }));
    }

    // --- CREDIT SCORE UPDATE (Crypto Payments Only) ---
    if (verification && verification.verified) {
      try {
        const { creditScoringService } = await import("./credit-scoring-service");
        await creditScoringService.updateScoreOnPayment({
          fromAddress: verification.fromAddress,
          toAddress: invoice.invoicerWalletAddress,
          amount: payment.amount,
          invoiceDueDate: new Date(invoice.dueDate),
          paidAt: new Date(),
        }).catch(err => logger.warn("Credit score update failed", "credit", { error: err }));
      } catch (creditErr) {
        logger.warn("Credit scoring service unavailable", "credit", { error: creditErr });
      }
    }

    // --- EMAIL RECEIPT LOGIC ---
    if (updatedInvoice && updatedInvoice.invoiceeWalletAddress) {
      try {
        // Best effort customer email lookup
        const customerProfile = await db.query.customerProfiles.findFirst({
          where: eq(schema.customerProfiles.customerWalletAddress, updatedInvoice.invoiceeWalletAddress)
        });

        const emailTo = customerProfile?.customerEmail;

        // FIX: Skip email if no valid address instead of sending to placeholder
        if (!emailTo || emailTo === "customer@example.com" || !emailTo.includes("@")) {
          logger.debug("No valid customer email found, skipping receipt notification", "invoice");
        } else {
          const emailService = getEmailService();

          // Fetch Business Profile for invoicer
          const businessProfile = await invoiceStorage.getBusinessProfile(updatedInvoice.invoicerWalletAddress);

          await emailService.sendPaymentReceiptEmail({
            to: emailTo,
            invoiceNumber: updatedInvoice.invoiceNumber,
            amountPaid: validatedData.amount.toString(), // amount is string or decimal
            currency: updatedInvoice.currency,
            paymentDate: new Date().toLocaleDateString(),
            transactionSignature: validatedData.txSignature,
            businessName: businessProfile?.businessName || "B2B Solana Invoicer",
            replyTo: businessProfile?.businessEmail || undefined
          });
        }
      } catch (emailErr: any) {
        logger.error("Failed to trigger receipt email", "invoice", { error: emailErr });
      }
    }
    // ---------------------------

    // --- RECEIPT NFT MINTING ---
    try {
      const { getInvoiceNFTService } = await import("./nft-service");
      const nftService = getInvoiceNFTService();

      if (nftService.isReady() && updatedInvoice) {
        logger.info(`Minting Receipt NFT for payment ${validatedData.txSignature}...`, "nft");

        const receiptResult = await nftService.mintPaymentReceiptNFT({
          payment: payment as any,
          invoice: updatedInvoice,
          recipientAddress: validatedData.fromAddress || "" // Payer receives the receipt NFT, fallback to empty string if missing
        });

        logger.info(`Receipt NFT Minted: ${receiptResult.mint}`, "nft");

        // Update payment record with NFT mint info
        await db.update(schema.payments)
          .set({ nftReceiptMinted: true })
          .where(eq(schema.payments.txSignature, validatedData.txSignature));
      } else {
        logger.warn(`Skipped Receipt NFT - NFT Service not ready or invoice not found`, "nft");
      }
    } catch (nftErr: any) {
      logger.error("Failed to mint receipt NFT", "nft", { error: nftErr });
      // Don't fail the payment if NFT minting fails - it's a non-critical feature
    }
    // ---------------------------

    res.status(201).json({
      success: true,
      payment,
      invoice: updatedInvoice,
      message: "Payment recorded successfully",
    });
  }));

  /**
   * Get payments for an invoice
   * GET /api/invoices/:id/payments?wallet=xxx
   */
  /**
   * Get payments for an invoice
   * GET /api/invoices/:id/payments?wallet=xxx
   */
  app.get("/api/invoices/:id/payments", requireWalletOwnership, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const walletAddress = req.query.wallet as string;

    const invoice = await invoiceStorage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Verify access
    const hasAccess =
      invoice.invoicerWalletAddress === walletAddress ||
      invoice.invoiceeWalletAddress === walletAddress;

    if (!hasAccess) {
      return res.status(403).json({
        message: "Unauthorized: You don't have access to this invoice's payments"
      });
    }

    const payments = await invoiceStorage.getPaymentsByInvoice(id);

    res.json({
      success: true,
      payments,
      count: payments.length,
    });
  }));

  /**
   * Get payments for a wallet
   * GET /api/payments?wallet=xxx
   * Already has requireWalletOwnership middleware
   */
  app.get("/api/payments", requireWalletOwnership, asyncHandler(async (req, res) => {
    const walletAddress = req.query.wallet as string;
    const payments = await invoiceStorage.getPaymentsByWallet(walletAddress);

    res.json({
      success: true,
      payments,
      count: payments.length,
    });
  }));

  // ============================================
  // PUBLIC STATS ROUTES
  // ============================================

  /**
   * Get global system statistics
   * GET /api/public-stats
   */
  /**
   * Get global system statistics
   * GET /api/public-stats
   */
  app.get("/api/public-stats", asyncHandler(async (req, res) => {
    const stats = await invoiceStorage.getGlobalStats();
    res.json(stats);
  }));


  // ============================================
  // PUBLIC STATS (ANONYMIZED)
  // ============================================

  /**
   * Get public invoice statistics
   * GET /api/public/invoice-stats
   */
  app.get("/api/public/invoice-stats", async (req, res) => {
    try {
      // Return only aggregated, anonymized stats
      // This would need to be implemented in storage layer
      res.json({
        success: true,
        stats: {
          message: "Public stats endpoint - to be implemented",
          // totalPublicInvoices: 0,
          // totalPaymentsProcessed: 0,
          // averagePaymentTime: 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // End of invoice routes


  // ============================================
  // SECURE NFT METADATA ROUTES
  // ============================================

  // Rate Limiting: 10 requests per minute per IP to prevent enumeration
  const metadataLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many metadata requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  /**
   * GET /api/nft-metadata/:identifier
   * 
   * SECURED ENDPOINT:
   * 1. Requires Authentication (Wallet ownership/Session)
   * 2. Enforces Access Control (Only Invocer/Invoicee/Buyer)
   * 3. Enforces Privacy (hideAmounts, hideParties)
   * 4. Logs Access
   */
  app.get("/api/nft-metadata/:identifier",
    metadataLimiter,
    requireWalletOwnership,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { identifier } = req.params;
      const walletAddress = req.authenticatedWallet!;
      const userIp = req.ip || 'unknown';

      const nftService = getInvoiceNFTService();

      try {
        if (identifier.startsWith("invoice-")) {
          const id = identifier.replace("invoice-", "");
          const invoice = await invoiceStorage.getInvoice(id);

          if (!invoice) {
            await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: false, ipAddress: userIp, details: "Invoice NOT FOUND" });
            return res.status(404).json({ message: "Invoice not found" });
          }

          // --- ACCESS CONTROL CHECK ---
          // Access granted if:
          // 1. User is Invoicer
          // 2. User is Invoicee
          // 3. User is authorized Buyer/Auditor (future: add logic for this)
          const hasAccess =
            invoice.invoicerWalletAddress === walletAddress ||
            invoice.invoiceeWalletAddress === walletAddress;
          // TODO: Add Marketplace Buyer check here if sold

          if (!hasAccess) {
            await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: false, ipAddress: userIp, details: "UNAUTHORIZED" });
            return res.status(403).json({ message: "Access denied: You are not a party to this invoice" });
          }

          // --- PRIVACY ENFORCEMENT ---
          // Even if authorized, strictly enforce privacy flags in the metadata itself
          // This ensures that even if the JSON leaks, critical data is respect

          // Modify metadata generation to respect flags
          const metadata = nftService.generateInvoiceMetadata(invoice);

          await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: true, ipAddress: userIp });
          return res.json(metadata);
        }

        if (identifier.startsWith("payment-")) {
          const id = identifier.replace("payment-", "");

          const paymentList = await db.select().from(schema.payments).where(eq(schema.payments.id, id));
          const payment = paymentList[0];

          if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
          }

          const invoice = await invoiceStorage.getInvoice(payment.invoiceId as string);
          if (!invoice) {
            return res.status(404).json({ message: "Associated invoice not found" });
          }

          // --- ACCESS CONTROL ---
          // Only Payer (fromAddress) or Payee (invoicer) or Invoicee (if different from payer)
          const hasAccess =
            invoice.invoicerWalletAddress === walletAddress ||
            invoice.invoiceeWalletAddress === walletAddress ||
            payment.fromAddress === walletAddress;

          if (!hasAccess) {
            await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: false, ipAddress: userIp, details: "UNAUTHORIZED Payment View" });
            return res.status(403).json({ message: "Access denied" });
          }

          const metadata = nftService.generatePaymentReceiptMetadata(payment as any, invoice as any);
          await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: true, ipAddress: userIp });
          return res.json(metadata);
        }

        if (identifier.startsWith("business-")) {
          const id = identifier.replace("business-", "");
          // Business profiles are generally public-ish, but let's log it
          // TODO: Decide if business profiles should be restricted. 
          // For now, allow public read but rate limited.
          // IF we want to restrict, check ownerWalletAddress === walletAddress

          const profileList = await db.select().from(schema.businessProfiles).where(eq(schema.businessProfiles.id, id));
          if (profileList.length === 0) {
            return res.status(404).json({ success: false, message: "Business profile not found" });
          }
          const profile = profileList[0];

          // Fetch Arcium Identity
          const nftRecord = await db.select().from(schema.businessIdentityNFTs).where(eq(schema.businessIdentityNFTs.businessProfileId, id));
          const level = nftRecord[0]?.verificationLevel || "verified";

          const metadata = nftService.generateBusinessIdentityMetadata(profile as any, level);

          // Log but allow (Business Identity is meant to be public trust signal)
          await logMetadataAccess({ identifier, userWallet: walletAddress, accessGranted: true, ipAddress: userIp });
          return res.json(metadata);
        }

        return res.status(400).json({ message: "Invalid identifier format" });

      } catch (error: any) {
        logger.error(`Error serving metadata for ${req.params.identifier}`, "nft", { error });
        res.status(500).json({ message: error.message });
      }
    })
  );


}

