import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";

export interface ListingResponse {
    success: boolean;
    transaction?: string; // Base64 encoded transaction
    listing?: {
        id: string;
        status: string;
    };
    error?: string;
    message?: string;
}

export interface ListInvoiceParams {
    invoiceId: string;
    askingPrice: number;
    description: string;
    expiresInDays: number;
    isBlind?: boolean;
}

export const marketplaceSdk = {
    /**
     * List an invoice for sale on the marketplace.
     * Returns a transaction that must be signed by the user (Seller).
     */
    async listInvoice(params: ListInvoiceParams): Promise<ListingResponse> {
        try {
            const response = await fetch("/api/marketplace/list", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoiceId: params.invoiceId,
                    askingPrice: params.askingPrice.toString(),
                    description: params.description,
                    expiresInDays: params.expiresInDays,
                    isBlind: params.isBlind || false
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create listing transaction");
            }

            return data;
        } catch (error: any) {
            throw new Error(error.message || "Marketplace listing failed");
        }
    },

    /**
     * Deserialize a base64 transaction string into a Solana Transaction object
     */
    deserializeTransaction(base64Tx: string): VersionedTransaction {
        const txBuffer = Uint8Array.from(atob(base64Tx), c => c.charCodeAt(0));
        return VersionedTransaction.deserialize(txBuffer);
    }
};
