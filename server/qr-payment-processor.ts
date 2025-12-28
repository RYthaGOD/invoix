/**
 * QR Payment Processor
 * 
 * Monitors for QR payments sent to Treasury and distributes to invoicers.
 * Flow: User pays Treasury → Backend detects → Forward 99% to invoicer
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { db } from "./db";
import { invoices, payments } from "@shared/invoice-schema";
import { eq, and, isNull } from "drizzle-orm";
import { TREASURY_WALLET_ADDRESS } from "@shared/config";
import bs58 from "bs58";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const POLL_INTERVAL_MS = 15000; // Check every 15 seconds
const PLATFORM_FEE_RATE = 0.01; // 1% platform fee

let isRunning = false;

/**
 * Start the QR payment processor
 */
export function startQRPaymentProcessor() {
    if (isRunning) {
        console.log("[QR_PROCESSOR] Already running");
        return;
    }

    if (!process.env.PAYER_PRIVATE_KEY) {
        console.warn("[QR_PROCESSOR] PAYER_PRIVATE_KEY not set - QR payment distribution disabled");
        return;
    }

    isRunning = true;
    console.log("✅ QR Payment Processor started");

    // Run immediately, then on interval
    processQRPayments();
    setInterval(processQRPayments, POLL_INTERVAL_MS);
}

/**
 * Main processing loop
 */
async function processQRPayments() {
    try {
        // 1. Find invoices waiting for QR payment (status = sent or viewed, not paid)
        const pendingInvoices = await db.query.invoices.findMany({
            where: and(
                eq(invoices.status, "sent"),
            ),
            limit: 20
        });

        if (pendingInvoices.length === 0) return;

        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const treasuryPubkey = new PublicKey(TREASURY_WALLET_ADDRESS);

        // 2. Check each invoice for QR payment
        for (const invoice of pendingInvoices) {
            try {
                const qrReference = `QR-${invoice.id}`;

                // Search for transactions with this memo
                const signatures = await connection.getSignaturesForAddress(
                    treasuryPubkey,
                    { limit: 50 }
                );

                for (const sigInfo of signatures) {
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
                        console.log(`[QR_PROCESSOR] Found payment for invoice ${invoice.id}: ${sigInfo.signature}`);

                        // Process this payment
                        await distributePayment(connection, invoice, sigInfo.signature);
                        break;
                    }
                }
            } catch (err) {
                console.error(`[QR_PROCESSOR] Error checking invoice ${invoice.id}:`, err);
            }
        }
    } catch (error) {
        console.error("[QR_PROCESSOR] Processing error:", error);
    }
}

/**
 * Distribute payment: Send 99% to invoicer, keep 1%
 */
async function distributePayment(
    connection: Connection,
    invoice: any,
    incomingSignature: string
) {
    try {
        // Check if already processed
        const existingPayment = await db.query.payments.findFirst({
            where: eq(payments.txSignature, incomingSignature)
        });

        if (existingPayment) {
            console.log(`[QR_PROCESSOR] Payment ${incomingSignature} already processed`);
            return;
        }

        const amount = parseFloat(invoice.remainingAmount);
        const invoicerAmount = amount * (1 - PLATFORM_FEE_RATE); // 99%
        const feeAmount = amount * PLATFORM_FEE_RATE; // 1%

        // Load payer keypair
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

        console.log(`[QR_PROCESSOR] Distributed ${invoicerAmount} ${invoice.currency} to ${invoice.invoicerWalletAddress}`);
        console.log(`[QR_PROCESSOR] Distribution tx: ${distributionSig}`);

        // Record payment in database
        await db.insert(payments).values({
            invoiceId: invoice.id,
            amount: invoice.remainingAmount,
            currency: invoice.currency,
            txSignature: incomingSignature,
            fromAddress: "QR_PAYMENT", // We don't know the payer's address from memo lookup
            toAddress: invoice.invoicerWalletAddress,
            paymentMethod: "qr_transfer",
            status: "confirmed",
            platformFee: feeAmount.toString(),
            distributionSignature: distributionSig
        } as any);

        // Update invoice status
        await db.update(invoices)
            .set({
                status: "paid",
                paidAmount: invoice.totalAmount,
                remainingAmount: "0",
                paidAt: new Date()
            })
            .where(eq(invoices.id, invoice.id));

        console.log(`[QR_PROCESSOR] ✅ Invoice ${invoice.id} marked as paid`);

    } catch (error) {
        console.error(`[QR_PROCESSOR] Distribution error for ${invoice.id}:`, error);
    }
}
