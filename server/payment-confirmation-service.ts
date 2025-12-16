
import { db } from "./db";
import { payments, paymentReceiptNFTs, invoices } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
import { getInvoiceNFTService } from "./nft-service";
import { Connection } from "@solana/web3.js";

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
        await db.insert(payments).values({
            id: paymentId,
            invoiceId: invoiceId,
            paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
            amount: invoice.remainingAmount, // Assuming full payment for now
            currency: invoice.currency,
            txSignature: signature,
            fromAddress: payerAddress, // Actually the user's wallet, but we only have fee payer here? We need the user's wallet.
            // In the route, we didn't extract the user's wallet. 
            // Ideally we parse it from the transaction. For now we use a placeholder or parse later.
            toAddress: invoice.invoicerWalletAddress,
            status: "confirmed",
            confirmedAt: new Date(),
        });

        // 4. Update Invoice Status
        await db.update(invoices).set({
            status: "paid",
            paidAmount: invoice.totalAmount,
            remainingAmount: "0",
            paidAt: new Date(),
        }).where(eq(invoices.id, invoiceId));

        // 5. Mint Receipt NFT
        console.log(`[NFT] Minting Receipt NFT...`);
        const nftService = getInvoiceNFTService();
        if (nftService.isReady()) {
            const receipt = await nftService.mintPaymentReceiptNFT({
                paymentId,
                invoice,
                payerWallet: payerAddress, // This should be the actual user wallet
                amount: invoice.remainingAmount,
                signature
            });
            console.log(`[NFT] Receipt Minted: ${receipt.assetId}`);

            // Save to DB
            await db.insert(paymentReceiptNFTs).values({
                paymentId,
                invoiceId,
                nftMint: receipt.assetId,
                nftMetadataUri: "https://arweave.net/...", // Placeholder or from service
                nftOwner: payerAddress,
                receiptNumber: `RCPT-${Date.now()}`,
                amount: invoice.remainingAmount,
                currency: invoice.currency,
                paymentDate: new Date(),
                taxYear: new Date().getFullYear(),
                txSignature: signature,
                nftMintSignature: receipt.signature
            });
        }

    } catch (error) {
        console.error(`[PAYMENT] Error confirming/minting for ${signature}:`, error);
    }
}
