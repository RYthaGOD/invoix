
import { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { describe, it } from "node:test"; // Or just simple console logs
import assert from "node:assert";

// Mock Data
// Use valid generated keys
const MOCK_WALLET = Keypair.generate().publicKey.toString();
const MOCK_TREASURY = Keypair.generate().publicKey.toString();

const mockBusinessProfile = {
    id: "test-profile-id",
    wallet: MOCK_WALLET,
    businessName: "Test Corp",
    businessEmail: "test@example.com",
    registrationNumber: "123",
    taxId: "456",
    address: "123 St",
    verificationStatus: "verified",
    reputationScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    defaultCurrency: "USD",
    logoUrl: "http://example.com/logo.png",
    websiteUrl: "http://example.com",
    phoneNumber: "1234567890",
    description: "Test Business",
    socialLinks: {},
    metadata: {},
    settings: {}
};

const mockInvoice = {
    id: "test-invoice-id",
    invoiceNumber: "INV-001",
    invoicerWalletAddress: MOCK_WALLET,
    invoiceeWalletAddress: MOCK_TREASURY,
    totalAmount: "100",
    paidAmount: "0",
    remainingAmount: "100",
    subtotal: "100",
    taxAmount: "0",
    discountAmount: "0",
    currency: "USDC",
    tokenDecimals: 6,
    status: "draft",
    dueDate: new Date().toISOString(),
    createdAt: new Date(),
    updatedAt: new Date(),
    invoiceDate: new Date().toISOString(),
    isPrivate: false,
    isArciumEncrypted: false,
    lineItems: []
};

async function verifynftTransactions() {
    console.log("🧪 Verifying NFT Transaction Building...");

    // Initialize with config to skip DB lookups
    const { InvoiceNFTService } = await import("../server/nft-service");

    // Explicitly pass valid RPC URL to avoid Umi initialization errors
    const nftService = new InvoiceNFTService(
        "https://api.devnet.solana.com",
        {
            merkleTreeAddress: MOCK_TREASURY, // Mock
            collectionMintAddress: MOCK_TREASURY // Mock
        }
    );

    // We still call initialize to set up Umi, but with the config it should skip DB
    const initialized = await nftService.initialize();
    if (!initialized) {
        console.warn("⚠️ Service failed to initialize (check .env or funds). Continuing might fail if keys are missing.");
    }

    try {
        // 1. Verify Business Identity Mint Transaction
        console.log("\n1️⃣  Testing Business Identity Mint Transaction...");
        const bizResult = await nftService.createBusinessIdentityMintTransaction(
            // @ts-ignore - Close enough mock
            mockBusinessProfile,
            MOCK_WALLET,
            MOCK_TREASURY,
            "verified",
            0.005 * LAMPORTS_PER_SOL // Custom fee
        );

        console.log("   ✅ Transaction built successfully!");
        console.log(`   Mint Address: ${bizResult.mint}`);
        console.log(`   Tx Length: ${bizResult.transaction.length}`);

        // Verify deserialization
        const bizTxBuffer = Buffer.from(bizResult.transaction, 'base64');
        const bizTx = VersionedTransaction.deserialize(bizTxBuffer);
        console.log("   ✅ Transaction deserialized successfully.");

        // 2. Verify Invoice Mint Transaction
        console.log("\n2️⃣  Testing Invoice Mint Transaction...");
        const invResult = await nftService.createMintInvoiceTransaction(
            // @ts-ignore
            mockInvoice,
            MOCK_WALLET
        );

        console.log("   ✅ Transaction built successfully!");
        console.log(`   Tx Length: ${invResult.length}`);

        // Verify deserialization
        const invTxBuffer = Buffer.from(invResult, 'base64');
        const invTx = VersionedTransaction.deserialize(invTxBuffer);
        console.log("   ✅ Transaction deserialized successfully.");

    } catch (error: any) {
        console.error("\n❌ Verification Failed:", error);
        process.exit(1);
    }
}

verifynftTransactions().catch(console.error);
