import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
    type Rpc,
    type SolanaRpcApi,
    address,
    getStructDecoder,
    getU64Decoder,
    getU32Decoder,
    getU8Decoder,
    getAddressDecoder,
    getArrayDecoder,
    type Decoder
} from "@solana/kit";

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

// Matches Rust "ListingState" struct
export interface ListingState {
    discriminator: bigint; // 8 bytes
    seller: string;
    price: bigint;
    currencyMint: string;
    assetId: string;
    nonce: bigint;
    index: number;
    root: number[]; // [u8; 32] decodes to number array by default with getArrayDecoder
    bump: number;
}

const listingStateDecoder: Decoder<ListingState> = getStructDecoder([
    ['discriminator', getU64Decoder()],
    ['seller', getAddressDecoder()],
    ['price', getU64Decoder()],
    ['currencyMint', getAddressDecoder()],
    ['assetId', getAddressDecoder()],
    ['nonce', getU64Decoder()],
    ['index', getU32Decoder()],
    ['root', getArrayDecoder(getU8Decoder(), { size: 32 })],
    ['bump', getU8Decoder()],
]);

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
    },

    /**
     * Fetch Listing State using Modern RPC (v2)
     * Demonstrates hybrid usage: API for Writes, Direct RPC for Reads.
     */
    async getListingState(rpc: Rpc<SolanaRpcApi>, listingPda: string): Promise<ListingState | null> {
        try {
            const { value: account } = await rpc.getAccountInfo(address(listingPda), { encoding: 'base64' }).send();
            if (!account || !account.data) return null;

            // Decode the data using the modern codec
            // account.data is [base64_string, encoding] in v2 RPC response? 
            // The @solana/kit RPC client unifies this. 
            // If encoding is base64, data is string.
            // We need to decode base64 string to Uint8Array first.
            const base64Data = account.data[0];
            const dataBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            return listingStateDecoder.decode(dataBytes);
        } catch (e) {
            console.error("Failed to fetch/decode listing state", e);
            throw e;
        }
    }
};
