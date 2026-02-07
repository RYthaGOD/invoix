import { db } from "../../db";
import { businessProfiles, invoices } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";

export class QuickBooksService {

    /**
     * Generates the authorization URL for the user to login to QuickBooks.
     */
    async getAuthUrl(state: string): Promise<string> {
        // Stub
        const mockUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=com.intuit.quickbooks.accounting&state=${state}`;
        return mockUrl;
    }

    /**
     * Exchanges the callback code for an access token.
     */
    async handleCallback(code: string, userId: number) {
        console.log(`[QuickBooks] Exchanging code ${code} for user ${userId}`);

        const mockToken = {
            access_token: "mock_qbo_access_token_" + Date.now(),
            refresh_token: "mock_qbo_refresh_token_" + Date.now(),
            expires_at: Date.now() + 3600 * 1000
        };

        console.log(`[QuickBooks] Connected! Token:`, mockToken);
        return mockToken;
    }

    /**
     * Mocks a spot rate conversion for NZD.
     */
    private async getMockNzdRate(currency: string): Promise<number> {
        if (currency === "NZD") return 1.0;
        if (currency === "USDC" || currency === "USDT") return 1.65;
        return 1.0;
    }

    /**
     * Maps an Invoix invoice to QBO format.
     */
    private async mapInvoiceToQBO(invoice: any, lineItems: any[]) {
        const rate = await this.getMockNzdRate(invoice.currency);

        return {
            Line: lineItems.map(item => ({
                Description: item.description,
                Amount: parseFloat(item.unitPrice) * parseFloat(item.quantity) * rate,
                DetailType: "SalesItemLineDetail",
                SalesItemLineDetail: {
                    Qty: parseFloat(item.quantity),
                    UnitPrice: parseFloat(item.unitPrice) * rate,
                }
            })),
            CustomerRef: {
                value: "mock_customer_id",
                name: invoice.invoiceeWalletAddress.substring(0, 10) + "..."
            },
            CurrencyRef: {
                value: "NZD"
            }
        };
    }

    /**
     * Pushes an invoice to QBO.
     */
    async syncInvoice(invoice: any, lineItems: any[]) {
        console.log(`[QuickBooks] Syncing invoice ${invoice.id} to QBO...`);

        try {
            const qboInvoice = await this.mapInvoiceToQBO(invoice, lineItems);
            console.log(`[QuickBooks] Mapped payload (NZD conversion):`, JSON.stringify(qboInvoice, null, 2));

            const mockQboId = "mock_qbo_id_" + Date.now();

            // 4. Update Invoix DB with the QBO ID
            await db.update(invoices)
                .set({ qboInvoiceId: mockQboId })
                .where(eq(invoices.id, invoice.id));

            return { success: true, qboId: mockQboId };
        } catch (error) {
            console.error("[QuickBooks] Sync failed:", error);
            return { success: false, error };
        }
    }
}

export const quickBooksService = new QuickBooksService();
