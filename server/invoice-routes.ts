/**
 * Invoice API Routes
 * 
 * Complete REST API for B2B invoicing system
 */

import type { Express } from "express";
import { logger } from "./logger";
import { invoiceStorage } from "./invoice-storage";
import { asyncHandler } from "./error-handler";
import { safeSubtract, safeAdd, safeMultiply } from "@shared/math";
import {
  insertInvoiceSchema,
  insertInvoiceWithItemsSchema,
  insertLineItemSchema,
  insertPaymentSchema,
  insertBusinessProfileSchema,
  insertCustomerProfileSchema,
  type Invoice
} from "@shared/invoice-schema";
import { fromZodError } from "zod-validation-error";
import { requireWalletOwnership, strictRateLimit } from "./security";
import { validateApiKey } from "./middleware/api-auth";
import { getArciumService, loadKeypairFromPrivateKey } from "./arcium-service";
import { getInvoiceNFTService } from "./nft-service";
import { getEmailService } from "./email-service"; // Import Email Service
import { emitWebhookEvent, WEBHOOK_EVENTS } from "./webhook-service";
import { db, schema } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { verifyStablecoinPayment } from "./stablecoin-payment-service";
import { getStablecoinConfig } from "@shared/stablecoin-config";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import {
  TREASURY_WALLET_ADDRESS,
  INVOICE_SERVICE_FEE_SOL,
  TOKEN_MINTS,
  DEFAULT_TOKEN_MINT,
  PLATFORM_FEE_RATE
} from "@shared/config";
import { registerDynamicImageRoutes } from "./endpoints/dynamic-image";

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
export function registerInvoiceRoutes(app: Express): void {

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
            items: (lineItems || []).map((item: any) => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              price: parseFloat(item.unitPrice)
            })),
          },
          req.body.allowedParties
        );

        if (encryptedResult.success) {
          await invoiceStorage.updateInvoice(invoice.id, {
            isArciumEncrypted: true,
            arciumEncryptedData: encryptedResult.encryptedData,
            arciumEncryptionKey: encryptedResult.encryptionKey,
            arciumComputationId: encryptedResult.mxeComputationId,
            arciumAllowedParties: req.body.allowedParties,
          });
          invoice.isArciumEncrypted = true;
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

    // D. Emit Webhook
    emitWebhookEvent(
      authenticatedWallet,
      WEBHOOK_EVENTS.INVOICE_CREATED,
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        customerWallet: invoice.invoiceeWalletAddress,
        status: invoice.status
      }
    ).catch(err => logger.error("Failed to emit invoice.created webhook", "webhook", { error: err }));

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

    const lineItems = await invoiceStorage.getLineItems(invoice.id);

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

          // PRIORITY:
          // 1. Explicit email provided in request (from "Send Invoice" dialog)
          // 2. Email from Customer Profile
          // 3. Skip if no valid email (FIX: don't send to placeholder)
          const emailTo = req.body.customerEmail || customerProfile?.customerEmail;

          // FIX: Skip email if no valid address instead of sending to example.com
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
              businessName: "B2B Solana Invoicer" // Ideally fetch from business profile
            });
          }
        }
      } catch (emailErr) {
        logger.error("Failed to trigger email notification", "invoice", { error: emailErr });
        // Don't fail the request, just log error
      }
    }
    // --------------------------------

    // --- EMIT WEBHOOK: INVOICE.UPDATED ---
    // NOTE: INVOICE_UPDATED webhook intentionally not implemented.
    // invoice.sent event already covers the primary state change.
    // Generic updates (description, notes) don't warrant webhook notification.
    /*
    emitWebhookEvent(
      invoice.invoicerWalletAddress,
      // @ts-ignore - Event type not yet defined
      "invoice.updated",
      {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        status: updates.status || invoice.status,
        updatedFields: Object.keys(updates),
        timestamp: new Date().toISOString()
      }
    ).catch(err => logger.error("Failed to emit invoice.updated webhook", "webhook", { error: err }));
    */
    // -------------------------------------
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
    const validatedData = insertPaymentSchema.parse(req.body);

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
      const totalAmount = validatedData.amount; // Keep as string ensures no float loss from DB/Input
      const feeRate = "0.01";
      // Calculate fee using safe math which returns strings
      const feeAmount = safeMultiply(totalAmount, feeRate);
      const recipientAmount = safeSubtract(totalAmount, feeAmount);

      logger.debug(`Payment Amount Calculations`, "invoice", {
        totalAmount,
        feeRate,
        feeAmount,
        recipientAmount,
        recipientAddress: validatedData.toAddress,
        treasuryAddress: TREASURY_WALLET_ADDRESS,
      });

      const verification = await verifyStablecoinPayment(
        connection,
        validatedData.txSignature || "",
        recipientAmount, // Pass as string
        validatedData.toAddress || "",
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
      // paymentNumber: `PAY-${Date.now()}`, // Removed as it doesn't exist in schema
      usdValueAtPayment: validatedData.usdValueAtPayment || undefined, // explicit pass
      isBusinessExpense: validatedData.isBusinessExpense || false,
    });

    // Get updated invoice
    const updatedInvoice = await invoiceStorage.getInvoice(validatedData.invoiceId);

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

          await emailService.sendPaymentReceiptEmail({
            to: emailTo,
            invoiceNumber: updatedInvoice.invoiceNumber,
            amountPaid: validatedData.amount.toString(), // amount is string or decimal
            currency: updatedInvoice.currency,
            paymentDate: new Date().toLocaleDateString(),
            transactionSignature: validatedData.txSignature,
            businessName: "B2B Solana Invoicer" // Ideally fetch from business profile
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
  // BUSINESS PROFILE ROUTES
  // ============================================

  /**
   * Create or update business profile
   * POST /api/business/profile?wallet=xxx
   */
  /**
   * Create or update business profile
   * POST /api/business/profile?wallet=xxx
   */
  app.post("/api/business/profile", requireWalletOwnership, asyncHandler(async (req, res) => {
    const validatedData = insertBusinessProfileSchema.parse(req.body);

    // Check if profile exists
    const existing = await invoiceStorage.getBusinessProfile(validatedData.ownerWalletAddress);

    if (existing) {
      // Update existing
      const updated = await invoiceStorage.updateBusinessProfile(
        validatedData.ownerWalletAddress,
        validatedData
      );

      return res.json({
        success: true,
        profile: updated,
        message: "Business profile updated successfully",
      });
    }

    // Create new
    const profile = await invoiceStorage.createBusinessProfile(validatedData);

    res.status(201).json({
      success: true,
      profile,
      message: "Business profile created successfully",
    });
  }));

  /**
   * Get business profile
   * GET /api/business/profile?wallet=xxx
   */
  app.get("/api/business/profile", requireWalletOwnership, asyncHandler(async (req, res) => {
    const walletAddress = req.query.wallet as string;
    const profile = await invoiceStorage.getBusinessProfile(walletAddress);

    if (!profile) {
      return res.status(404).json({ message: "Business profile not found" });
    }

    res.json({
      success: true,
      profile,
    });
  }));

  /**
   * Mint Business Identity NFT
   * POST /api/business/mint-identity-nft?wallet=xxx
   * 
   * Mints a verified business credential NFT for the authenticated business
   */
  app.post("/api/business/mint-identity-nft", requireWalletOwnership, strictRateLimit, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const verificationLevel = req.body.verificationLevel || "basic"; // basic, verified, premium

      // Get business profile
      const profile = await invoiceStorage.getBusinessProfile(walletAddress);
      if (!profile) {
        return res.status(404).json({ message: "Business profile not found. Create a profile first." });
      }

      // Check if already has identity NFT (duplicate check)
      const hasExistingNFT = await invoiceStorage.hasBusinessIdentityNFT(profile.id);
      if (hasExistingNFT) {
        return res.status(400).json({
          message: "Business already has an identity NFT. Only one identity NFT per business is allowed."
        });
      }

      // Mint Business Identity NFT
      const nftService = getInvoiceNFTService();
      if (!nftService.isReady()) {
        return res.status(503).json({
          message: "NFT service not available. Please try again later."
        });
      }

      const identityResult = await nftService.mintBusinessIdentityNFT(
        profile,
        verificationLevel
      );

      // Get business stats for NFT metadata
      const stats = await invoiceStorage.getInvoiceStats(profile.ownerWalletAddress);

      // Store identity NFT in database
      await invoiceStorage.createBusinessIdentityNFT({
        businessProfileId: profile.id,
        nftMint: identityResult.mint,
        nftMetadataUri: `${process.env.API_URL}/nft-metadata/business-${profile.id}`,
        nftOwner: profile.ownerWalletAddress,
        verificationLevel,
        verifiedBy: req.body.verifiedBy || "Self-Verified",
        verificationDate: new Date(),
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        totalInvoicesIssued: stats.totalInvoices,
        totalRevenueProcessed: stats.totalAmount.toString(),
        businessRating: undefined, // Could be calculated from payment history
        nftMintSignature: identityResult.signature,
      });

      res.status(201).json({
        success: true,
        identityNFT: {
          mint: identityResult.mint,
          signature: identityResult.signature,
          owner: profile.ownerWalletAddress,
          verificationLevel,
        },
        message: `Business identity NFT minted successfully (${verificationLevel} verification)`,
      });
    } catch (error: any) {
      logger.error("Failed to mint business identity NFT", "invoice", { error });
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // CUSTOMER PROFILE ROUTES
  // ============================================

  /**
   * Create customer profile
   * POST /api/customers?wallet=xxx
   */
  app.post("/api/customers", requireWalletOwnership, async (req, res) => {
    try {
      const validatedData = insertCustomerProfileSchema.parse(req.body);

      // Check if customer already exists
      const existing = await invoiceStorage.getCustomerProfile(
        validatedData.businessWalletAddress,
        validatedData.customerWalletAddress
      );

      if (existing) {
        return res.status(400).json({
          message: "Customer already exists for this business"
        });
      }

      const customer = await invoiceStorage.createCustomerProfile(validatedData);

      res.status(201).json({
        success: true,
        customer,
        message: "Customer profile created successfully",
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get all customers for a business
   * GET /api/customers?wallet=xxx
   */
  app.get("/api/customers", requireWalletOwnership, async (req, res) => {
    try {
      const businessWallet = req.query.wallet as string;
      const customers = await invoiceStorage.getCustomerProfiles(businessWallet);

      res.json({
        success: true,
        customers,
        count: customers.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get customer statistics
   * GET /api/customers/:customerWallet/stats?wallet=xxx
   */
  app.get("/api/customers/:customerWallet/stats", requireWalletOwnership, async (req, res) => {
    try {
      const { customerWallet } = req.params;
      const businessWallet = req.query.wallet as string;

      const stats = await invoiceStorage.getCustomerStats(businessWallet, customerWallet);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Update customer profile
   * PATCH /api/customers/:id?wallet=xxx
   */
  app.patch("/api/customers/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await invoiceStorage.updateCustomerProfile(id, req.body);

      if (!updated) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({
        success: true,
        customer: updated,
        message: "Customer profile updated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Delete customer profile
   * DELETE /api/customers/:id?wallet=xxx
   */
  app.delete("/api/customers/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await invoiceStorage.deleteCustomerProfile(id);

      res.json({
        success,
        message: success ? "Customer deleted successfully" : "Failed to delete customer",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  // ============================================
  // NFT QUERY ENDPOINTS
  // ============================================

  /**
   * Get all NFTs for a user
   * GET /api/nfts?wallet=xxx
   */
  app.get("/api/nfts", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const nfts = await invoiceStorage.getAllUserNFTs(walletAddress);

      res.json({
        success: true,
        nfts,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get payment receipt NFTs for a user
   * GET /api/nfts/receipts?wallet=xxx
   */
  app.get("/api/nfts/receipts", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const receipts = await invoiceStorage.getPaymentReceiptNFTs(walletAddress);

      res.json({
        success: true,
        receipts,
        count: receipts.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get business identity NFT
   * GET /api/nfts/identity?wallet=xxx
   */
  app.get("/api/nfts/identity", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const identity = await invoiceStorage.getBusinessIdentityNFT(walletAddress);

      if (!identity) {
        return res.status(404).json({ message: "No business identity NFT found" });
      }

      res.json({
        success: true,
        identity,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // NFT METADATA ENDPOINTS
  // ============================================

  /**
   * Get NFT metadata for invoice
   * GET /nft-metadata/invoice/:id
   */
  app.get("/nft-metadata/invoice/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await invoiceStorage.getInvoice(id);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const nftService = getInvoiceNFTService();
      const metadata = nftService.generateInvoiceMetadata(invoice);
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get NFT metadata for payment receipt
   * GET /nft-metadata/payment/:id
   */
  app.get("/nft-metadata/payment/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const paymentData = await db.select().from(schema.payments).where(eq(schema.payments.id, id)).limit(1).then((r: any[]) => r[0]);

      if (!paymentData) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const invoice = await invoiceStorage.getInvoice(paymentData.invoiceId);

      const nftService = getInvoiceNFTService();
      const metadata = nftService.generatePaymentReceiptMetadata(paymentData as any, invoice as any);
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get NFT metadata for business identity
   * GET /nft-metadata/business/:id
   */
  app.get("/nft-metadata/business/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const businessData = await db.select().from(schema.businessProfiles).where(eq(schema.businessProfiles.id, id)).limit(1).then(r => r[0]);

      if (!businessData) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const identity = await db.select().from(schema.businessIdentityNFTs)
        .where(eq(schema.businessIdentityNFTs.businessProfileId, id))
        .orderBy(desc(schema.businessIdentityNFTs.createdAt))
        .limit(1).then(r => r[0]);

      const verificationLevel = identity?.verificationLevel || "basic";

      const nftService = getInvoiceNFTService();
      const metadata = nftService.generateBusinessIdentityMetadata(businessData as any, verificationLevel);
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // INVOICE TEMPLATE ROUTES
  // ============================================

  /**
   * Create a new invoice template
   * POST /api/templates
   */
  app.post("/api/templates", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const { name, description, defaultCurrency, defaultPaymentTerms, defaultDueDays, defaultLineItems } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Template name is required" });
      }

      // Get token mint for currency
      const stablecoin = getStablecoinConfig(defaultCurrency || "USDC");
      const tokenMint = stablecoin?.mint || defaultCurrency;

      const template = await invoiceStorage.createInvoiceTemplate({
        name,
        description: description || null,
        ownerWalletAddress: walletAddress,
        defaultCurrency: defaultCurrency || "USDC",
        defaultTokenMintAddress: tokenMint,
        defaultPaymentTerms: defaultPaymentTerms || "Net 30",
        defaultDueDays: defaultDueDays || 30,
        defaultLineItems: defaultLineItems ? JSON.stringify(defaultLineItems) : null,
        isActive: true,
      });

      res.json({
        success: true,
        template,
        message: "Template created successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get all templates for a user
   * GET /api/templates?wallet=xxx
   */
  app.get("/api/templates", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const templates = await invoiceStorage.getInvoiceTemplates(walletAddress);

      res.json({
        success: true,
        templates,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get a single template
   * GET /api/templates/:id?wallet=xxx
   */
  app.get("/api/templates/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const template = await invoiceStorage.getInvoiceTemplate(id);

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({
        success: true,
        template,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Update a template
   * PATCH /api/templates/:id?wallet=xxx
   */
  app.patch("/api/templates/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, defaultCurrency, defaultPaymentTerms, defaultDueDays, defaultLineItems, isActive } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (defaultCurrency !== undefined) {
        updateData.defaultCurrency = defaultCurrency;
        const stablecoin = getStablecoinConfig(defaultCurrency);
        updateData.defaultTokenMintAddress = stablecoin?.mint || defaultCurrency;
      }
      if (defaultPaymentTerms !== undefined) updateData.defaultPaymentTerms = defaultPaymentTerms;
      if (defaultDueDays !== undefined) updateData.defaultDueDays = defaultDueDays;
      if (defaultLineItems !== undefined) updateData.defaultLineItems = JSON.stringify(defaultLineItems);
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.updatedAt = new Date();

      const updated = await invoiceStorage.updateInvoiceTemplate(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({
        success: true,
        template: updated,
        message: "Template updated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Delete a template
   * DELETE /api/templates/:id?wallet=xxx
   */
  app.delete("/api/templates/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await invoiceStorage.deleteInvoiceTemplate(id);

      res.json({
        success,
        message: success ? "Template deleted successfully" : "Failed to delete template",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });



  // ============================================
  // GASLESS PAYMENT ROUTES
  // ============================================

  /**
   * Get Fee Payer Configuration (for partial signing)
   * GET /api/config/fee-payer
   */
  app.get("/api/config/fee-payer", async (req, res) => {
    try {
      const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
      if (!payerPrivateKey) {
        return res.status(500).json({
          success: false,
          message: "Server fee payer is not configured (PAYER_PRIVATE_KEY missing)"
        });
      }

      // Derive public key from private key
      // Assuming array format "[1,2,3...]" or base58 string
      let payerKeypair;
      try {
        if (payerPrivateKey.includes("[")) {
          const secretKey = Uint8Array.from(JSON.parse(payerPrivateKey));
          const { Keypair } = await import("@solana/web3.js");
          payerKeypair = Keypair.fromSecretKey(secretKey);
        } else {
          const { Keypair } = await import("@solana/web3.js");
          const bs58 = (await import("bs58")).default;
          payerKeypair = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));
        }
      } catch (e) {
        return res.status(500).json({ success: false, message: "Invalid server key configuration" });
      }

      res.json({
        success: true,
        feePayer: payerKeypair.publicKey.toString(),
        feeAmount: 0.15, // Fixed service fee in USDC/USDT/SOL (configured in frontend)
        treasuryAddress: TREASURY_WALLET_ADDRESS
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });



  // ============================================
  // NFT METADATA ROUTES
  // ============================================

  /**
   * Get NFT metadata by identifier
   * GET /api/nft-metadata/:identifier
   * 
   * Dynamically generates metadata for invoices/payments/businesses
   * Ensures metadata persistence without external storage dependency
   */
  app.get("/api/nft-metadata/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const nftService = getInvoiceNFTService();

      // identifiers are formatted as: type-id
      // e.g. invoice-123, payment-456, business-789

      if (identifier.startsWith("invoice-")) {
        const id = identifier.replace("invoice-", "");
        const invoice = await invoiceStorage.getInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found or invalid identifier" });
        }

        const metadata = nftService.generateInvoiceMetadata(invoice);
        return res.json(metadata);
      }

      if (identifier.startsWith("payment-")) {
        const id = identifier.replace("payment-", "");
        // We need payment AND invoice details for the receipt
        // Using getPaymentById would be ideal, but let's check invoiceStorage methods
        // Assuming we can find the payment via getPaymentsByInvoice or similar if getPayment is missing
        // For now, let's assume we can fetch it. If specific method missing, we add it.
        // Checking invoice-storage.ts capability... 
        // Based on routes, we used getPaymentsByInvoice. Let's try to query db directly via invoiceStorage if needed
        // But wait, getPaymentsByWallet returns payments. 
        // Let's implement a safe way: iterate payments? No, too slow. 
        // Let's rely on standard ID fetch. 
        // Since I can't easily see invoice-storage methods right this second, 
        // I will assume getPayment exists or I'll add it if verification fails.
        // Actually, looking at previous code, strict typing might complain.
        // Let's fallback to searching if getPayment(id) isn't obvious.

        // Actually, looking at invoice-storage.ts imports in this file...
        // We don't see getPayment exported explicitly in the usage examples.
        // However, standard pattern suggests it exists.
        // Let's implementing checking logic:

        // Use direct DB query style if needed, but invoiceStorage is better.
        // Let's assume invoiceStorage has it or we can't implement this part safely yet.
        // I will implement "invoice" and "business" first as they are guaranteed.
        // For payment, I'll attempt a direct DB find using the "payments" schema which is imported.

        const paymentList = await db.select().from(schema.payments).where(eq(schema.payments.id, id));
        const payment = paymentList[0];

        if (!payment) {
          return res.status(404).json({ message: "Payment not found" });
        }

        const invoice = await invoiceStorage.getInvoice(payment.invoiceId);
        if (!invoice) {
          return res.status(404).json({ message: "Associated invoice not found" });
        }

        const metadata = nftService.generatePaymentReceiptMetadata(payment, invoice);
        return res.json(metadata);
      }

      if (identifier.startsWith("business-")) {
        const id = identifier.replace("business-", "");
        // Business ID is usually the storage ID, but businessProfile is referenced by wallet often.
        // But `id` is the primary key (UUID).
        // `getBusinessProfile` takes wallet address. 
        // We need getBusinessProfileById.

        const profileList = await db.select().from(schema.businessProfiles).where(eq(schema.businessProfiles.id, id));
        if (profileList.length === 0) {
          return res.status(404).json({ success: false, message: "Business profile not found" });
        }
        const profile = profileList[0];

        // Fetch Arcium Identity
        const nftRecord = await db.select().from(schema.businessIdentityNFTs).where(eq(schema.businessIdentityNFTs.businessProfileId, id));
        const level = nftRecord[0]?.verificationLevel || "verified";

        const metadata = nftService.generateBusinessIdentityMetadata(profile, level);
        return res.json(metadata);
      }

      return res.status(400).json({ message: "Invalid identifier format" });

    } catch (error: any) {
      console.error(`Error serving metadata for ${req.params.identifier}:`, error);
      res.status(500).json({ message: error.message });
    }
  });


}

