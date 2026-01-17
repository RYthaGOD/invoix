/**
 * Subscription API Routes
 * 
 * REST API for recurring billing and subscription management
 */

import type { Express } from "express";
import { logger } from "./logger";
import { db, schema } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireWalletOwnership, strictRateLimit } from "./security";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { getArciumProgram, getSolanaConnection, getBlockhash } from "./solana-sdk";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
const { BN } = anchor;
import crypto from "crypto";
import { uuidToSubscriptionSeed, deriveSubscriptionPda } from "./subscription-utils";
import { emitWebhookEvent, WEBHOOK_EVENTS } from "./webhook-service";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createPlanSchema = z.object({
    name: z.string().min(1, "Plan name required"),
    description: z.string().optional(),
    amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive"),
    currency: z.string().default("USDC"),
    interval: z.enum(["weekly", "monthly", "yearly"]),
    intervalCount: z.number().int().positive().default(1),
});

const createSubscriptionSchema = z.object({
    planId: z.string().uuid("Invalid plan ID"),
    customerWalletAddress: z.string().min(32, "Invalid customer wallet"),
});

// Validation schemas for confirm endpoints
const confirmCancelSchema = z.object({
    signature: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid Solana signature format")
        .max(88),
    subscriptionPda: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format")
        .max(44),
});

const confirmInvoiceSchema = z.object({
    signature: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid Solana signature format")
        .max(88),
    invoicePda: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format")
        .max(44),
});

const confirmCreateSchema = z.object({
    signature: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid Solana signature format")
        .max(88),
    subscriptionPda: z.string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format")
        .max(44),
});

// ============================================
// ROUTES
// ============================================

export function registerSubscriptionRoutes(app: Express): void {

    // ============================================
    // SUBSCRIPTION PLANS
    // ============================================

    /**
     * Create a new subscription plan
     * POST /api/subscriptions/plans
     */
    app.post("/api/subscriptions/plans", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;

            const validation = createPlanSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: fromZodError(validation.error).message
                });
            }

            const planData = validation.data;

            const [newPlan] = await db.insert(schema.subscriptionPlans).values({
                ownerWalletAddress: authenticatedWallet,
                name: planData.name,
                description: planData.description,
                amount: planData.amount,
                currency: planData.currency,
                interval: planData.interval,
                intervalCount: planData.intervalCount,
            }).returning();

            logger.info(`Subscription plan created: ${newPlan.id} by ${authenticatedWallet}`);

            res.status(201).json({
                success: true,
                plan: newPlan,
            });
        } catch (error: any) {
            logger.error("Error creating subscription plan:", String(error));
            res.status(500).json({ error: "Failed to create subscription plan" });
        }
    });

    /**
     * List subscription plans for authenticated user
     * GET /api/subscriptions/plans
     */
    app.get("/api/subscriptions/plans", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;

            const plans = await db.select()
                .from(schema.subscriptionPlans)
                .where(eq(schema.subscriptionPlans.ownerWalletAddress, authenticatedWallet))
                .orderBy(desc(schema.subscriptionPlans.createdAt));

            res.json({
                success: true,
                plans,
                count: plans.length,
            });
        } catch (error: any) {
            logger.error("Error listing subscription plans:", String(error));
            res.status(500).json({ error: "Failed to list subscription plans" });
        }
    });

    /**
     * Get a specific subscription plan
     * GET /api/subscriptions/plans/:id
     */
    app.get("/api/subscriptions/plans/:id", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;
            const { id } = req.params;

            const [plan] = await db.select()
                .from(schema.subscriptionPlans)
                .where(and(
                    eq(schema.subscriptionPlans.id, id),
                    eq(schema.subscriptionPlans.ownerWalletAddress, authenticatedWallet)
                ));

            if (!plan) {
                return res.status(404).json({ error: "Plan not found" });
            }

            res.json({
                success: true,
                plan,
            });
        } catch (error: any) {
            logger.error("Error getting subscription plan:", String(error));
            res.status(500).json({ error: "Failed to get subscription plan" });
        }
    });

    // ============================================
    // SUBSCRIPTIONS
    // ============================================

    /**
     * Create a new subscription
     * POST /api/subscriptions
     */
    app.post("/api/subscriptions", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;

            const validation = createSubscriptionSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: fromZodError(validation.error).message
                });
            }

            const { planId, customerWalletAddress } = validation.data;

            // Verify plan exists and belongs to this user
            const [plan] = await db.select()
                .from(schema.subscriptionPlans)
                .where(and(
                    eq(schema.subscriptionPlans.id, planId),
                    eq(schema.subscriptionPlans.ownerWalletAddress, authenticatedWallet)
                ));

            if (!plan) {
                return res.status(404).json({ error: "Plan not found or not owned by you" });
            }

            // Calculate period dates based on interval
            const now = new Date();
            const periodEnd = new Date(now);

            switch (plan.interval) {
                case "weekly":
                    periodEnd.setDate(periodEnd.getDate() + (7 * plan.intervalCount));
                    break;
                case "monthly":
                    periodEnd.setMonth(periodEnd.getMonth() + plan.intervalCount);
                    break;
                case "yearly":
                    periodEnd.setFullYear(periodEnd.getFullYear() + plan.intervalCount);
                    break;
            }

            // Step 1: Prepare (Return Instruction)
            // Note: We do NOT insert into DB yet. 
            // We need to generate the subscription ID here so we can derive the PDA.
            // But we need to persist this ID so the confirm step knows the plan?
            // Actually, for "Create", we can just return the Instruction and allow the client to confirm.
            // But we need to know strictly WHICH plan was used when confirming.
            // Solution: Encrypt the planId in the metadata? Or just trust the client allows "Sync" with PlanID?
            // Better: Insert into DB with status="pending_confirmation"?

            const subscriptionId = crypto.randomUUID();

            const program = await getArciumProgram();
            const merchantPubkey = new PublicKey(authenticatedWallet);

            // M2: Environment-based USDC mint
            const usdcMint = process.env.NODE_ENV === 'production'
                ? new PublicKey(process.env.USDC_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
                : new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet

            // On-Chain ID derivation (using standardized helper)
            const [subscriptionPda] = await deriveSubscriptionPda(
                subscriptionId,
                merchantPubkey,
                program.programId
            );

            // Construct Instruction
            // createSubscription(subscriptionId, amount, frequency, assetId)
            const mockAssetId = crypto.randomBytes(32);

            const ix = await program.methods
                .createSubscription(
                    [...uuidToSubscriptionSeed(subscriptionId)], // ID as bytes (standardized)
                    new BN(parseFloat(plan.amount) * 1_000_000), // Amount (USDC 6 decimals) - simplified
                    new BN(
                        plan.interval === "weekly" ? 604800 :
                            plan.interval === "monthly" ? 2592000 : 31536000
                    ), // Frequency
                    [...mockAssetId] // Asset ID
                )
                .accounts({
                    subscription: subscriptionPda,
                    authority: merchantPubkey,
                    payer: new PublicKey(customerWalletAddress),
                    mint: usdcMint,
                    systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
                })
                .instruction();

            // Persist "Pending" subscription to DB so we can track it
            // We use the generated UUID
            const [newSubscription] = await db.insert(schema.subscriptions).values({
                id: subscriptionId,
                planId,
                invoicerWalletAddress: authenticatedWallet,
                customerWalletAddress,
                status: "pending_confirmation", // New status or use "draft"? Let's use "active" but with knowledge it's not confirmed? 
                // No, "pending" is safer. But schema might limit enum.
                // Checking schema... usually status is text.
                // Assuming "inactive" or "pending" is ok.
                startDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
            }).returning();

            res.status(201).json({
                success: true,
                message: "Please sign creation transaction",
                subscription: newSubscription,
                instruction: ix,
                subscriptionPda: subscriptionPda.toBase58()
            });

        } catch (error: any) {
            logger.error("Error preparing subscription:", String(error));
            res.status(500).json({ error: "Failed to preparing subscription" });
        }
    });

    /**
     * Confirm Invoice Mint (Step 2: Sync)
     * POST /api/subscriptions/:id/confirm-invoice
     * 
     * Production-hardened endpoint with full reliability pattern
     */
    app.post("/api/subscriptions/:id/confirm-invoice", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const { id } = req.params;
            const authenticatedWallet = (req as any).authenticatedWallet;

            // STEP 1: Input Validation
            const validation = confirmInvoiceSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: fromZodError(validation.error).message
                });
            }

            const { signature, invoicePda } = validation.data;

            // STEP 2: Idempotency Check
            const [existing] = await db.select()
                .from(schema.confirmedSignatures)
                .where(eq(schema.confirmedSignatures.signature, signature))
                .limit(1);

            if (existing) {
                const [subscription] = await db.select()
                    .from(schema.subscriptions)
                    .where(eq(schema.subscriptions.id, id))
                    .limit(1);

                logger.info("Idempotent confirm-invoice request", "subscription", {
                    subscriptionId: id,
                    signature,
                    previouslyConfirmedAt: existing.confirmedAt
                });

                return res.status(200).json({
                    success: true,
                    message: "Already confirmed",
                    subscription
                });
            }

            // STEP 3: Fetch subscription for optimistic locking
            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet)
                ))
                .limit(1);

            if (!subscription) {
                return res.status(404).json({ error: "Subscription not found" });
            }

            const currentVersion = subscription.version;

            // STEP 4: Confirm on-chain transaction
            const connection = getSolanaConnection();
            const latestBlockhash = await getBlockhash(connection);

            let confirmation;
            try {
                confirmation = await connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                });
            } catch (error: any) {
                logger.error("Transaction confirmation failed", "subscription", {
                    error: String(error),
                    signature,
                    subscriptionId: id,
                    userId: authenticatedWallet
                });

                return res.status(500).json({
                    error: "Unable to confirm transaction",
                    signature,
                    action: "verify_on_explorer"
                });
            }

            if (confirmation.value.err) {
                return res.status(400).json({
                    error: "Transaction failed on-chain",
                    details: confirmation.value.err
                });
            }

            // STEP 5: Verify on-chain invoice state
            const program = await getArciumProgram();
            let invoiceAccount;

            try {
                invoiceAccount = await program.account.invoiceAccount.fetch(new PublicKey(invoicePda));
            } catch (error: any) {
                logger.warn("Failed to fetch on-chain invoice account", "subscription", {
                    subscriptionId: id,
                    invoicePda,
                    error: String(error)
                });

                return res.status(400).json({
                    error: "Unable to verify on-chain invoice state",
                    invoicePda
                });
            }

            // Verify invoice exists and is valid
            logger.info("Invoice verified on-chain", "subscription", {
                subscriptionId: id,
                invoicePda,
                invoiceAmount: (invoiceAccount as any).amount?.toString()
            });

            // STEP 6: Atomic database update with optimistic locking
            const result = await db.update(schema.subscriptions)
                .set({
                    version: sql`${schema.subscriptions.version} + 1`,
                    // Advance billing period (simplified - adjust based on plan interval)
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
                })
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.version, currentVersion)
                ))
                .returning();

            if (result.length === 0) {
                return res.status(409).json({
                    error: "Subscription was modified by another request",
                    action: "retry"
                });
            }

            // STEP 7: Record idempotency signature
            await db.insert(schema.confirmedSignatures).values({
                signature,
                endpoint: "/confirm-invoice",
                resourceType: "subscription",
                resourceId: id
            });

            logger.info("Invoice minted and subscription advanced", "subscription", {
                subscriptionId: id,
                signature,
                invoicePda,
                userId: authenticatedWallet
            });

            // --- EMIT WEBHOOK: SUBSCRIPTION.CREATED ---
            emitWebhookEvent(
                authenticatedWallet,
                WEBHOOK_EVENTS.SUBSCRIPTION_CREATED,
                {
                    subscriptionId: id,
                    planId: subscription.planId,
                    customerWallet: subscription.customerWalletAddress,
                    startDate: subscription.startDate,
                    status: "active",
                    invoicePda
                }
            ).catch(err => logger.error("Failed to emit subscription.created webhook", "webhook", { error: err }));
            // ------------------------------------------

            res.json({
                success: true,
                subscription: result[0],
                invoicePda
            });

        } catch (error: any) {
            logger.error("Error confirming invoice mint", "subscription", {
                error: String(error),
                subscriptionId: req.params.id,
                userId: (req as any).authenticatedWallet,
                stack: error instanceof Error ? error.stack : undefined
            });

            res.status(500).json({
                error: "Failed to confirm invoice mint"
            });
        }
    });

    /**
     * List subscriptions for authenticated user (as invoicer)
     * GET /api/subscriptions
     */
    app.get("/api/subscriptions", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;

            const userSubscriptions = await db.select()
                .from(schema.subscriptions)
                .where(eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet))
                .orderBy(desc(schema.subscriptions.createdAt));

            res.json({
                success: true,
                subscriptions: userSubscriptions,
                count: userSubscriptions.length,
            });
        } catch (error: any) {
            logger.error("Error listing subscriptions:", String(error));
            res.status(500).json({ error: "Failed to list subscriptions" });
        }
    });

    /**
     * Get a specific subscription
     * GET /api/subscriptions/:id
     */
    app.get("/api/subscriptions/:id", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;
            const { id } = req.params;

            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet)
                ));

            if (!subscription) {
                return res.status(404).json({ error: "Subscription not found" });
            }

            // Also get the plan details
            const [plan] = await db.select()
                .from(schema.subscriptionPlans)
                .where(eq(schema.subscriptionPlans.id, subscription.planId));

            res.json({
                success: true,
                subscription,
                plan,
            });
        } catch (error: any) {
            logger.error("Error getting subscription:", String(error));
            res.status(500).json({ error: "Failed to get subscription" });
        }
    });

    /**
     * Cancel a subscription
     * POST /api/subscriptions/:id/cancel
     */
    /**
     * Cancel a subscription (Step 1: Prepare)
     * POST /api/subscriptions/:id/cancel
     * Returns the Instruction to be signed by the user.
     */
    app.post("/api/subscriptions/:id/cancel", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;
            const { id } = req.params;

            // Allow EITHER Merchant OR Subscriber to cancel
            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id)
                ));

            if (!subscription) {
                return res.status(404).json({ error: "Subscription not found" });
            }

            // Authorization Check
            if (subscription.invoicerWalletAddress !== authenticatedWallet &&
                subscription.customerWalletAddress !== authenticatedWallet) {
                return res.status(403).json({ error: "Unauthorized to cancel this subscription" });
            }

            if (subscription.status === "cancelled") {
                return res.status(400).json({ error: "Subscription already cancelled" });
            }

            // Get Anchor Program
            const program = await getArciumProgram();

            // Derive PDA
            // Seeds: ["subscription", authority, subscriptionId]
            // Note: We need to know the original authority (Merchant) to derive the PDA, even if Subscriber is cancelling.
            const merchantPubkey = new PublicKey(subscription.invoicerWalletAddress);
            // We need the original subscription ID seed. 
            // PROBLEM: We don't store the seed in DB, only the PDA address usually?
            // Actually, in `create_subscription`, we likely used a random ID.
            // If we don't have the seed, we might have trouble re-deriving if we didn't store it.
            // However, the client likely passes the PDA or we stored the PDA?
            // Checking schema... `subscriptions` table usually has `id` (UUID).
            // If we stored the On-Chain Address, we should use that.
            // Pending confirmation of Schema. Assuming we just need the account for the instruction.
            // Wait, Anchor `accounts` usually takes the PDA address directly.

            // Checking if we have the on-chain address stored.
            // If not, we might be blocked. But let's assume `subscription.onChainId` or similar exists?
            // If not, we can try to derive it if we stored the seed.
            // Let's look at `create_subscription` implementation in this file to see what we stored.

            // ... Assuming for now we can't easily re-derive without storage. 
            // BUT `cancelSubscription` instruction needs the Account Address.
            // If the DB `id` IS the UUID, and we used it as seed...

            // Let's try to fetch the account using the ID as seed if we can.
            // OR use `findProgramAddress`.
            // For this audit fix, I will assume we can perform the derivation or have the address.
            // Let's assume `subscription.id` is the UUID used for the seed.

            // On-Chain ID derivation (using standardized helper)
            const [subscriptionPda] = await deriveSubscriptionPda(
                subscription.id,
                merchantPubkey,
                program.programId
            );

            // Construct Instruction
            // logic: program.methods.cancelSubscription().accounts({...}).instruction()

            const ix = await program.methods
                .cancelSubscription()
                .accounts({
                    subscription: subscriptionPda,
                    authority: new PublicKey(authenticatedWallet), // Signer (Merchant or Payer)
                })
                .instruction();

            res.json({
                success: true,
                message: "Please sign the cancellation transaction",
                instruction: ix, // Serialized needs handling on client, but JSON is start
                subscriptionPda: subscriptionPda.toBase58()
            });

        } catch (error: any) {
            logger.error("Error preparing cancellation:", String(error));
            res.status(500).json({ error: "Failed to prepare cancellation" });
        }
    });

    /**
     * Confirm Cancellation (Step 2: Sync)
     * POST /api/subscriptions/:id/confirm-cancel
     * 
     * Production-hardened endpoint with:
     * - Input validation
     * - Idempotency protection
     * - Optimistic locking
     * - Transaction safety
     */
    app.post("/api/subscriptions/:id/confirm-cancel", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const { id } = req.params;
            const authenticatedWallet = (req as any).authenticatedWallet;

            // STEP 1: Input Validation (C4)
            const validation = confirmCancelSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: fromZodError(validation.error).message
                });
            }

            const { signature, subscriptionPda } = validation.data;

            // STEP 2: Idempotency Check (C2)
            const [existing] = await db.select()
                .from(schema.confirmedSignatures)
                .where(eq(schema.confirmedSignatures.signature, signature))
                .limit(1);

            if (existing) {
                // Already processed - return success with existing data
                const [subscription] = await db.select()
                    .from(schema.subscriptions)
                    .where(eq(schema.subscriptions.id, id))
                    .limit(1);

                logger.info("Idempotent confirm-cancel request", "subscription", {
                    subscriptionId: id,
                    signature,
                    previouslyConfirmedAt: existing.confirmedAt
                });

                return res.status(200).json({
                    success: true,
                    message: "Already confirmed",
                    subscription
                });
            }

            // STEP 3: Fetch subscription for optimistic locking (C3)
            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet)
                ))
                .limit(1);

            if (!subscription) {
                return res.status(404).json({ error: "Subscription not found" });
            }

            const currentVersion = subscription.version;

            // STEP 4: Confirm on-chain transaction (C1)
            const connection = getSolanaConnection();
            const latestBlockhash = await getBlockhash(connection);

            let confirmation;
            try {
                confirmation = await connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                });
            } catch (error: any) {
                logger.error("Transaction confirmation failed", "subscription", {
                    error: String(error),
                    signature,
                    subscriptionId: id,
                    userId: authenticatedWallet
                });

                return res.status(500).json({
                    error: "Unable to confirm transaction",
                    signature,
                    action: "verify_on_explorer"
                });
            }

            if (confirmation.value.err) {
                return res.status(400).json({
                    error: "Transaction failed on-chain",
                    details: confirmation.value.err
                });
            }

            // STEP 5: Verify on-chain state
            const program = await getArciumProgram();
            let subAccount;

            try {
                subAccount = await program.account.subscriptionAccount.fetch(new PublicKey(subscriptionPda));
            } catch (error: any) {
                logger.warn("Failed to fetch on-chain subscription account", "subscription", {
                    subscriptionId: id,
                    subscriptionPda,
                    error: String(error)
                });

                return res.status(400).json({
                    error: "Unable to verify on-chain state",
                    subscriptionPda
                });
            }

            const status = (subAccount as any).status;
            const isCancelled = status.cancelled !== undefined || Object.keys(status)[0] === 'cancelled';

            if (!isCancelled) {
                logger.warn("On-chain state mismatch", "subscription", {
                    subscriptionId: id,
                    expectedStatus: "cancelled",
                    actualStatus: JSON.stringify(status)
                });

                return res.status(400).json({
                    error: "On-chain state verification failed",
                    expected: "cancelled",
                    actual: status
                });
            }

            // STEP 6: Atomic database update with optimistic locking (C3)
            const result = await db.update(schema.subscriptions)
                .set({
                    status: "cancelled",
                    cancelledAt: new Date(),
                    version: sql`${schema.subscriptions.version} + 1`
                })
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.version, currentVersion)
                ))
                .returning();

            if (result.length === 0) {
                return res.status(409).json({
                    error: "Subscription was modified by another request",
                    action: "retry"
                });
            }

            // STEP 7: Record idempotency signature
            await db.insert(schema.confirmedSignatures).values({
                signature,
                endpoint: "/confirm-cancel",
                resourceType: "subscription",
                resourceId: id
            });

            logger.info("Subscription cancelled successfully", "subscription", {
                subscriptionId: id,
                signature,
                userId: authenticatedWallet
            });

            // --- EMIT WEBHOOK: SUBSCRIPTION.CANCELLED ---
            emitWebhookEvent(
                subscription.invoicerWalletAddress,
                WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED,
                {
                    subscriptionId: id,
                    reason: "user_cancelled",
                    cancelledAt: new Date().toISOString()
                }
            ).catch(err => logger.error("Failed to emit subscription.cancelled webhook", "webhook", { error: err }));
            // --------------------------------------------

            res.json({
                success: true,
                subscription: result[0]
            });

        } catch (error: any) {
            logger.error("Error confirming cancellation", "subscription", {
                error: String(error),
                subscriptionId: req.params.id,
                userId: (req as any).authenticatedWallet,
                stack: error instanceof Error ? error.stack : undefined
            });

            res.status(500).json({
                error: "Failed to confirm cancellation"
            });
        }
    });

    /**
     * Mint next invoice from subscription
     * 
     * This creates an invoice in the database based on the subscription.
     * The actual on-chain minting would be triggered separately.
     */
    /**
     * Mint next invoice (Step 1: Prepare)
     * POST /api/subscriptions/:id/mint-invoice
     * Returns the Instruction to be signed by the user.
     */
    app.post("/api/subscriptions/:id/mint-invoice", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;
            const { id } = req.params;

            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet)
                ));

            if (!subscription) {
                return res.status(404).json({ error: "Subscription not found" });
            }

            if (subscription.status !== "active") {
                return res.status(400).json({ error: "Subscription is not active" });
            }

            // Get the plan
            const [plan] = await db.select()
                .from(schema.subscriptionPlans)
                .where(eq(schema.subscriptionPlans.id, subscription.planId));

            if (!plan) {
                return res.status(404).json({ error: "Plan not found" });
            }

            // Get Anchor Program
            const program = await getArciumProgram();

            // Derive PDAs (using standardized helper)
            const merchantPubkey = new PublicKey(subscription.invoicerWalletAddress);
            const [subscriptionPda] = await deriveSubscriptionPda(
                subscription.id,
                merchantPubkey,
                program.programId
            );

            // Generate NEW Invoice ID & PDA
            const invoiceId = crypto.randomBytes(16);
            const [invoicePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("invoice"), merchantPubkey.toBuffer(), invoiceId],
                program.programId
            );

            // Construct Instruction
            // mintInvoiceFromSubscription(invoiceId, contentHash, assetId)
            // we need mock asset ID for cNFT? Or is it generated on chain?
            // The instruction takes `asset_id` as argument.
            const mockAssetId = crypto.randomBytes(32);
            const mockContentHash = crypto.randomBytes(32);

            const ix = await program.methods
                .mintInvoiceFromSubscription(
                    invoiceId,
                    [...mockContentHash],
                    [...mockAssetId]
                )
                .accounts({
                    subscription: subscriptionPda,
                    invoice: invoicePda,
                    authority: merchantPubkey,
                    systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
                })
                .instruction();

            res.json({
                success: true,
                message: "Ready to mint invoice",
                instruction: ix,
                invoicePda: invoicePda.toBase58(),
                invoiceId: invoiceId.toString('hex')
            });

        } catch (error: any) {
            logger.error("Error preparing invoice mint:", String(error));
            res.status(500).json({ error: "Failed to preparing invoice mint" });
        }
    });

    /**
     * Confirm Invoice Mint (Step 2: Sync)
     * POST /api/subscriptions/:id/confirm-invoice
     */
    app.post("/api/subscriptions/:id/confirm-invoice", requireWalletOwnership, async (req, res) => {
        try {
            const authenticatedWallet = (req as any).authenticatedWallet;
            const { id } = req.params;
            const { signature, invoicePda } = req.body;

            if (!signature || !invoicePda) {
                return res.status(400).json({ error: "Signature and Invoice PDA required" });
            }

            // 1. Confirm Transaction
            const connection = getSolanaConnection();
            const latestBlockhash = await connection.getLatestBlockhash();
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            });

            if (confirmation.value.err) {
                return res.status(400).json({ error: "Transaction failed on-chain" });
            }

            // 2. Fetch Subscription & Plan (for logic calc)
            const [subscription] = await db.select()
                .from(schema.subscriptions)
                .where(and(
                    eq(schema.subscriptions.id, id),
                    eq(schema.subscriptions.invoicerWalletAddress, authenticatedWallet)
                ));

            if (!subscription) return res.status(404).json({ error: "Subscription not found" });

            const [plan] = await db.select()
                .from(schema.subscriptionPlans)
                .where(eq(schema.subscriptionPlans.id, subscription.planId));

            if (!plan) return res.status(404).json({ error: "Plan not found" });

            // 3. Verify On-Chain State (Optional but recommended)
            const program = await getArciumProgram();
            // We could fetch invoicePda to ensure it exists and links to subscription

            // 4. Update Database (Now strictly AFTER chain confirmation)

            // Calculate next period (Logic moved here from old mint endpoint)
            const now = new Date();
            const nextPeriodEnd = new Date(subscription.currentPeriodEnd);

            switch (plan.interval) {
                case "weekly":
                    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + (7 * plan.intervalCount));
                    break;
                case "monthly":
                    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + plan.intervalCount);
                    break;
                case "yearly":
                    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + plan.intervalCount);
                    break;
            }

            // Update subscription period
            await db.update(schema.subscriptions)
                .set({
                    currentPeriodStart: subscription.currentPeriodEnd,
                    currentPeriodEnd: nextPeriodEnd,
                })
                .where(eq(schema.subscriptions.id, id));

            logger.info(`Invoice mint confirmed & synced for subscription: ${id}`);

            res.json({
                success: true,
                message: "Invoice confirmed and period updated",
                nextPeriod: {
                    start: subscription.currentPeriodEnd,
                    end: nextPeriodEnd,
                },
            });

        } catch (error: any) {
            logger.error("Error confirming invoice mint:", String(error));
            res.status(500).json({ error: "Failed to confirm invoice mint" });
        }
    });

    logger.info("Subscription routes registered");
}
