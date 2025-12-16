
import { db } from "./db";
import { payments, paymentReceiptNFTs, invoices } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { getInvoiceNFTService } from "./nft-service";
import { Connection } from "@solana/web3.js";
import crypto from "crypto";

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");

/**
 * Handles post-payment logic:
 * 1. Waits for confirmation
 * 2. Updates Payment Status in DB
 * 3. Mints Receipt NFT
 */
export async function confirmPaymentAndMintOutcome(signature: string, invoiceId: string, payerAddress: string) {
    try {
        console.log(`[PAYMENT] Confirming payment ${signature} for invoice ${invoiceId}...`);

        // 1. Confirm Transaction
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            signature,
            ...latestBlockhash
        }, "confirmed");

        console.log(`[PAYMENT] Confirmed! Updating DB...`);

        // 2. Fetch Invoice Details
        const invoiceList = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
        if (!invoiceList.length) return;
        const invoice = invoiceList[0];

        // 3. Insert Payment Record
        const paymentId = crypto.randomUUID();
        const paymentData = {
            id: paymentId,
            invoiceId: invoiceId,
            paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
            amount: invoice.remainingAmount, // Assuming full payment
            currency: invoice.currency,
            txSignature: signature,
            fromAddress: payerAddress,
            toAddress: invoice.invoicerWalletAddress,
            status: "confirmed",
            confirmedAt: new Date(),
        };

        await db.insert(payments).values(paymentData);

        // 4. Update Invoice Status
        await db.update(invoices).set({
            status: "paid",
            paidAmount: invoice.totalAmount,
            remainingAmount: "0",
            paidAt: new Date(),
        }).where(eq(invoices.id, invoiceId));

        // 5. Special Logic: Community NFT Drop
        if (invoice.description === "Exclusive Community NFT Mint") {
            console.log(`[PAYMENT] Community Drop Payment Detected! Minting Standard NFT...`);
            const nftService = getInvoiceNFTService();
            if (nftService.isReady()) {
                try {
                    // Airdrop the Special NFT to the payer
                    await nftService.mintSpecialNFT(payerAddress, invoiceId);
                    console.log(`[NFT] Special NFT Airdropped to ${payerAddress}`);
                } catch (mintError) {
                    console.error("[NFT] Failed to mint special NFT:", mintError);
                }
            }
            return;
        }

        // 6. Standard Receipt NFT
        console.log(`[NFT] Minting Receipt NFT...`);
        const nftService = getInvoiceNFTService();
        if (nftService.isReady()) {

            // Construct the payment object expected by the service
            // We use 'as any' safely here because paymentData matches the DB schema expected by SelectPayment
            const receiptResult = await nftService.mintPaymentReceiptNFT({
                payment: paymentData as any,
                invoice: invoice,
                recipientAddress: payerAddress
            });

            console.log(`[NFT] Receipt Minted: ${receiptResult.mint}`);

            // Save to DB
            await db.insert(paymentReceiptNFTs).values({
                paymentId,
                invoiceId,
                nftMint: receiptResult.mint,
                nftMetadataUri: "https://arweave.net/placeholder", // Placeholder
                nftOwner: payerAddress,
                receiptNumber: `RCPT-${Date.now()}`,
                amount: invoice.remainingAmount,
                currency: invoice.currency,
                paymentDate: new Date(),
                taxYear: new Date().getFullYear(),
                txSignature: signature,
                nftMintSignature: receiptResult.signature
            });
        }

    } catch (error) {
        console.error(`[PAYMENT] Error confirming/minting for ${signature}:`, error);
    }
}
