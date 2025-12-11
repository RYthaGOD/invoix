/**
 * Invoice API Routes
 * 
 * Complete REST API for B2B invoicing system
 */

import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { safeSubtract, safeAdd, safeMultiply } from "@shared/math";
import {
  insertInvoiceSchema,
  insertInvoiceWithItemsSchema,
  insertLineItemSchema,
  insertPaymentSchema,
  insertBusinessProfileSchema,
  insertCustomerProfileSchema,
  payments,
  businessProfiles,
  businessIdentityNFTs,
  invoices,
  invoiceLineItems,
  type Invoice
} from "@shared/invoice-schema";
import { fromZodError } from "zod-validation-error";
import { requireWalletOwnership, strictRateLimit } from "./security";
import { getArciumService, loadKeypairFromPrivateKey } from "./arcium-service";
import { getInvoiceNFTService } from "./nft-service";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { verifyStablecoinPayment } from "./stablecoin-payment-service";
import { getStablecoinConfig } from "@shared/stablecoin-config";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";

/**
 * Register invoice-related API routes
 */
export function registerInvoiceRoutes(app: Express): void {

  // ============================================
  // INVOICE ROUTES
  // ============================================

  /**
   * Create a new invoice
   * POST /api/invoices
   * Requires authentication
   */
  app.post("/api/invoices", requireWalletOwnership, strictRateLimit, async (req, res) => {
    try {
      // Get authenticated wallet from session
      const authenticatedWallet = (req as any).authenticatedWallet;

      const validatedData = insertInvoiceWithItemsSchema.parse(req.body);
      const { lineItems, ...invoiceData } = validatedData;

      // Auto-calculate remaining amount using shared utility
      const remainingAmount = safeSubtract(invoiceData.totalAmount, invoiceData.paidAmount || "0");


      // Create invoice with line items atomically
      const invoice = await invoiceStorage.createInvoiceWithItems(
        {
          ...invoiceData,
          dueDate: new Date(invoiceData.dueDate),
          invoicerWalletAddress: authenticatedWallet,
          remainingAmount: remainingAmount,
        },
        lineItems
      );

      // If Arcium encryption is requested, encrypt sensitive data
      if (req.body.encryptWithArcium && req.body.allowedParties) {
        try {
          const arciumService = getArciumService();
          if (arciumService.isAvailable()) {
            const encryptedResult = await arciumService.encryptTransaction(
              {
                amount: invoice.totalAmount,
                tokenAmount: invoice.totalAmount,
                fromAddress: invoice.invoicerWalletAddress,
                toAddress: invoice.invoiceeWalletAddress,
                txSignature: invoice.invoiceNumber,
                timestamp: Date.now(),
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
              // Update local invoice object for response
              invoice.isArciumEncrypted = true;
            } else {
              console.warn("Arcium encryption failed, processing as standard invoice:", encryptedResult.error);
            }
          }
        } catch (arciumError: any) {
          console.error("Arcium service error:", arciumError);
          // Fail gracefully - continue as standard invoice
        }
      }

      // AUTO-MINT Invoice NFT (Removed: Now Client-Side & User-Paid)

      res.status(201).json({
        success: true,
        invoice,
        lineItems: lineItems || [], // Return line items in response
        nftMinted: !!invoice.nftMint,
        message: "Invoice created successfully" + (invoice.nftMint ? " with NFT" : ""),
      });
      return; // Ensure void return
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get invoices for authenticated wallet
   * GET /api/invoices?wallet=xxx&status=xxx&limit=xxx
   */
  app.get("/api/invoices", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const filters = {
        status: req.query.status as string | undefined,
        currency: req.query.currency as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      // Get invoices where user is invoicer OR invoicee
      const sentInvoices = await invoiceStorage.getInvoices(walletAddress, filters);
      const receivedInvoices = await invoiceStorage.getInvoicesForCustomer(walletAddress, filters);

      // Combine and deduplicate
      const allInvoices = [...sentInvoices, ...receivedInvoices];
      const uniqueInvoices = Array.from(
        new Map(allInvoices.map(inv => [inv.id, inv])).values()
      );

      res.json({
        success: true,
        invoices: uniqueInvoices,
        count: uniqueInvoices.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get single invoice by ID
   * GET /api/invoices/:id?wallet=xxx
   */
  /**
   * Get single invoice by ID
   * GET /api/invoices/:id?wallet=xxx
   * 
   * Updated Access Control:
   * 1. Authenticated Owner/Customer -> Always Allow
   * 2. Public Link -> Allow IF (Status != Draft AND !isPrivate)
   */
  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // walletAddress query param is for client-side matching, but for security we look at session
      const sessionWallet = (req as any).session?.walletAddress;

      const invoice = await invoiceStorage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check 1: Is user authenticated and involved?
      let isAuthorized = false;
      if (sessionWallet) {
        if (
          invoice.invoicerWalletAddress === sessionWallet ||
          invoice.invoiceeWalletAddress === sessionWallet
        ) {
          isAuthorized = true;
        }
      }

      // Check 2: Is this a public, sent invoice?
      const isPublicAccessible = !invoice.isPrivate && invoice.status !== "draft";

      // Final Decision
      if (!isAuthorized && !isPublicAccessible) {
        // If it's private/draft and they aren't authorized -> Block
        if (!sessionWallet) {
          return res.status(401).json({
            message: "Authentication required to view this invoice",
            code: "AUTH_REQUIRED"
          });
        }
        return res.status(403).json({
          message: "Unauthorized: You don't have access to this private invoice",
          code: "ACCESS_DENIED"
        });
      }

      // If viewing publicly (not authorized but accessible), we might want to hide sensitive data?
      // For now, per plan, we return the invoice. 
      // Note: isPrivate=false explicitly implies we are okay sharing the text.

      // Get line items
      const lineItems = await invoiceStorage.getLineItems(id);

      res.json({
        success: true,
        invoice: {
          ...invoice,
          lineItems,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });



  /**
   * Get invoice by invoice number
   * GET /api/invoices/number/:invoiceNumber?wallet=xxx
   * NOTE: Requires authentication to prevent invoice number guessing attacks
   */
  app.get("/api/invoices/number/:invoiceNumber", requireWalletOwnership, async (req, res) => {
    try {
      const { invoiceNumber } = req.params;
      const walletAddress = req.query.wallet as string;

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
      } else if (invoice.isPrivate) {
        return res.status(403).json({
          message: "Authentication required: This invoice is private"
        });
      }

      const lineItems = await invoiceStorage.getLineItems(invoice.id);

      res.json({
        success: true,
        invoice: {
          ...invoice,
          lineItems,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Update invoice
   * PATCH /api/invoices/:id?wallet=xxx
   */
  app.patch("/api/invoices/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string;

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

      const updated = await invoiceStorage.updateInvoice(id, req.body);

      res.json({
        success: true,
        invoice: updated,
        message: "Invoice updated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Delete/Cancel invoice
   * DELETE /api/invoices/:id?wallet=xxx
   */
  app.delete("/api/invoices/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string;

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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get invoice statistics for a wallet
   * GET /api/invoices/stats?wallet=xxx
   */
  app.get("/api/invoices/stats", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const stats = await invoiceStorage.getInvoiceStats(walletAddress);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // LINE ITEM ROUTES
  // ============================================

  /**
   * Add line item to invoice
   * POST /api/invoices/:id/line-items
   */
  app.post("/api/invoices/:id/line-items", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string;

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
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Update line item
   * PATCH /api/line-items/:id?wallet=xxx
   */
  app.patch("/api/line-items/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string; // We trust this because of requireWalletOwnership

      // Security Check: Ensure user owns the invoice this line item belongs to
      const lineItemResult = await db.select()
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(eq(invoiceLineItems.id, id))
        .limit(1);

      if (lineItemResult.length === 0) {
        return res.status(404).json({ message: "Line item not found" });
      }

      const { invoices: invoice } = lineItemResult[0];

      if (invoice.invoicerWalletAddress !== walletAddress) {
        return res.status(403).json({ message: "Unauthorized: You do not own this invoice" });
      }

      const updated = await invoiceStorage.updateLineItem(id, req.body);
      // Wait, updateLineItem returns the updated item, or undefined/null.
      // But we just checked it exists.

      res.json({
        success: true,
        lineItem: updated,
        message: "Line item updated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Delete line item
   * DELETE /api/line-items/:id?wallet=xxx
   */
  app.delete("/api/line-items/:id", requireWalletOwnership, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.query.wallet as string;

      // Security Check: Ensure user owns the invoice this line item belongs to
      const lineItemResult = await db.select()
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(eq(invoiceLineItems.id, id))
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PAYMENT ROUTES
  // ============================================

  /**
   * Record a payment for an invoice
   * POST /api/payments
   */
  app.post("/api/payments", strictRateLimit, async (req, res) => {
    try {
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
      if (validatedData.paymentMethod === "solana_transfer" || !validatedData.paymentMethod) {
        // If it's a crypto payment, verify it
        const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"));

        console.log(`Verifying payment tx: ${validatedData.txSignature} for ${validatedData.amount} ${validatedData.currency}`);

        // Platform Fee Enforcement (1%)
        // We verify that the transaction split funds: 99% to Seller, 1% to Platform
        const totalAmount = validatedData.amount; // Keep as string
        const feeRate = "0.01";
        // Calculate fee using safe math
        const feeAmount = parseFloat(safeMultiply(totalAmount, feeRate));
        const recipientAmount = parseFloat(safeSubtract(totalAmount, feeAmount.toString()));

        const verification = await verifyStablecoinPayment(
          connection,
          validatedData.txSignature,
          recipientAmount, // Seller receives 99%
          validatedData.toAddress,
          validatedData.currency,
          feeAmount, // Treasury receives 1%
          TREASURY_WALLET_ADDRESS
        );

        if (!verification.verified) {
          console.error(`Payment verification failed:`, verification);
          return res.status(400).json({
            message: `Payment verification failed: ${verification.error || "Transaction invalid"}`
          });
        }

        console.log("✅ Payment Verified On-Chain:", verification);
      } else {
        // MANUAL PAYMENT (e.g. Cash, Bank Transfer)
        // Only the Invoicer can record manual payments.
        // We need to check authentication manually here since the route is public for crypto payments.

        // Check session (assuming logic from requireWalletOwnership or similar)
        // note: req.isAuthenticated() is not standard express, dependent on passport or similar, 
        // but here we likely use session.walletAddress based on prior context.
        const session = (req as any).session;
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
        usdValueAtPayment: validatedData.usdValueAtPayment || undefined, // explicit pass
        isBusinessExpense: validatedData.isBusinessExpense || false,
      });

      // Get updated invoice
      const updatedInvoice = await invoiceStorage.getInvoice(validatedData.invoiceId);

      res.status(201).json({
        success: true,
        payment,
        invoice: updatedInvoice,
        message: "Payment recorded successfully",
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
   * Get payments for an invoice
   * GET /api/invoices/:id/payments?wallet=xxx
   */
  app.get("/api/invoices/:id/payments", async (req, res) => {
    try {
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
    } catch (error: any) {
      console.error(`Error fetching payments for invoice ${req.params.id}:`, error);
      res.status(500).json({ message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
  });

  /**
   * Get payments for a wallet
   * GET /api/payments?wallet=xxx
   * Already has requireWalletOwnership middleware
   */
  app.get("/api/payments", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const payments = await invoiceStorage.getPaymentsByWallet(walletAddress);

      res.json({
        success: true,
        payments,
        count: payments.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PUBLIC STATS ROUTES
  // ============================================

  /**
   * Get global system statistics
   * GET /api/public-stats
   */
  app.get("/api/public-stats", async (req, res) => {
    try {
      const stats = await invoiceStorage.getGlobalStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching global stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============================================
  // BUSINESS PROFILE ROUTES
  // ============================================

  /**
   * Create or update business profile
   * POST /api/business/profile?wallet=xxx
   */
  app.post("/api/business/profile", requireWalletOwnership, async (req, res) => {
    try {
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
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * Get business profile
   * GET /api/business/profile?wallet=xxx
   */
  app.get("/api/business/profile", requireWalletOwnership, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const profile = await invoiceStorage.getBusinessProfile(walletAddress);

      if (!profile) {
        return res.status(404).json({ message: "Business profile not found" });
      }

      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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
      console.error("Failed to mint business identity NFT:", error);
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

      // Return NFT-compatible metadata
      res.json({
        name: `Invoice ${invoice.invoiceNumber}`,
        symbol: "INV",
        description: `B2B Invoice from ${invoice.invoicerWalletAddress} to ${invoice.invoiceeWalletAddress}`,
        image: `${process.env.API_URL || "https://api.solanainvoice.com"}/images/invoice-nft.png`,
        external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/invoices/${id}`,
        attributes: [
          {
            trait_type: "Invoice Number",
            value: invoice.invoiceNumber,
          },
          {
            trait_type: "Status",
            value: invoice.status,
          },
          {
            trait_type: "Currency",
            value: invoice.currency,
          },
          {
            trait_type: "Amount",
            value: invoice.isArciumEncrypted ? "Encrypted" : invoice.totalAmount,
            display_type: invoice.isArciumEncrypted ? undefined : "number",
          },
          {
            trait_type: "Due Date",
            value: invoice.dueDate.toISOString(),
            display_type: "date",
          },
          {
            trait_type: "Privacy",
            value: invoice.isPrivate ? "Private" : "Public",
          },
          {
            trait_type: "Encrypted",
            value: invoice.isArciumEncrypted ? "Yes" : "No",
          },
        ],
        properties: {
          category: "invoice",
          creators: [
            {
              address: invoice.invoicerWalletAddress,
              share: 100,
              verified: true,
            },
          ],
        },
      });
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
      const paymentData = await db.select().from(payments).where(eq(payments.id, id)).limit(1).then((r: any[]) => r[0]);

      if (!paymentData) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const invoice = await invoiceStorage.getInvoice(paymentData.invoiceId);

      res.json({
        name: `Payment Receipt #${id.slice(0, 8)}`,
        symbol: "RCPT",
        description: `Payment receipt for Invoice ${invoice?.invoiceNumber || "Unknown"}`,
        image: `${process.env.API_URL || "https://api.solanainvoice.com"}/images/receipt-nft.png`,
        external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/invoices/${paymentData.invoiceId}`,
        attributes: [
          {
            trait_type: "Invoice Number",
            value: invoice?.invoiceNumber || "Unknown",
          },
          {
            trait_type: "Amount",
            value: paymentData.amount,
            display_type: "number",
          },
          {
            trait_type: "Currency",
            value: paymentData.currency,
          },
          {
            trait_type: "Paid By",
            value: paymentData.fromAddress,
          },
          {
            trait_type: "Paid To",
            value: paymentData.toAddress,
          },
          {
            trait_type: "Transaction",
            value: paymentData.txSignature,
          },
          {
            trait_type: "Payment Date",
            value: paymentData.paidAt.toISOString(),
            display_type: "date",
          },
          {
            trait_type: "Tax Year",
            value: paymentData.paidAt.getFullYear(),
            display_type: "number",
          },
        ],
        properties: {
          category: "payment_receipt",
          creators: [
            {
              address: paymentData.fromAddress,
              share: 100,
              verified: true,
            },
          ],
        },
      });
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
      const businessData = await db.select().from(businessProfiles).where(eq(businessProfiles.id, id)).limit(1).then(r => r[0]);

      if (!businessData) {
        return res.status(404).json({ error: "Business profile not found" });
      }

      const identity = await db.select().from(businessIdentityNFTs)
        .where(eq(businessIdentityNFTs.businessProfileId, id))
        .orderBy(desc(businessIdentityNFTs.createdAt))
        .limit(1).then(r => r[0]);

      const verificationLevel = identity?.verificationLevel || "basic";

      res.json({
        name: `${businessData.businessName} - Verified Business`,
        symbol: "BIZ",
        description: `Verified business credentials for ${businessData.businessName}`,
        image: `${process.env.API_URL || "https://api.solanainvoice.com"}/images/business-${verificationLevel}-nft.png`,
        external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/business/${businessData.ownerWalletAddress}`,
        attributes: [
          {
            trait_type: "Business Name",
            value: businessData.businessName,
          },
          {
            trait_type: "Verification Level",
            value: verificationLevel,
          },
          {
            trait_type: "Wallet",
            value: businessData.ownerWalletAddress,
          },
          {
            trait_type: "Registration Date",
            value: businessData.createdAt.toISOString(),
            display_type: "date",
          },
        ],
        properties: {
          category: "business_identity",
          creators: [
            {
              address: businessData.ownerWalletAddress,
              share: 100,
              verified: true,
            },
          ],
        },
      });
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

  /**
   * Create invoice from template
   * POST /api/invoices/from-template
   */
  app.post("/api/invoices/from-template", requireWalletOwnership, async (req, res) => {
    try {
      const { templateId, invoiceeWalletAddress, dueDate, customLineItems } = req.body;
      const walletAddress = req.query.wallet as string;

      if (!templateId || !invoiceeWalletAddress) {
        return res.status(400).json({ message: "Template ID and customer wallet address are required" });
      }

      // Get template
      const template = await invoiceStorage.getInvoiceTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Parse line items
      const lineItems = customLineItems || (template.defaultLineItems ? JSON.parse(template.defaultLineItems) : []);

      // Calculate totals
      // Calculate totals
      const subtotal = lineItems.reduce((sum: string, item: any) => {
        const itemTotal = safeMultiply(item.quantity, item.unitPrice);
        return safeAdd(sum, itemTotal);
      }, "0");

      // Calculate due date
      const invoiceDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + template.defaultDueDays * 24 * 60 * 60 * 1000);

      // Generate invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Create invoice
      const invoice = await invoiceStorage.createInvoice({
        invoiceNumber,
        invoicerWalletAddress: walletAddress,
        invoiceeWalletAddress,
        description: `Invoice from template: ${template.name}`,
        notes: null,
        dueDate: invoiceDueDate,
        currency: template.defaultCurrency,
        tokenMint: template.defaultTokenMintAddress,
        tokenMintAddress: template.defaultTokenMintAddress || "",
        tokenDecimals: 6,
        subtotal: subtotal.toString(),
        taxAmount: "0",
        discountAmount: "0",
        totalAmount: subtotal.toString(),
        remainingAmount: subtotal.toString(),
        paidAmount: "0",
        status: "draft",
        paymentTerms: template.defaultPaymentTerms,
        isPrivate: false,
        hideAmounts: false,
        hideParties: false,
        isArciumEncrypted: false,
      });

      // Add line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const lineTotal = safeMultiply(item.quantity, item.unitPrice);

        await invoiceStorage.createLineItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          lineTotal: lineTotal.toString(),
          lineNumber: i + 1,
        });
      }

      res.json({
        success: true,
        invoice,
        message: "Invoice created from template successfully",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

        const paymentList = await db.select().from(payments).where(eq(payments.id, id));
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

        const profileList = await db.select().from(businessProfiles).where(eq(businessProfiles.id, id));
        const profile = profileList[0];

        if (!profile) {
          return res.status(404).json({ message: "Business profile not found" });
        }

        // We need verification level. We can default to "verified" if they have an NFT.
        // Or check the NFT table.
        const nftRecord = await db.select().from(businessIdentityNFTs).where(eq(businessIdentityNFTs.businessProfileId, id));
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

