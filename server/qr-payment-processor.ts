/**
 * QR Payment Processor
 * 
 * Monitors for QR payments sent to Treasury and distributes to invoicers.
 * Flow: User pays Treasury → Backend detects → Verify amount → Forward 99% to invoicer
 * 
 * SECURITY NOTES:
 * - Verifies payment amount matches invoice
 * - Prevents double-processing via signature deduplication
 * - Uses Treasury wallet (from PAYER_PRIVATE_KEY) for distribution
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, VersionedTransactionResponse } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { db } from "./db";
import { invoices, payments } from "@shared/invoice-schema";
import { eq, and, or } from "drizzle-orm";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import bs58 from "bs58";
import { logger } from "./logger";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const POLL_INTERVAL_MS = 15000; // Check every 15 seconds
const PLATFORM_FEE_RATE = 0.01; // 1% platform fee
const AMOUNT_TOLERANCE = 0.001; // Allow 0.1% variance for floating point

let isRunning = false;
// Track processed signatures in memory to avoid redundant DB checks
const processedSignatures = new Set<string>();

/**
 * Start the QR payment processor
 */
export function startQRPaymentProcessor() {
    if (isRunning) {
        logger.info("QR_PROCESSOR already running", "qr");
        return;
    }

    if (!process.env.PAYER_PRIVATE_KEY) {
        logger.warn("PAYER_PRIVATE_KEY not set - QR payment distribution disabled", "qr");
        return;
    }

    isRunning = true;
    logger.info("QR Payment Processor started", "qr");

    // Run immediately, then on interval
    processQRPayments();
    setInterval(processQRPayments, POLL_INTERVAL_MS);
}

/**
 * Main processing loop
 */
async function processQRPayments() {
    try {
        // 1. Find invoices waiting for QR payment (status = sent, viewed, or partial)
        const pendingInvoices = await db.query.invoices.findMany({
            where: or(
                eq(invoices.status, "sent"),
                eq(invoices.status, "viewed"),
                eq(invoices.status, "partial")
            ),
            limit: 20
        });

        if (pendingInvoices.length === 0) return;

        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

        // 2. Get recent signatures once (not per invoice - optimization)
        const signatures = await connection.getSignaturesForAddress(
            treasuryPubkey,
            { limit: 50 }
        );

        // 3. Check each invoice for QR payment
        for (const invoice of pendingInvoices) {
            try {
                const qrReference = `QR-${invoice.id}`;

                for (const sigInfo of signatures) {
                    // Skip if already processed
                    if (processedSignatures.has(sigInfo.signature)) continue;

                    // Get transaction details
                    const tx = await connection.getTransaction(sigInfo.signature, {
                        maxSupportedTransactionVersion: 0
                    });

                    if (!tx || !tx.meta) continue;

                    // Check memo for our reference
                    const memoLog = tx.meta.logMessages?.find(log =>
                        log.includes("Program log: Memo") && log.includes(qrReference)
                    );

                    if (memoLog) {
                        logger.info(`Found payment for invoice ${invoice.id}: ${sigInfo.signature}`, "qr", { invoiceId: invoice.id, signature: sigInfo.signature });

                        // SECURITY: Verify payment amount before distributing
                        const verified = await verifyPaymentAmount(connection, tx, invoice);
                        if (!verified.success) {
                            logger.warn(`Payment verification failed for ${sigInfo.signature}`, "qr", { error: verified.error });
                            processedSignatures.add(sigInfo.signature); // Don't reprocess
                            continue;
                        }

                        // Process this payment
                        await distributePayment(connection, invoice, sigInfo.signature, verified.actualAmount);
                        break;
                    }
                }
            } catch (err) {
                logger.error(`Error checking invoice ${invoice.id}`, "qr", { error: err });
            }
        }
    } catch (error) {
        logger.error("Processing error", "qr", { error });
    }
}

/**
 * SECURITY: Verify payment amount matches expected
 */
async function verifyPaymentAmount(
    connection: Connection,
    tx: VersionedTransactionResponse,
    invoice: any
): Promise<{ success: boolean; actualAmount: number; error?: string }> {
    try {
        const expectedAmount = parseFloat(invoice.remainingAmount);
        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

        if (invoice.currency === "SOL") {
            // Check SOL balance changes
            // Check SOL balance changes
            const preBalances = tx.meta?.preBalances || [];
            const postBalances = tx.meta?.postBalances || [];

            // Handle both VersionedMessage and Message types safely
            const message = tx.transaction.message;
            const accountKeys = (message as any).staticAccountKeys
                ? (message as any).staticAccountKeys.map((k: any) => k.toString())
                : (message as any).accountKeys.map((k: any) => k.toString());

            // Find treasury account index
            const treasuryIndex = accountKeys.findIndex((key: string) =>
                key === treasuryPubkey.toString()
            );

            if (treasuryIndex === -1) {
                return { success: false, actualAmount: 0, error: "Treasury not in transaction" };
            }

            const received = (postBalances[treasuryIndex] - preBalances[treasuryIndex]) / LAMPORTS_PER_SOL;

            // Allow small tolerance for rounding
            if (received < expectedAmount * (1 - AMOUNT_TOLERANCE)) {
                return {
                    success: false,
                    actualAmount: received,
                    error: `Insufficient amount: expected ${expectedAmount}, got ${received}`
                };
            }

            return { success: true, actualAmount: received };

        } else {
            // SPL Token - check token balance changes
            const preTokenBalances = tx.meta?.preTokenBalances || [];
            const postTokenBalances = tx.meta?.postTokenBalances || [];

            // Find treasury token account
            const treasuryPost = postTokenBalances.find((b: any) =>
                b.owner === treasuryPubkey.toString() &&
                b.mint === invoice.tokenMint
            );
            const treasuryPre = preTokenBalances.find((b: any) =>
                b.owner === treasuryPubkey.toString() &&
                b.mint === invoice.tokenMint
            );

            const preAmount = treasuryPre?.uiTokenAmount?.uiAmount || 0;
            const postAmount = treasuryPost?.uiTokenAmount?.uiAmount || 0;
            const received = postAmount - preAmount;

            if (received < expectedAmount * (1 - AMOUNT_TOLERANCE)) {
                return {
                    success: false,
                    actualAmount: received,
                    error: `Insufficient token amount: expected ${expectedAmount}, got ${received}`
                };
            }

            return { success: true, actualAmount: received };
        }
    } catch (error: any) {
        return { success: false, actualAmount: 0, error: error.message };
    }
}

/**
 * Distribute payment: Send 99% to invoicer, keep 1%
 */
async function distributePayment(
    connection: Connection,
    invoice: any,
    incomingSignature: string,
    actualAmount: number
) {
    try {
        // SECURITY: Check if already processed (DB check)
        const existingPayment = await db.query.payments.findFirst({
            where: eq(payments.txSignature, incomingSignature)
        });

        if (existingPayment) {
            logger.info(`Payment ${incomingSignature} already processed`, "qr");
            processedSignatures.add(incomingSignature);
            return;
        }

        // Use actual received amount for calculations (not invoice amount)
        const invoicerAmount = actualAmount * (1 - PLATFORM_FEE_RATE); // 99%
        const feeAmount = actualAmount * PLATFORM_FEE_RATE; // 1%

        // Load payer keypair (Treasury wallet)
        const payerPrivateKey = process.env.PAYER_PRIVATE_KEY!;
        let payerKeypair: Keypair;
        if (payerPrivateKey.includes("[")) {
            payerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(payerPrivateKey)));
        } else {
            payerKeypair = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));
        }

        const invoicerPubkey = new PublicKey(invoice.invoicerWalletAddress);

        // Build distribution transaction
        const transaction = new Transaction();

        if (invoice.currency === "SOL") {
            // SOL distribution
            const lamports = Math.floor(invoicerAmount * LAMPORTS_PER_SOL);
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: payerKeypair.publicKey,
                    toPubkey: invoicerPubkey,
                    lamports
                })
            );
        } else {
            // SPL Token distribution
            if (!invoice.tokenMint) {
                logger.error(`Invoice ${invoice.id} missing tokenMint for SPL distribution`, "qr");
                return;
            }
            const mintPubkey = new PublicKey(invoice.tokenMint);
            const decimals = invoice.tokenDecimals;
            const atomicAmount = Math.floor(invoicerAmount * Math.pow(10, decimals));

            const treasuryAta = await getAssociatedTokenAddress(mintPubkey, payerKeypair.publicKey);
            const invoicerAta = await getAssociatedTokenAddress(mintPubkey, invoicerPubkey);

            transaction.add(
                createTransferInstruction(
                    treasuryAta,
                    invoicerAta,
                    payerKeypair.publicKey,
                    atomicAmount,
                    [],
                    TOKEN_PROGRAM_ID
                )
            );
        }

        // Send distribution transaction
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payerKeypair.publicKey;

        const distributionSig = await sendAndConfirmTransaction(connection, transaction, [payerKeypair]);

        logger.info(`Distributed ${invoicerAmount} ${invoice.currency} to ${invoice.invoicerWalletAddress}`, "qr");
        logger.info(`Distribution tx: ${distributionSig}`, "qr");

        // Record payment in database
        await db.insert(payments).values({
            invoiceId: invoice.id,
            amount: actualAmount.toString(),
            currency: invoice.currency,
            txSignature: incomingSignature,
            fromAddress: "QR_PAYMENT",
            toAddress: invoice.invoicerWalletAddress,
            paymentMethod: "qr_transfer",
            status: "confirmed",
            platformFee: feeAmount.toString(),
            distributionSignature: distributionSig,
            // confirmedAt is default now(), so omitted
        });

        // Update invoice status
        const newPaidAmount = parseFloat(invoice.paidAmount) + actualAmount;
        const newRemainingAmount = parseFloat(invoice.totalAmount) - newPaidAmount;
        const newStatus = newRemainingAmount <= 0 ? "paid" : "partial";

        await db.update(invoices)
            .set({
                status: newStatus,
                paidAmount: newPaidAmount.toString(),
                remainingAmount: Math.max(0, newRemainingAmount).toString(),
                paidAt: newStatus === "paid" ? new Date() : undefined
            })
            .where(eq(invoices.id, invoice.id));

        // Mark as processed
        processedSignatures.add(incomingSignature);

        logger.info(`Invoice ${invoice.id} updated: ${newStatus}`, "qr", { invoiceId: invoice.id, status: newStatus });

    } catch (error) {
        logger.error(`Distribution error for ${invoice.id}`, "qr", { error });
    }
}
