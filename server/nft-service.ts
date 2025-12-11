/**
 * pNFT Service for B2B Invoicing System
 * 
 * Implements programmable NFTs for:
 * 1. Invoice NFTs - Each invoice as a tradeable NFT
 * 2. Payment Receipt NFTs - Proof of payment for tax/audit
 * 3. Business Identity NFTs - Verified business credentials
 * 
 * Using Metaplex Bubblegum for compressed NFTs (95% cost savings)
 * Cost: ~$0.001 per NFT vs $0.02 for standard NFTs
 */

import {
  createTree,
  mintV1,
  transfer as transferV1,
  burn as burnV1,
  updateMetadata,
  // Type imports
  // CreateTreeInstructionAccounts, // Removed
  MintV1InstructionAccounts,
  TransferInstructionAccounts,
  BurnInstructionAccounts,
} from "@metaplex-foundation/mpl-bubblegum";
import {
  createNft,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createGenericFile,
  generateSigner,
  percentAmount,
  publicKey as toPublicKey,
  some,
  none,
  Umi,
  Signer,
  keypairIdentity,
  transactionBuilder,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import type {
  SelectInvoice,
  SelectPayment,
  SelectBusinessProfile,
} from "@shared/invoice-schema";
import { getMetadataStorageService } from "./metadata-storage";

/**
 * NFT Metadata for Invoice
 */
interface InvoiceNFTMetadata {
  name: string;
  symbol: string;
  uri: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  properties: {
    category: string;
    creators: Array<{
      address: string;
      share: number;
      verified?: boolean;
    }>;
  };
}

/**
 * Configuration for NFT minting
 */
interface NFTMintConfig {
  autoMint: boolean; // Auto-mint invoices on creation
  merkleTreeAddress?: string; // Existing tree or create new
  maxDepth: number; // Tree depth (affects max NFTs)
  maxBufferSize: number; // Buffer size
  canopyDepth: number; // Canopy depth for cheaper transfers
}

/**
 * Default NFT configuration
 */
const DEFAULT_CONFIG: NFTMintConfig = {
  autoMint: true,
  merkleTreeAddress: process.env.MERKLE_TREE_ADDRESS || undefined,
  maxDepth: 14, // Supports 16,384 NFTs
  maxBufferSize: 64,
  canopyDepth: 11, // Cheaper transfers
};

/**
 * Invoice NFT Service
 * Handles all NFT operations for the invoicing system
 */
export class InvoiceNFTService {
  private umi: Umi;
  private config: NFTMintConfig;
  private merkleTree: string | null = null;
  private initialized: boolean = false;

  constructor(
    rpcEndpoint?: string,
    config: Partial<NFTMintConfig> = {}
  ) {
    const endpoint = rpcEndpoint || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.umi = createUmi(endpoint);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the NFT service
   * Creates merkle tree if needed
   */
  async initialize(payerKeypair?: Keypair): Promise<boolean> {
    try {
      // Set up UMI with payer if provided
      if (payerKeypair) {
        // Convert Solana Keypair to Umi format
        const umiKeypair = this.umi.eddsa.createKeypairFromSecretKey(
          payerKeypair.secretKey
        );
        this.umi.use({ install: (umi) => { umi.payer = umiKeypair as unknown as Signer; } });
      }

      // 1. Check .env first (override)
      if (this.config.merkleTreeAddress) {
        this.merkleTree = this.config.merkleTreeAddress;
      } else {
        // 2. Check Database for persisted tree
        const { systemSettings } = await import("@shared/invoice-schema");
        const { db } = await import("./db");
        const { eq } = await import("drizzle-orm");

        const storedTree = await db.select().from(systemSettings).where(eq(systemSettings.key, "merkle_tree_address")).limit(1);

        if (storedTree.length > 0) {
          this.merkleTree = storedTree[0].value;
          console.log(`✅ Loaded Merkle Tree from DB: ${this.merkleTree}`);
        } else {
          // 3. Create new tree if none exists
          await this.createMerkleTree();

          // Persist to DB
          await db.insert(systemSettings).values({
            key: "merkle_tree_address",
            value: this.merkleTree!,
            description: "Compressed NFT Merkle Tree Address",
          });
          console.log(`💾 Persisted Merkle Tree to DB`);
        }
      }

      this.initialized = true;
      console.log("✅ Invoice NFT service initialized");

      return true;
    } catch (error) {
      console.error("❌ Failed to initialize NFT service:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && this.merkleTree !== null;
  }

  /**
   * Create a new merkle tree for compressed NFTs
   */
  private async createMerkleTree(): Promise<string> {
    try {
      const merkleTreeSigner = generateSigner(this.umi);

      const createTreeIx = await createTree(this.umi, {
        merkleTree: merkleTreeSigner,
        maxDepth: this.config.maxDepth,
        maxBufferSize: this.config.maxBufferSize,
        canopyDepth: this.config.canopyDepth,
      });

      await createTreeIx.sendAndConfirm(this.umi);

      this.merkleTree = merkleTreeSigner.publicKey.toString();
      console.log(`✅ Created merkle tree: ${this.merkleTree}`);
      console.warn(`⚠️  IMPORTANT: Add MERKLE_TREE_ADDRESS=${this.merkleTree} to your .env file to persist this tree!`);

      return this.merkleTree;
    } catch (error) {
      console.error("❌ Failed to create merkle tree:", error);
      throw error;
    }
  }

  /**
   * Mint Invoice NFT
   * Creates a compressed NFT for an invoice
   */


  /**
   * Create a transaction for the client to mint the invoice NFT (User pays gas)
   * 
   * @param invoice - The invoice data
   * @param userPublicKey - The public key of the user (will be payer and leaf owner)
   * @returns Base64 encoded transaction string
   */
  async createMintInvoiceTransaction(
    invoice: SelectInvoice,
    userPublicKey: string
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Generate metadata
      const metadata = this.generateInvoiceMetadata(invoice);

      // Upload metadata 
      // Note: If user is paying, ideally we'd also let them upload or we upload first.
      // For now, server uploads metadata using its storage service (minimal cost).
      const metadataUri = await this.uploadMetadata(metadata, `invoice-${invoice.id}`);

      const leafOwner = toPublicKey(userPublicKey);
      const merkleTreePubkey = toPublicKey(this.merkleTree!);

      // Create Mint Instruction
      // We explicitly set the payer to the user
      // Buider: mintV1(umi, { ... })
      const builder = mintV1(this.umi, {
        leafOwner,
        merkleTree: merkleTreePubkey,
        metadata: {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: 0,
          collection: none(),
          creators: [
            {
              address: toPublicKey(invoice.invoicerWalletAddress),
              verified: true,
              share: 100,
            },
          ],
        },
      });

      // The builder by default uses umi.identity as payer. 
      // We must change the fee payer to the user.
      // However, we can't sign for the user. We only sign for the Tree Authority (server).

      // 1. Build transaction with Server as identity (Tree Authority)
      let tx = await builder.buildAndSign(this.umi);

      // 2. Deserialize to inspect/modify? 
      // Umi's buildAndSign returns a Transaction (with signatures).
      // We need to verify if we can just reassign fee payer validation?

      // Easier approach: Use `setFeePayer` on builder if available, or just instruct UMI
      // Not straightforward in UMI 0.8+ without the signer object.
      // We will create a "Placeholder Signer" for the user.

      const userSigner: Signer = {
        publicKey: toPublicKey(userPublicKey),
        signMessage: async (msg) => msg, // Mock
        signTransaction: async (tx) => tx, // Mock
        signAllTransactions: async (txs) => txs, // Mock
      };

      // Re-build with user as payer
      const builderWithPayer = builder.setFeePayer(userSigner);

      // Now we need the Server to sign as the Authority (Merkle Tree Delegate/Owner)
      // The builder should automatically include the Authority signer from umi context if it matches.

      // Build but don't sign yet to control checking
      // Actually, buildAndSign will try to sign with all known signers.
      // Since userSigner is a mock, it won't actually sign.
      // But we DO want the Server (umi.identity) to sign as LeafDelegate/TreeCreator.

      // Let's use `transactionBuilder()` to compose if needed, but mintV1 is fine.

      // IMPORTANT: We need to serialize this to a format the Client can sign.
      // The Client needs a standard Solana Transaction or VersionedTransaction.
      // Umi works with its own Transaction type. We need to convert.

      // We will rely on `umi.transactions` to serialize.
      // But first, we must ensure the Authority (Server) HAS signed.

      // Force Authority signature (Server)
      // The `mintV1` instruction uses `merkleTree` and `treeAuthority` (derived or explicit).
      // The `treeAuthority` defaults to umi.identity.

      tx = await builderWithPayer.buildAndSign(this.umi);

      // At this point, `tx` has the Server's signature for the instruction.
      // It is missing the Payer's (User) signature.
      // The mock signer just returned the tx as is.

      // Serialize to base64
      const serializedTransaction = this.umi.transactions.serialize(tx);
      const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

      console.log(`✅ Created Mint Transaction for User ${userPublicKey}`);
      return base64Transaction;

    } catch (error) {
      console.error(`❌ Failed to create mint transaction:`, error);
      throw error;
    }
  }

  /**
   * Mint Payment Receipt NFT
   * Creates NFT proof of payment for tax/audit purposes
   */
  async mintPaymentReceiptNFT(
    payment: SelectPayment,
    invoice: SelectInvoice,
    recipientAddress: string
  ): Promise<{
    mint: string;
    signature: string;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Generate payment receipt metadata
      const metadata = this.generatePaymentReceiptMetadata(payment, invoice);

      // Upload metadata
      const metadataUri = await this.uploadMetadata(
        metadata,
        `payment-${payment.id}`
      );

      // Mint as standard NFT (receipts should be permanent, not compressed)
      const mint = generateSigner(this.umi);

      const createNftIx = await createNft(this.umi, {
        mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
        tokenStandard: TokenStandard.NonFungible,
        creators: [
          {
            address: toPublicKey(payment.fromAddress),
            verified: true,
            share: 100,
          },
        ],
      } as any);

      const result = await createNftIx.sendAndConfirm(this.umi);

      console.log(`✅ Minted payment receipt NFT for payment ${payment.id}`);

      return {
        mint: mint.publicKey.toString(),
        signature: result.signature.toString(),
      };
    } catch (error) {
      console.error(`❌ Failed to mint payment receipt NFT:`, error);
      throw error;
    }
  }

  /**
   * Mint Business Identity NFT
   * Creates verified business credential NFT
   */
  async mintBusinessIdentityNFT(
    businessProfile: SelectBusinessProfile,
    verificationLevel: "basic" | "verified" | "premium" = "basic"
  ): Promise<{
    mint: string;
    signature: string;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Generate business identity metadata
      const metadata = this.generateBusinessIdentityMetadata(
        businessProfile,
        verificationLevel
      );

      // Upload metadata
      const metadataUri = await this.uploadMetadata(
        metadata,
        `business-${businessProfile.id}`
      );

      // Mint as standard NFT (identity should be permanent)
      const mint = generateSigner(this.umi);

      const createNftIx = createNft(this.umi, {
        mint,
        name: metadata.name,
        symbol: "BIZ",
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
        tokenStandard: TokenStandard.NonFungible,
        creators: [
          {
            address: toPublicKey(businessProfile.ownerWalletAddress),
            verified: true,
            share: 100,
          },
        ],
      } as any);

      const result = await createNftIx.sendAndConfirm(this.umi);

      console.log(`✅ Minted business identity NFT for ${businessProfile.businessName}`);

      return {
        mint: mint.publicKey.toString(),
        signature: result.signature.toString(),
      };
    } catch (error) {
      console.error(`❌ Failed to mint business identity NFT:`, error);
      throw error;
    }
  }

  /**
   * Transfer invoice NFT (for invoice financing)
   */
  async transferInvoiceNFT(
    nftMint: string,
    merkleTree: string,
    leafIndex: number,
    fromAddress: string,
    toAddress: string
  ): Promise<{ signature: string }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      const transferIx = transferV1(this.umi, {
        merkleTree: toPublicKey(merkleTree),
        leafOwner: toPublicKey(fromAddress),
        newLeafOwner: toPublicKey(toAddress),
        // @ts-ignore - Type definition mismatch for transfer argument
        leafIndex,
      });

      const result = await transferIx.sendAndConfirm(this.umi);

      console.log(`✅ Transferred invoice NFT from ${fromAddress} to ${toAddress}`);

      return {
        signature: result.signature.toString(),
      };
    } catch (error) {
      console.error(`❌ Failed to transfer invoice NFT:`, error);
      throw error;
    }
  }

  /**
   * Burn invoice NFT (when invoice is paid/cancelled)
   */
  async burnInvoiceNFT(
    nftMint: string,
    merkleTree: string,
    leafIndex: number,
    ownerAddress: string
  ): Promise<{ signature: string }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      const burnIx = burnV1(this.umi, {
        merkleTree: toPublicKey(merkleTree),
        leafOwner: toPublicKey(ownerAddress),
        // @ts-ignore - Type definition mismatch for burn argument
        leafIndex,
      });

      const result = await burnIx.sendAndConfirm(this.umi);

      console.log(`✅ Burned invoice NFT`);

      return {
        signature: result.signature.toString(),
      };
    } catch (error) {
      console.error(`❌ Failed to burn invoice NFT:`, error);
      throw error;
    }
  }

  /**
   * Generate invoice NFT metadata
   */
  public generateInvoiceMetadata(invoice: SelectInvoice): InvoiceNFTMetadata {
    const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";

    return {
      name: `Invoice ${invoice.invoiceNumber}`,
      symbol: "INV",
      uri: `${apiUrl}/nft-metadata/invoice/${invoice.id}`,
      description: `B2B Invoice from ${invoice.invoicerWalletAddress} to ${invoice.invoiceeWalletAddress}`,
      image: `${apiUrl}/images/invoice-nft.png`,
      attributes: [
        {
          trait_type: "Invoice Number",
          value: invoice.invoiceNumber,
        },
        {
          trait_type: "Status",
          value: invoice.status,
        },
        {
          trait_type: "Currency",
          value: invoice.currency,
        },
        {
          trait_type: "Amount",
          value: invoice.isArciumEncrypted ? "Encrypted" : invoice.totalAmount,
          display_type: invoice.isArciumEncrypted ? undefined : "number",
        },
        {
          trait_type: "Due Date",
          value: new Date(invoice.dueDate).toISOString(),
          display_type: "date",
        },
        {
          trait_type: "Privacy",
          value: invoice.isPrivate ? "Private" : "Public",
        },
        {
          trait_type: "Encrypted",
          value: invoice.isArciumEncrypted ? "Yes" : "No",
        },
      ],
      properties: {
        category: "invoice",
        creators: [
          {
            address: invoice.invoicerWalletAddress,
            share: 100,
            verified: true,
          },
        ],
      },
    };
  }

  /**
   * Generate payment receipt NFT metadata
   */
  public generatePaymentReceiptMetadata(
    payment: SelectPayment,
    invoice: SelectInvoice
  ): InvoiceNFTMetadata {
    const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";

    return {
      name: `Payment Receipt #${payment.id.slice(0, 8)}`,
      symbol: "RCPT",
      uri: `${apiUrl}/nft-metadata/payment/${payment.id}`,
      description: `Payment receipt for Invoice ${invoice.invoiceNumber}`,
      image: `${apiUrl}/images/receipt-nft.png`,
      attributes: [
        {
          trait_type: "Invoice Number",
          value: invoice.invoiceNumber,
        },
        {
          trait_type: "Amount",
          value: payment.amount,
          display_type: "number",
        },
        {
          trait_type: "Currency",
          value: payment.currency,
        },
        {
          trait_type: "Paid By",
          value: payment.fromAddress,
        },
        {
          trait_type: "Paid To",
          value: payment.toAddress,
        },
        {
          trait_type: "Transaction",
          value: payment.txSignature,
        },
        {
          trait_type: "Payment Date",
          value: new Date(payment.createdAt).toISOString(),
          display_type: "date",
        },
        {
          trait_type: "Tax Year",
          value: new Date(payment.createdAt).getFullYear(),
          display_type: "number",
        },
      ],
      properties: {
        category: "payment_receipt",
        creators: [
          {
            address: payment.fromAddress,
            share: 100,
            verified: true,
          },
        ],
      },
    };
  }

  /**
   * Generate business identity NFT metadata
   */
  public generateBusinessIdentityMetadata(
    businessProfile: SelectBusinessProfile,
    verificationLevel: string
  ): InvoiceNFTMetadata {
    const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";

    return {
      name: `${businessProfile.businessName} - Verified Business`,
      symbol: "BIZ",
      uri: `${apiUrl}/nft-metadata/business/${businessProfile.id}`,
      description: `Verified business credentials for ${businessProfile.businessName}`,
      image: `${apiUrl}/images/business-${verificationLevel}-nft.png`,
      attributes: [
        {
          trait_type: "Business Name",
          value: businessProfile.businessName,
        },
        {
          trait_type: "Verification Level",
          value: verificationLevel,
        },
        {
          trait_type: "Industry",
          value: "Technology",
        },
        {
          trait_type: "Wallet",
          value: businessProfile.ownerWalletAddress,
        },
        {
          trait_type: "Registration Date",
          value: new Date(businessProfile.createdAt).toISOString(),
          display_type: "date",
        },
      ],
      properties: {
        category: "business_identity",
        creators: [
          {
            address: businessProfile.ownerWalletAddress,
            share: 100,
            verified: true,
          },
        ],
      },
    };
  }

  /**
   * Upload metadata to decentralized storage
   * Uses Arweave/Bundlr/IPFS for permanent storage with retry logic
   */
  private async uploadMetadata(
    metadata: InvoiceNFTMetadata,
    identifier: string
  ): Promise<string> {
    try {
      const storageService = getMetadataStorageService();
      const result = await storageService.uploadMetadata(metadata, identifier, {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      });

      return result.uri;
    } catch (error) {
      console.error("Failed to upload metadata to decentralized storage:", error);
      // Fallback to API endpoint
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      return `${apiUrl}/nft-metadata/${identifier}`;
    }
  }

  /**
   * Extract leaf index from transaction logs
   * Parses Bubblegum program logs to find the leaf index
   */
  private async extractLeafIndexFromTransaction(signature: string): Promise<number> {
    try {
      // Get connection from UMI
      const rpcEndpoint = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcEndpoint, "confirmed");

      // Fetch transaction with logs
      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta || !tx.meta.logMessages) {
        console.warn("Could not fetch transaction logs, using leaf index 0");
        return 0;
      }

      // Parse logs for leaf index
      // Bubblegum program emits: "Program log: leaf index: <number>"
      for (const log of tx.meta.logMessages) {
        if (log.includes("leaf index:")) {
          const match = log.match(/leaf index:\s*(\d+)/i);
          if (match && match[1]) {
            const leafIndex = parseInt(match[1], 10);
            console.log(`Extracted leaf index: ${leafIndex}`);
            return leafIndex;
          }
        }
        // Alternative format: "Instruction: MintV1" followed by data
        if (log.includes("MintV1") || log.includes("mint_v1")) {
          // Try to extract from subsequent logs
          continue;
        }
      }

      // Fallback: estimate based on transaction slot
      console.warn("Could not parse leaf index from logs, using fallback estimation");
      return 0; // Would need to track tree state for accurate estimation
    } catch (error) {
      console.error("Error extracting leaf index:", error);
      return 0; // Safe fallback
    }
  }

  /**
   * Batch mint invoice NFTs for multiple invoices
   * More efficient than minting one at a time
   */
  async batchMintInvoiceNFTs(
    invoices: SelectInvoice[],
    ownerAddresses: string[]
  ): Promise<Array<{
    invoiceId: string;
    success: boolean;
    result?: {
      mint: string;
      merkleTree: string;
      leafIndex: number;
      signature: string;
    };
    error?: string;
  }>> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    if (invoices.length !== ownerAddresses.length) {
      throw new Error("Invoices and owner addresses arrays must have same length");
    }

    console.log(`📦 Batch minting ${invoices.length} invoice NFTs...`);

    // Upload all metadata in parallel
    const storageService = getMetadataStorageService();
    const metadataList = invoices.map((invoice) => ({
      metadata: this.generateInvoiceMetadata(invoice),
      identifier: `invoice-${invoice.id}`,
    }));

    const metadataUris = await storageService.batchUploadMetadata(metadataList);

    // Mint NFTs sequentially (to avoid nonce conflicts)
    const results: Array<any> = [];

    for (let i = 0; i < invoices.length; i++) {
      try {
        const invoice = invoices[i];
        const ownerAddress = ownerAddresses[i];
        const metadataUri = metadataUris[i].uri;

        const leafOwner = toPublicKey(ownerAddress);
        const merkleTreePubkey = toPublicKey(this.merkleTree!);

        const mintIx = mintV1(this.umi, {
          leafOwner,
          merkleTree: merkleTreePubkey,
          metadata: {
            name: `Invoice ${invoice.invoiceNumber}`,
            symbol: "INV",
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            collection: none(),
            creators: [
              {
                address: toPublicKey(invoice.invoicerWalletAddress),
                verified: true,
                share: 100,
              },
            ],
          },
        });

        const result = await mintIx.sendAndConfirm(this.umi);
        const leafIndex = await this.extractLeafIndexFromTransaction(result.signature.toString());

        results.push({
          invoiceId: invoice.id,
          success: true,
          result: {
            mint: result.signature.toString(),
            merkleTree: this.merkleTree!,
            leafIndex,
            signature: result.signature.toString(),
          },
        });

        console.log(`✅ Minted NFT ${i + 1}/${invoices.length} for invoice ${invoice.invoiceNumber}`);
      } catch (error: any) {
        console.error(`❌ Failed to mint NFT for invoice ${invoices[i].invoiceNumber}:`, error);
        results.push({
          invoiceId: invoices[i].id,
          success: false,
          error: error.message,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    console.log(`✅ Batch minting complete: ${succeeded}/${invoices.length} succeeded`);

    return results;
  }

  /**
   * Get estimated cost for NFT operations
   */
  static getEstimatedCosts(): {
    treeCreation: number;
    compressedNFT: number;
    standardNFT: number;
    transfer: number;
    burn: number;
  } {
    return {
      treeCreation: 0.5, // ~$0.50 in SOL (one-time, supports 16K+ NFTs)
      compressedNFT: 0.001, // ~$0.001 per compressed NFT
      standardNFT: 0.02, // ~$0.02 per standard NFT
      transfer: 0.0005, // ~$0.0005 per transfer
      burn: 0.0001, // ~$0.0001 per burn
    };
  }
}

/**
 * Export singleton instance
 */
let nftServiceInstance: InvoiceNFTService | null = null;

export function getInvoiceNFTService(): InvoiceNFTService {
  if (!nftServiceInstance) {
    nftServiceInstance = new InvoiceNFTService();
  }
  return nftServiceInstance;
}

export async function initializeNFTService(
  payerKeypair?: Keypair
): Promise<boolean> {
  const service = getInvoiceNFTService();
  return await service.initialize(payerKeypair);
}
