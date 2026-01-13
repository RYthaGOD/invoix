import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import request from "supertest";
import { app } from "./setup-integration";
import { db, schema } from "../server/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// ============================================
// MOCKS
// ============================================

// Mock the Marketplace Service to avoid real Solana interaction
vi.mock("../server/marketplace-service", () => ({
    marketplaceService: {
        createListInvoiceTransaction: vi.fn().mockResolvedValue("mock_base64_list_transaction"),
        createBuyInvoiceTransaction: vi.fn().mockResolvedValue("mock_base64_buy_transaction"),
    }
}));

// Mock Stablecoin Config
vi.mock("@shared/stablecoin-config", () => ({
    getStablecoinConfig: vi.fn().mockReturnValue({
        mint: "USDC_MINT_ADDRESS",
        decimals: 6
    })
}));

// Mock Solana SDK (for confirmation check)
vi.mock("../server/solana-sdk", () => ({
    getSolanaConnection: () => ({
        getSignatureStatus: vi.fn().mockResolvedValue({ value: { err: null } })
    })
}));

// Mock NFT Service check in confirm-purchase
vi.mock("../server/nft-service", () => ({
    getInvoiceNFTService: () => ({}), // Return empty obj, we mocked the connection usage inside the route
    getReadyNftService: async () => ({}),
    initializeNFTService: vi.fn().mockResolvedValue(true)
}));

// Mock Arcium Service to prevent startup crash
vi.mock("../server/arcium-service", () => ({
    initializeArciumService: vi.fn().mockResolvedValue(true),
    getArciumService: () => ({}),
    loadKeypairFromPrivateKey: vi.fn().mockReturnValue({ publicKey: { toString: () => "MockWallet" } })
}));

// Mock Credit Scoring Service
vi.mock("../server/credit-scoring-service", () => ({
    initializeCreditScoringService: vi.fn().mockResolvedValue(true),
    creditScoringService: {
        getScore: vi.fn().mockResolvedValue({ score: 750, tier: "gold" }),
        getQuickScore: vi.fn().mockResolvedValue({ score: 750, tier: "gold" })
    }
}));


// ============================================
// TEST DATA
// ============================================

const SELLER_WALLET = "SellerWallet11111111111111111111111111111111";
const BUYER_WALLET = "BuyerWallet22222222222222222222222222222222";

describe("Marketplace Deep Verification (List -> Buy flow)", () => {
    let invoiceId: string;
    let listingId: string;

    beforeAll(async () => {
        // Setup: Create an Invoice for the Seller
        invoiceId = randomUUID();

        await db.insert(schema.invoices).values({
            id: invoiceId,
            invoiceNumber: `INV-${Date.now()}`,
            invoicerWalletAddress: SELLER_WALLET,
            invoiceeWalletAddress: "CustomerWallet33333333333333333333333333",
            totalAmount: "1000.00",
            subtotal: "1000.00",
            remainingAmount: "1000.00",
            currency: "USDC",
            status: "sent", // Must be 'sent' to list
            dueDate: new Date(Date.now() + 86400000 * 30),
            invoiceDate: new Date(),
            nftMint: "MockNftMintUpdatedDuringMinting",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`[Setup] Created Test Invoice: ${invoiceId}`);
    });

    // Clean up after tests
    afterAll(async () => {
        await db.delete(schema.invoiceMarketplace).where(eq(schema.invoiceMarketplace.invoiceId, invoiceId));
        await db.delete(schema.invoices).where(eq(schema.invoices.id, invoiceId));
    });

    it("1. Seller can LIST an invoice", async () => {
        const res = await request(app)
            .post("/api/marketplace/list")
            .set("X-Test-Auth", SELLER_WALLET) // Mock Auth
            .send({
                invoiceId,
                askingPrice: "900.00", // 10% discount
                description: "Test Listing",
                expiresInDays: 7
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.transaction).toBe("mock_base64_list_transaction");
        expect(res.body.listing).toBeDefined();

        listingId = res.body.listing.id;
        console.log(`[Step 1] Listing Created: ${listingId}`);
    });

    it("2. Listing appears in the marketplace feed", async () => {
        const res = await request(app).get("/api/marketplace/listings");

        expect(res.status).toBe(200);
        const listing = res.body.listings.find((l: any) => l.id === listingId);
        expect(listing).toBeDefined();
        expect(listing.askingPrice).toBe("900.00");
        expect(listing.sellerTruncated).toBeDefined();
    });

    it("3. Seller cannot buy their own listing", async () => {
        const res = await request(app)
            .post("/api/marketplace/purchase")
            .set("X-Test-Auth", SELLER_WALLET)
            .send({ listingId });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain("Cannot buy your own listing");
    });

    it("4. Buyer can generates purchase transaction", async () => {
        const res = await request(app)
            .post("/api/marketplace/purchase")
            .set("X-Test-Auth", BUYER_WALLET)
            .send({ listingId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.transaction).toBe("mock_base64_buy_transaction");
    });

    it("5. Buyer confirms purchase (Finalize Settlement)", async () => {
        const res = await request(app)
            .post("/api/marketplace/confirm-purchase")
            .set("X-Test-Auth", BUYER_WALLET)
            .send({
                listingId,
                signature: "mock_signature_of_success"
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify DB State
        const [listing] = await db.select()
            .from(schema.invoiceMarketplace)
            .where(eq(schema.invoiceMarketplace.id, listingId));

        expect(listing.status).toBe("sold");
        expect(listing.soldTo).toBe(BUYER_WALLET);

        const [invoice] = await db.select()
            .from(schema.invoices)
            .where(eq(schema.invoices.id, invoiceId));

        expect(invoice.nftTransferredTo).toBe(BUYER_WALLET);
        console.log(`[Step 5] Purchase Confirmed. Owner: ${invoice.nftTransferredTo}`);
    });
});
