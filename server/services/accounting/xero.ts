import { db } from "../../db";
import { businessProfiles, invoices } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";
// import { XeroClient } from "xero-node"; // We'll need to add this dep

// Placeholder for Xero Client (would be initialized with env vars)
// const xero = new XeroClient({
//   clientId: process.env.XERO_CLIENT_ID,
//   clientSecret: process.env.XERO_CLIENT_SECRET,
//   redirectUris: [process.env.XERO_REDIRECT_URI],
//   scopes: 'offline_access accounting.transactions openid profile email'.split(" "),
// });

export class XeroService {

    /**
     * Generates the authorization URL for the user to login to Xero.
     */
    async getAuthUrl(state: string): Promise<string> {
        // Stub
        const mockUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=openid profile email accounting.transactions&state=${state}`;
        return mockUrl;
        // return (await xero.buildConsentUrl()).toString();
    }

    /**
     * Exchanges the callback code for an access token.
     * Note: In a real implementation, we would encrypt these tokens before saving.
     */
    async handleCallback(code: string, userId: number) {
        console.log(`[Xero] Exchanging code ${code} for user ${userId}`);

        // Stub: Fetch token
        // const tokenSet = await xero.apiCallback(code);

        const mockToken = {
            access_token: "mock_access_token_" + Date.now(),
            refresh_token: "mock_refresh_token_" + Date.now(),
            expires_at: Date.now() + 3600 * 1000
        };

        // Save connection to DB
        // We need a column for xero_connection_data first (jsonb)
        // For now, we'll just log it as we haven't migrated the schema for this yet (Phase 5 plan)
        console.log(`[Xero] Connected! Token:`, mockToken);

        return mockToken;
    }

    /**
     * Mocks a spot rate conversion for NZD.
     * In production, this would call a FX API (e.g. fixer.io, alphavantage).
     */
    private async getMockNzdRate(currency: string): Promise<number> {
        if (currency === "NZD") return 1.0;
        if (currency === "USDC" || currency === "USDT") return 1.65; // Mock: 1 USD = 1.65 NZD
        return 1.0;
    }

    /**
     * Maps an Invoix invoice to Xero Invoice format.
     */
    private async mapInvoiceToXero(invoice: any, lineItems: any[]) {
        const rate = await this.getMockNzdRate(invoice.currency);

        return {
            Type: "ACCRECV", // Accounts Receivable
            Contact: {
                Name: invoice.invoiceeWalletAddress.substring(0, 10) + "..." // Placeholder contact
            },
            Date: invoice.invoiceDate,
            DueDate: invoice.dueDate,
            InvoiceNumber: invoice.invoiceNumber,
            Reference: `Invoix-Solana-${invoice.id}`,
            Status: "AUTHORISED",
            CurrencyCode: "NZD", // Always sync to NZD for NZ SME focus
            LineAmountTypes: "Exclusive",
            LineItems: lineItems.map(item => ({
                Description: item.description,
                Quantity: parseFloat(item.quantity),
                UnitAmount: parseFloat(item.unitPrice) * rate,
                AccountCode: "200", // Default Sales account
                TaxType: "OUTPUT2", // NZ GST (15%)
            }))
        };
    }

    /**
     * Pushes an invoice to Xero.
     */
    async syncInvoice(invoice: any, lineItems: any[]) {
        console.log(`[Xero] Syncing invoice ${invoice.id} to Xero...`);

        try {
            // 1. Map to Xero format
            const xeroInvoice = await this.mapInvoiceToXero(invoice, lineItems);
            console.log(`[Xero] Mapped payload (NZD conversion applied):`, JSON.stringify(xeroInvoice, null, 2));

            // 2. Refresh token if expired (Stub)

            // 3. POST to /Invoices (Stub)
            // await xero.accountingApi.createInvoices(tenantId, { invoices: [xeroInvoice] });
            const mockXeroId = "mock_xero_id_" + Date.now();

            // 4. Update Invoix DB with the Xero ID
            await db.update(invoices)
                .set({ xeroInvoiceId: mockXeroId })
                .where(eq(invoices.id, invoice.id));

            return { success: true, xeroId: mockXeroId };
        } catch (error) {
            console.error("[Xero] Sync failed:", error);
            return { success: false, error };
        }
    }
}

export const xeroService = new XeroService();
