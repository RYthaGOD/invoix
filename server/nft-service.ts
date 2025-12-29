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
  mintToCollectionV1, // For verified collection minting
  transfer as transferV1,
  burn as burnV1,
  updateMetadata,
  // Type imports
  // CreateTreeInstructionAccounts, // Removed
  MintV1InstructionAccounts,
  TransferInstructionAccounts,
  BurnInstructionAccounts,
  findLeafAssetIdPda,
} from "@metaplex-foundation/mpl-bubblegum";
import {
  createNft,
  TokenStandard,
  mplTokenMetadata,
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
  PublicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { fromWeb3JsPublicKey, fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { PublicKey, Keypair, Connection, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import { db } from "./db";
import type {
  SelectInvoice,
  SelectPayment,
  SelectBusinessProfile,
} from "@shared/invoice-schema";
import { serializeInvoiceForHashing } from "@shared/invoice-schema";
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
  external_url?: string;
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
  collectionMintAddress?: string; // Existing collection or create new
  maxDepth: number; // Tree depth (affects max NFTs)
  maxBufferSize: number; // Buffer size
  canopyDepth: number; // Canopy depth for cheaper transfers
}

/**
 * Truncate NFT name to 32 characters (Solana cNFT limit)
 * @param name - The full name
 * @returns Truncated name (max 32 chars)
 */
function truncateNFTName(name: string): string {
  if (name.length <= 32) return name;
  return name.slice(0, 29) + "...";
}

/**
 * Default NFT configuration
 */
const DEFAULT_CONFIG: NFTMintConfig = {
  autoMint: true,
  merkleTreeAddress: process.env.MERKLE_TREE_ADDRESS || undefined,
  maxDepth: 20, // Supports 1,048,576 NFTs (Production Ready)
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
  private collectionMint: string | null = null; // Collection NFT for marketplace visibility
  private initialized: boolean = false;
  // FIX R2-5: Mutex to prevent concurrent initialization race conditions
  private initPromise: Promise<boolean> | null = null;

  constructor(
    rpcEndpoint?: string,
    config: Partial<NFTMintConfig> = {}
  ) {
    const endpoint = rpcEndpoint || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.umi = createUmi(endpoint).use(mplTokenMetadata());
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the NFT service
   * Creates merkle tree if needed
   * FIX R2-5: Uses mutex to prevent concurrent initialization
   */
  async initialize(payerKeypair?: Keypair): Promise<boolean> {
    // Return existing result if already initialized
    if (this.initialized) return true;

    // Return existing promise if initialization is in progress
    if (this.initPromise) return this.initPromise;

    // Start initialization with mutex
    this.initPromise = this.doInitialize(payerKeypair);
    return this.initPromise;
  }

  private async doInitialize(payerKeypair?: Keypair): Promise<boolean> {
    try {
      // Set up UMI with payer if provided
      if (payerKeypair) {
        // Convert Solana Keypair to Umi format
        const umiKeypair = this.umi.eddsa.createKeypairFromSecretKey(
          payerKeypair.secretKey
        );
        this.umi.use(keypairIdentity(umiKeypair));
      }

      // Load database utilities
      const { systemSettings } = await import("@shared/invoice-schema");
      const { eq } = await import("drizzle-orm");

      // 1. Check .env first (override)
      if (this.config.merkleTreeAddress) {
        this.merkleTree = this.config.merkleTreeAddress;
      } else {
        // 2. Check Database for persisted tree
        const storedTree = await db.select().from(systemSettings).where(eq(systemSettings.key, "merkle_tree_address")).limit(1);

        let validPersistedTree = false;

        if (storedTree.length > 0) {
          const candidateTree = storedTree[0].value;
          // Validate if this tree actually exists on the current network
          try {
            const exists = await this.umi.rpc.accountExists(toPublicKey(candidateTree));
            if (exists) {
              this.merkleTree = candidateTree;
              validPersistedTree = true;
              console.log(`✅ Loaded Merkle Tree from DB: ${this.merkleTree}`);
            } else {
              console.warn(`⚠️  Persisted Merkle Tree (${candidateTree}) not found on current network. Invalidating...`);
              // Will fall through to creation
            }
          } catch (err) {
            console.warn("⚠️  Error checking Merkle tree existence, assuming invalid.", err);
          }
        }

        if (!validPersistedTree) {
          // 3. Create new tree if none exists or previous was invalid

          // SAFETY CHECK: Ensure we have funds before creating tree (Cost ~0.005 SOL)
          const walletAddr = this.umi.identity.publicKey.toString();
          const balance = await this.umi.rpc.getBalance(this.umi.identity.publicKey);

          console.log(`ℹ️  Server Wallet Address: ${walletAddr}`);

          // 0.01 SOL = 10,000,000 lamports
          if (balance.basisPoints < BigInt(10000000)) {
            console.warn(`⚠️  NFT Service Warning: Insufficient funds to create Merkle Tree.`);
            console.warn(`   Address: ${walletAddr}`);
            console.warn(`   Current Balance: ${Number(balance.basisPoints) / 1e9} SOL`);
            console.warn(`   Required: 0.01 SOL. Service will be disabled until funded.`);
            this.initialized = false;
            return false;
          }

          await this.createMerkleTree();

          // Persist to DB (Update if exists, Insert if new)
          if (storedTree.length > 0) {
            await db.update(systemSettings)
              .set({ value: this.merkleTree!, description: `Merkle Tree (${process.env.SOLANA_NETWORK || 'unknown'})` })
              .where(eq(systemSettings.key, "merkle_tree_address"));
          } else {
            await db.insert(systemSettings).values({
              key: "merkle_tree_address",
              value: this.merkleTree!,
              description: "Compressed NFT Merkle Tree Address",
            });
          }
          console.log(`💾 Persisted Merkle Tree to DB`);
        }
      }

      // Load or create Collection NFT for marketplace integration
      if (this.config.collectionMintAddress) {
        // Validate env-configured collection exists on-chain
        try {
          const exists = await this.umi.rpc.accountExists(toPublicKey(this.config.collectionMintAddress));
          if (exists) {
            this.collectionMint = this.config.collectionMintAddress;
            console.log(`✅ Using Collection NFT from env: ${this.collectionMint}`);
          } else {
            console.warn(`⚠️ Env-configured Collection NFT (${this.config.collectionMintAddress}) not found on current network.`);
            console.log(`🎨 Creating new INVOIX Genesis Collection NFT...`);
            await this.createCollectionNFT();
          }
        } catch (err) {
          console.warn("⚠️ Error checking Collection NFT existence:", err);
          console.log(`🎨 Creating new INVOIX Genesis Collection NFT...`);
          await this.createCollectionNFT();
        }
      } else {
        const storedCollection = await db.select().from(systemSettings).where(eq(systemSettings.key, "genesis_collection_mint")).limit(1);

        let validPersistedCollection = false;

        if (storedCollection.length > 0) {
          const candidateCollection = storedCollection[0].value;
          // Validate if this collection actually exists on the current network
          try {
            const exists = await this.umi.rpc.accountExists(toPublicKey(candidateCollection));
            if (exists) {
              this.collectionMint = candidateCollection;
              validPersistedCollection = true;
              console.log(`✅ Loaded Collection NFT from DB: ${this.collectionMint}`);
            } else {
              console.warn(`⚠️ Persisted Collection NFT (${candidateCollection}) not found on current network. Invalidating...`);
              // Will fall through to creation
            }
          } catch (err) {
            console.warn("⚠️ Error checking Collection NFT existence, assuming invalid.", err);
          }
        }

        if (!validPersistedCollection) {
          // Create collection NFT on first run or if previous was invalid
          console.log(`🎨 Creating INVOIX Genesis Collection NFT...`);
          await this.createCollectionNFT();

          // Update DB if there was an old invalid entry
          if (storedCollection.length > 0 && this.collectionMint) {
            await db.update(systemSettings)
              .set({ value: this.collectionMint, description: `Genesis Collection NFT (${process.env.SOLANA_NETWORK || 'unknown'})` })
              .where(eq(systemSettings.key, "genesis_collection_mint"));
            console.log(`💾 Updated Collection NFT in DB`);
          }
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
    return !!this.umi && !!this.merkleTree;
  }

  /**
   * Helper: Execute a function with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        // Don't retry if it's a permanent error (like insufficient funds if we could detect it easily)
        // For now, retry on all errors since RPC failures are most common
        console.warn(`⚠️ Operation failed (attempt ${i + 1}/${maxRetries}):`, error.message || error);
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Get the current merkle tree address
   */
  public getMerkleTree(): string {
    if (!this.merkleTree) {
      throw new Error("Merkle tree not initialized");
    }
    return this.merkleTree;
  }

  /**
   * Get the collection mint address
   */
  public getCollectionMint(): string | null {
    return this.collectionMint;
  }

  /**
   * Create Collection NFT for marketplace visibility
   * All minted NFTs will reference this collection
   */
  private async createCollectionNFT(): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";

      // Collection metadata
      const collectionMetadata = {
        name: "INVOIX Genesis Collection",
        symbol: "INVX",
        uri: "",
        description: "Official INVOIX Genesis NFT Collection. Limited to 1000 unique pieces across 4 rarity tiers.",
        image: `${apiUrl}/uploads/invoix-exclusive.jpg`, // Use main NFT as collection image
        attributes: [
          { trait_type: "Collection", value: "Genesis" },
          { trait_type: "Total Supply", value: "1000" },
        ],
        properties: {
          category: "image",
          creators: [{ address: this.umi.identity.publicKey.toString(), share: 100, verified: true }]
        }
      };

      // Upload collection metadata
      const storageService = getMetadataStorageService();
      const metadataResult = await storageService.uploadMetadata(collectionMetadata, "invoix-genesis-collection", { isPrivate: false } as any);

      // Create Collection NFT
      const collectionSigner = generateSigner(this.umi);

      const createCollectionIx = createNft(this.umi, {
        mint: collectionSigner,
        name: "INVOIX Genesis Collection",
        symbol: "INVX",
        uri: metadataResult.uri,
        sellerFeeBasisPoints: percentAmount(5) as any, // 5% royalties on all trades
        isCollection: true,
        tokenStandard: TokenStandard.NonFungible,
        creators: [
          {
            address: this.umi.identity.publicKey,
            verified: true,
            share: 100,
          }
        ],
      } as any);

      await createCollectionIx.sendAndConfirm(this.umi);

      this.collectionMint = collectionSigner.publicKey.toString();
      console.log(`✅ Created Collection NFT: ${this.collectionMint}`);

      // Persist to DB
      const { systemSettings } = await import("@shared/invoice-schema");
      await db.insert(systemSettings).values({
        key: "genesis_collection_mint",
        value: this.collectionMint,
        description: "INVOIX Genesis Collection NFT Address",
      });
      console.log(`💾 Persisted Collection NFT to DB`);

    } catch (error) {
      console.error("❌ Failed to create Collection NFT:", error);
      // Don't fail initialization - collection is optional for basic functionality
      console.warn("⚠️ Continuing without collection. NFTs will still work but won't be grouped on marketplaces.");
    }
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
      // 1. Build transaction with Server as identity (Tree Authority)
      // The builder uses the current identity (Server) as the Tree Authority signer.
      // We set the fee payer to the User (Leaf Owner).

      // Since we can't sign for the user, logic is:
      // a. Build transaction with Server as Payer first (to get blockhash/structure)
      // b. OR better: Use setFeePayer with a dummy signer, then serialize.

      // Let's use the explicit builder approach which is more robust
      // Use mintToCollectionV1 for verified collection membership when available
      let builder;
      if (this.collectionMint) {
        builder = mintToCollectionV1(this.umi, {
          leafOwner,
          merkleTree: merkleTreePubkey,
          collectionMint: toPublicKey(this.collectionMint),
          metadata: {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            collection: none(), // Collection verified via collectionMint parameter
            creators: [
              {
                address: toPublicKey(invoice.invoicerWalletAddress),
                verified: false, // Creator not signing this tx
                share: 100,
              },
            ],
          },
        });
      } else {
        builder = mintV1(this.umi, {
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
                verified: false,
                share: 100,
              },
            ],
          },
        });
      }

      // Add Priority Fees (Crucial for Reliability)
      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })
      );
      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }) // 0.00005 SOL
      );

      builder = builder.prepend({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
        .prepend({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] });

      // We need to construct a transaction where:
      // - Payer = User
      // - Signer 1 = Server (Tree Authority)
      // - Signer 2 = User (Payer)

      // Create a dummy signer for the user just to set the Fee Payer
      const userSigner: Signer = {
        publicKey: toPublicKey(userPublicKey),
        signMessage: async (msg) => msg,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };

      const txWithPayer = builder.setFeePayer(userSigner);

      // Current Identity (Server) is already configured in Umi. 
      // buildAndSign will sign with the Server keypair because it is the Tree Authority
      // It will NOT sign with userSigner because it's a dummy.
      let tx = await txWithPayer.buildAndSign(this.umi);

      // Serialize the transaction
      // This includes the Server's signature, but lacks the User's signature (Payer).
      // The client will add the Payer signature.

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
  async mintPaymentReceiptNFT(params: {
    payment: SelectPayment;
    invoice: SelectInvoice;
    recipientAddress: string;
  }): Promise<{
    mint: string;
    signature: string;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Generate payment receipt metadata
      const metadata = this.generatePaymentReceiptMetadata(params.payment, params.invoice);

      // Upload metadata
      const metadataUri = await this.uploadMetadata(
        metadata,
        `payment-${params.payment.id}`
      );

      // Metaplex Bubblegum (Compressed NFT) Logic
      // Vastly cheaper (~0.000005 SOL vs 0.02 SOL)
      // Server pays for minting
      const leafOwner = toPublicKey(params.payment.fromAddress); // Payer owns the receipt
      const merkleTreePubkey = toPublicKey(this.merkleTree!);

      // Use mintToCollectionV1 for verified collection membership when collection is available
      let mintIx;
      if (this.collectionMint) {
        mintIx = mintToCollectionV1(this.umi, {
          leafOwner,
          merkleTree: merkleTreePubkey,
          collectionMint: toPublicKey(this.collectionMint),
          metadata: {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            collection: none(), // Collection verified via collectionMint parameter
            creators: [
              {
                address: toPublicKey(params.payment.fromAddress),
                verified: false, // Payer can't sign
                share: 100,
              },
            ],
          },
        });
      } else {
        mintIx = mintV1(this.umi, {
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
                address: toPublicKey(params.payment.fromAddress),
                verified: false,
                share: 100,
              },
            ],
          },
        });
      }

      // Add Priority Fees
      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })
      );
      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
      );

      const mintIxWithBudget = mintIx.prepend({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
        .prepend({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] });

      const result = await this.executeWithRetry(() => mintIxWithBudget.sendAndConfirm(this.umi));
      const signature = result.signature.toString();

      console.log(`✅ Minted cNFT Payment Receipt. Sig: ${signature}`);

      // Extract details for cNFT
      const leafIndex = await this.extractLeafIndexFromTransaction(signature);
      const assetId = await this.deriveAssetId(leafIndex);

      console.log(`   Asset ID: ${assetId}`);
      console.log(`   Leaf Index: ${leafIndex}`);

      // 6. Store in DB (PaymentReceiptNFTs table)
      const { paymentReceiptNFTs } = await import("@shared/invoice-schema");

      await db.insert(paymentReceiptNFTs).values({
        paymentId: params.payment.id,
        invoiceId: params.invoice.id,
        nftMint: assetId, // For cNFTs, this is the Asset ID
        nftMetadataUri: metadataUri,
        nftOwner: params.payment.fromAddress,
        nftMerkleTree: this.merkleTree!,
        nftLeafIndex: leafIndex,
        receiptNumber: `RCPT-${params.payment.id.slice(0, 8)}`,
        amount: params.payment.amount,
        currency: params.payment.currency,
        paymentDate: new Date(), // Now
        taxYear: new Date().getFullYear(),
        txSignature: params.payment.txSignature,
        nftMintSignature: signature
      });

      console.log(`✅ Persisted receipt NFT to DB`);

      return {
        mint: assetId,
        signature: signature,
      };
    } catch (error) {
      console.error(`❌ Failed to mint payment receipt NFT:`, error);
      throw error;
    }
  }

  /**
   * Mint Business Identity NFT (Server-side)
   * 
   * @param businessProfile - The business profile data
   * @param verificationLevel - The verification tier
   * @returns Mint address and signature
   */
  async mintBusinessIdentityNFT(
    businessProfile: SelectBusinessProfile,
    verificationLevel: string = "basic"
  ): Promise<{ mint: string; signature: string }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      const metadata = this.generateBusinessIdentityMetadata(businessProfile, verificationLevel);
      const metadataUri = await this.uploadMetadata(metadata, `business-${businessProfile.id}`);

      const mint = generateSigner(this.umi);
      const owner = toPublicKey(businessProfile.ownerWalletAddress);

      const createNftIx = createNft(this.umi, {
        mint,
        name: metadata.name,
        symbol: "BIZ",
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0) as any,
        tokenStandard: TokenStandard.NonFungible,
        authority: this.umi.identity,
        updateAuthority: this.umi.identity,
        isMutable: true,
        creators: [
          {
            address: this.umi.identity.publicKey,
            verified: true,
            share: 100,
          },
        ],
        tokenOwner: owner,
      } as any);

      // Add Priority Fees
      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })
      );
      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
      );

      const result = await this.executeWithRetry(() =>
        createNftIx.prepend({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
          .prepend({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] })
          .sendAndConfirm(this.umi)
      );
      const signature = result.signature.toString();

      console.log(`✅ Minted Business Identity NFT: ${mint.publicKey.toString()}`);

      return {
        mint: mint.publicKey.toString(),
        signature,
      };
    } catch (error) {
      console.error(`❌ Failed to mint business identity NFT:`, error);
      throw error;
    }
  }

  /**
   * Create Business Identity Mint Transaction (User Pays)
   * 1. Transfers 0.008 SOL Fee to Treasury
   * 2. Mints the NFT (User pays gas + rent)
   */
  async createBusinessIdentityMintTransaction(
    businessProfile: SelectBusinessProfile,
    userPublicKey: string,
    treasuryAddress: string,
    verificationLevel: "basic" | "verified" | "premium" = "basic",
    customFeeLamports?: number
  ): Promise<{
    transaction: string; // Base64
    mint: string;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Check 1: Is user authenticated and involved?
      let isAuthorized = false; // Placeholder for future authorization logic

      // 1. Generate Metadata
      const metadata = this.generateBusinessIdentityMetadata(
        businessProfile,
        verificationLevel
      );

      // 2. Upload Metadata
      // Server performs upload (trivial cost)
      const metadataUri = await this.uploadMetadata(
        metadata,
        `business-${businessProfile.id}`
      );

      // 3. Prepare Keys
      const mintSigner = generateSigner(this.umi);
      const user = toPublicKey(userPublicKey);
      // const treasury = toPublicKey(treasuryAddress); // Not used directly in Umi transfer for now

      // 4. Create Transfer Instruction
      // Use custom fee if provided, otherwise default to 0.008 SOL
      const feeLamports = customFeeLamports !== undefined ? customFeeLamports : (0.008 * LAMPORTS_PER_SOL);

      // We use web3.js to create the instruction, then convert to Umi
      const transferIxWeb3 = SystemProgram.transfer({
        fromPubkey: new PublicKey(userPublicKey),
        toPubkey: new PublicKey(treasuryAddress),
        lamports: feeLamports,
      });

      const transferIx = fromWeb3JsInstruction(transferIxWeb3);

      // 5. Build NFT Mint Transaction
      // Server is the Creator/Authority (Identity), User is the Payer/Owner.
      const createNftBuilder = createNft(this.umi, {
        mint: mintSigner,
        name: metadata.name,
        symbol: "BIZ",
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0) as any,
        tokenStandard: TokenStandard.NonFungible,
        authority: this.umi.identity, // Server authorized
        updateAuthority: this.umi.identity, // Server keeps control
        isMutable: true,
        creators: [
          {
            address: this.umi.identity.publicKey,
            verified: true, // Server signs
            share: 100,
          },
        ],
      } as any);

      // 6. Combine Instructions: Transfer First, Then Mint
      // We start a new builder, add transfer, then add the mint builder

      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })
      );

      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
      );

      let builder = transactionBuilder()
        .add({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] })
        .add({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
        .add({ instruction: transferIx, bytesCreatedOnChain: 0, signers: [] })
        .add(createNftBuilder);

      // 7. Set User as Fee Payer
      // Create dummy signer for user (we don't have their private key)
      const userSigner: Signer = {
        publicKey: user,
        signMessage: async (msg) => msg,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };

      builder = builder.setFeePayer(userSigner);

      // 8. Build and Partial Sign (Server signs as Authority/Creator + Mint Keypair signs)
      // The builder will automatically sign with `this.umi.identity` and `mintSigner`
      // It will NOT sign with `userSigner` (Payer)
      const tx = await builder.buildAndSign(this.umi);

      // 9. Serialize to Base64
      const serializedTransaction = this.umi.transactions.serialize(tx);
      const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

      console.log(`✅ Created Business Identity Mint Tx for ${businessProfile.businessName}`);
      console.log(`   Mint Address: ${mintSigner.publicKey.toString()}`);

      return {
        transaction: base64Transaction,
        mint: mintSigner.publicKey.toString(),
      };

    } catch (error) {
      console.error(`❌ Failed to create business identity transaction:`, error);
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

    // Dynamic SVG Image - 8K Premium 3D Upgrade
    const imageUri = `${apiUrl}/api/images/dynamic-nft/invoice-3d/invoice-${invoice.id}.svg`;

    // PRIVACY V2 LOGIC
    if (invoice.isPrivate) {
      // 1. Calculate Integrity Hash
      const preImage = serializeInvoiceForHashing(invoice);
      const dataHash = crypto.createHash("sha256").update(preImage).digest("hex");

      return {
        name: truncateNFTName(`INV ${invoice.invoiceNumber}`), // Truncated for Solana limit
        symbol: "INV-P",
        uri: `${apiUrl}/nft-metadata/invoice/${invoice.id}`,
        external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/invoices/${invoice.id}`,
        description: `8K Ultra-HD Private Invoice. Data integrity is verified on-chain via SHA256 hash. Verify ownership to decrypt contents. Architecture: Midnight Prism 3D.`,
        image: imageUri, // Returns the "3D Lock" SVG
        attributes: [
          {
            trait_type: "Invoice Number",
            value: invoice.invoiceNumber,
          },
          {
            trait_type: "Visuals",
            value: "8K Ultra-HD",
          },
          {
            trait_type: "Style",
            value: "Midnight Prism 3D",
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
            trait_type: "Privacy",
            value: "Private",
          },
          {
            trait_type: "Data Hash",
            value: dataHash, // The Anchor of Trust
          },
          {
            trait_type: "Amount",
            value: "Confidential", // Hidden
          },
          {
            trait_type: "Due Date",
            value: "Confidential", // Hidden
          }
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

    // PUBLIC LOGIC (Standard)
    return {
      name: truncateNFTName(`INV ${invoice.invoiceNumber}`), // Truncated for Solana limit
      symbol: "INV",
      uri: `${apiUrl}/nft-metadata/invoice/${invoice.id}`,
      external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/invoices/${invoice.id}`,
      description: `B2B Invoice from ${invoice.invoicerWalletAddress} to ${invoice.invoiceeWalletAddress}. Rendered in 8K Ultra-HD with Midnight Prism 3D styling.`,
      image: imageUri,
      attributes: [
        {
          trait_type: "Invoice Number",
          value: invoice.invoiceNumber,
        },
        {
          trait_type: "Visuals",
          value: "8K Ultra-HD",
        },
        {
          trait_type: "Style",
          value: "Midnight Prism 3D",
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
          value: "Public",
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
      name: truncateNFTName(`RCPT ${payment.id.slice(0, 8)}`), // Truncated for Solana limit
      symbol: "RCPT",
      uri: `${apiUrl}/nft-metadata/payment/${payment.id}`,
      external_url: `${process.env.APP_URL || "https://solanainvoice.com"}/invoices/${invoice.id}`,
      description: `8K Premium 3D Payment Receipt for Invoice ${invoice.invoiceNumber}.`,
      image: `${apiUrl}/api/images/dynamic-nft/invoice-3d/receipt-${payment.id}.svg`, // Use same engine with receipt flag
      attributes: [
        {
          trait_type: "Invoice Number",
          value: invoice.invoiceNumber,
        },
        {
          trait_type: "Visuals",
          value: "8K Ultra-HD",
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
            verified: false, // Server mints on behalf of payer, so they can't sign
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
      description: `Verified business credentials for ${businessProfile.businessName}. 8K Ultra-HD Identity Token.`,
      // Use User Logo if available, else configured default
      image: businessProfile.logoUrl
        ? (businessProfile.logoUrl.startsWith('http') ? businessProfile.logoUrl : `${apiUrl}${businessProfile.logoUrl}`)
        : `${apiUrl}/images/business-${verificationLevel}-nft.png`,
      attributes: [
        {
          trait_type: "Business Name",
          value: businessProfile.businessName,
        },
        {
          trait_type: "Visuals",
          value: "8K Ultra-HD",
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
        isPrivate: false
      } as any);
      return result.uri;

    } catch (error) {
      console.error("Failed to upload metadata:", error);
      // Fallback to a valid dummy or handle error
      throw error;
    }
  }

  /**
   * Mint Special NFT (Community Campaign)
   */
  /**
   * Mint Special NFT (Community Campaign) - Standard NFT
   * Uses rarity-weighted random selection from collection
   */
  async mintSpecialNFT(
    recipientAddress: string,
    invoiceId: string,
    mintedCounts?: Record<string, number>
  ): Promise<{ mint: string; signature: string; nftVariant: any }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Import collection config
      const { selectRandomNFT, NFT_COLLECTION } = await import("@shared/nft-collection");

      // Select random NFT based on rarity weights
      const counts = mintedCounts || { common: 0, uncommon: 0, rare: 0, epic: 0 };
      const selectedNFT = selectRandomNFT(counts);

      if (!selectedNFT) {
        throw new Error("All NFTs sold out! Collection complete.");
      }

      console.log(`[NFT] Minting ${selectedNFT.name} (${selectedNFT.rarity}) for ${recipientAddress}...`);

      // 1. Generate Metadata - 8K 3D Holographic Card Upgrade
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      const imageUri = `${apiUrl}/api/images/dynamic-nft/community-3d/${selectedNFT.id}.svg`;

      const metadata: InvoiceNFTMetadata = {
        name: selectedNFT.name,
        symbol: "INVX",
        uri: "", // Will be set after upload
        description: `INVOIX Genesis Collection - ${selectedNFT.rarity.toUpperCase()} Edition. 8K Holographic Trading Card.`,
        image: imageUri,
        attributes: [
          { trait_type: "Visuals", value: "8K Holographic 3D" },
          { trait_type: "Name", value: selectedNFT.name },
          { trait_type: "Type", value: selectedNFT.type },
          { trait_type: "Attack", value: selectedNFT.attack },
          { trait_type: "HP", value: selectedNFT.hp },
          { trait_type: "Rarity", value: selectedNFT.rarity.charAt(0).toUpperCase() + selectedNFT.rarity.slice(1) },
          { trait_type: "Edition", value: "Genesis" },
          { trait_type: "Source Invoice", value: invoiceId }
        ],
        properties: {
          category: "image",
          creators: [{ address: this.umi.identity.publicKey.toString(), share: 100, verified: true }]
        }
      };

      const metadataUri = await this.uploadMetadata(metadata, `${selectedNFT.id}-${recipientAddress}-${Date.now()}`);

      // 2. Mint Compressed NFT (cNFT) to save costs and act as Invoice Receipt
      // Server pays ~0.001 SOL
      if (!this.merkleTree) {
        throw new Error("Merkle Tree not initialized");
      }

      console.log(`[NFT] Minting Compressed Special NFT to tree: ${this.merkleTree}`);

      const merkleTreePubkey = toPublicKey(this.merkleTree);
      const leafOwner = toPublicKey(recipientAddress);

      // Use mintToCollectionV1 for verified collection membership
      // Server is collection authority, so we can verify during mint
      if (this.collectionMint) {
        const mintIx = mintToCollectionV1(this.umi, {
          leafOwner,
          merkleTree: merkleTreePubkey,
          collectionMint: toPublicKey(this.collectionMint),
          metadata: {
            name: truncateNFTName(metadata.name),
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 500, // 5% royalties
            collection: none(), // Collection is verified via collectionMint parameter
            creators: [
              {
                address: this.umi.identity.publicKey,
                verified: true,
                share: 100,
              }
            ],
          },
        });

        const result = await this.executeWithRetry(() => mintIx.sendAndConfirm(this.umi));
        const signature = result.signature.toString();

        // Extract Asset ID
        const leafIndex = await this.extractLeafIndexFromTransaction(signature);
        const assetId = await this.deriveAssetId(leafIndex);

        console.log(`✅ Minted cNFT ${selectedNFT.name}. Asset ID: ${assetId} Sig: ${signature}`);

        return {
          mint: assetId.toString(),
          signature: signature,
          nftVariant: selectedNFT
        };
      } else {
        // Fallback: No collection configured, use standard mintV1
        const mintIx = mintV1(this.umi, {
          leafOwner,
          merkleTree: merkleTreePubkey,
          metadata: {
            name: truncateNFTName(metadata.name),
            symbol: metadata.symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 500,
            collection: none(),
            creators: [
              {
                address: this.umi.identity.publicKey,
                verified: true,
                share: 100,
              }
            ],
          },
        });

        const result = await this.executeWithRetry(() => mintIx.sendAndConfirm(this.umi));
        const signature = result.signature.toString();

        const leafIndex = await this.extractLeafIndexFromTransaction(signature);
        const assetId = await this.deriveAssetId(leafIndex);

        console.log(`✅ Minted cNFT ${selectedNFT.name} (no collection). Asset ID: ${assetId} Sig: ${signature}`);

        return {
          mint: assetId.toString(),
          signature: signature,
          nftVariant: selectedNFT
        };
      }

    } catch (error) {
      console.error("Failed to mint special NFT:", error);
      throw error;
    }
  }

  /**
   * Mint a SPECIFIC NFT variant (for admin reservations/airdrops)
   * Unlike mintSpecialNFT, this takes a specific NFT variant instead of random selection
   */
  async mintSpecificNFT(
    recipientAddress: string,
    nftVariant: { id: string; name: string; type: string; attack: string; image: string; rarity: string; hp: number }
  ): Promise<{ mint: string; signature: string }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      console.log(`[NFT] Minting specific ${nftVariant.name} (${nftVariant.rarity}) for ${recipientAddress}...`);

      // 1. Generate Metadata - 8K 3D Holographic Card Upgrade
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      const imageUri = `${apiUrl}/api/images/dynamic-nft/community-3d/${nftVariant.id}.svg`;

      const metadata: InvoiceNFTMetadata = {
        name: nftVariant.name,
        symbol: "INVX",
        uri: "",
        description: `INVOIX Genesis Collection - ${nftVariant.rarity.toUpperCase()} Edition. 8K Holographic Trading Card.`,
        image: imageUri,
        attributes: [
          { trait_type: "Visuals", value: "8K Holographic 3D" },
          { trait_type: "Name", value: nftVariant.name },
          { trait_type: "Type", value: nftVariant.type },
          { trait_type: "Attack", value: nftVariant.attack },
          { trait_type: "HP", value: nftVariant.hp },
          { trait_type: "Rarity", value: nftVariant.rarity.charAt(0).toUpperCase() + nftVariant.rarity.slice(1) },
          { trait_type: "Edition", value: "Genesis" },
          { trait_type: "Reserved", value: "Admin Mint" }
        ],
        properties: {
          category: "image",
          creators: [{ address: this.umi.identity.publicKey.toString(), share: 100, verified: true }]
        }
      };

      const metadataUri = await this.uploadMetadata(metadata, `${nftVariant.id}-admin-${recipientAddress}-${Date.now()}`);

      // 2. Mint Standard NFT with Collection and Royalties
      const mint = generateSigner(this.umi);

      const nftConfig: any = {
        mint,
        name: truncateNFTName(metadata.name), // Truncate for 32-char limit
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5) as any, // 5% royalties
        tokenStandard: TokenStandard.NonFungible,
        isMutable: false,
        creators: [
          {
            address: this.umi.identity.publicKey,
            verified: true,
            share: 100,
          }
        ],
        tokenOwner: toPublicKey(recipientAddress),
      };

      // Add collection reference if available
      if (this.collectionMint) {
        nftConfig.collection = some({
          key: toPublicKey(this.collectionMint),
          verified: false,
        });
      }

      const createNftIx = createNft(this.umi, nftConfig);

      // Add Priority Fees
      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })
      );
      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
      );

      const createNftIxWithFees = createNftIx
        .prepend({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
        .prepend({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] });

      const result: any = await this.executeWithRetry(() => createNftIxWithFees.sendAndConfirm(this.umi));
      const signature = result.signature.toString();

      console.log(`✅ Minted ${nftVariant.name} (${nftVariant.rarity}). Mint: ${mint.publicKey.toString()} Sig: ${signature}`);

      return {
        mint: mint.publicKey.toString(),
        signature: signature
      };

    } catch (error) {
      console.error("Failed to mint specific NFT:", error);
      throw error;
    }
  }



  /**
   * Create Claim Transaction (User Pays Gas)
   * Called AFTER Invoice is paid.
   * 1. Check Invoice Paid (handled by caller/route)
   * 2. Mints Standard NFT (User pays gas + rent ~0.02 SOL)
   */
  async createClaimTransaction(
    userPublicKey: string,
    mintedCounts?: Record<string, number>
  ): Promise<{
    transaction: string; // Base64
    mint: string;
    nftVariant: any;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
      // Import collection config
      const { selectRandomNFT } = await import("@shared/nft-collection");

      // Select random NFT based on rarity weights
      const counts = mintedCounts || { common: 0, uncommon: 0, rare: 0, epic: 0 };
      const selectedNFT = selectRandomNFT(counts);

      if (!selectedNFT) {
        throw new Error("All NFTs sold out! Collection complete.");
      }

      console.log(`[NFT] Preparing Claim Transaction for ${selectedNFT.name} (${selectedNFT.rarity}) to ${userPublicKey}...`);

      // 1. Generate Metadata - 8K 3D Holographic Card Upgrade
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      const imageUri = `${apiUrl}/api/images/dynamic-nft/community-3d/${selectedNFT.id}.svg`;

      const metadata: InvoiceNFTMetadata = {
        name: selectedNFT.name,
        symbol: "INVX",
        uri: "",
        description: `INVOIX Genesis Collection - ${selectedNFT.rarity.toUpperCase()} Edition. 8K Holographic Trading Card.`,
        image: imageUri,
        attributes: [
          { trait_type: "Visuals", value: "8K Holographic 3D" },
          { trait_type: "Name", value: selectedNFT.name },
          { trait_type: "Type", value: selectedNFT.type },
          { trait_type: "Attack", value: selectedNFT.attack },
          { trait_type: "HP", value: selectedNFT.hp },
          { trait_type: "Rarity", value: selectedNFT.rarity.charAt(0).toUpperCase() + selectedNFT.rarity.slice(1) },
          { trait_type: "Edition", value: "Genesis" },
          { trait_type: "Mint Type", value: "Claimed via Invoice" }
        ],
        properties: {
          category: "image",
          creators: [{ address: this.umi.identity.publicKey.toString(), share: 100, verified: true }]
        }
      };

      // 2. Upload Metadata
      // Server performs upload (trivial cost)
      const metadataUri = await this.uploadMetadata(
        metadata,
        `${selectedNFT.id}-${userPublicKey}-${Date.now()}`
      );

      // 3. Prepare Keys
      const mintSigner = generateSigner(this.umi);
      const user = toPublicKey(userPublicKey);

      // 4. Build NFT Mint Transaction
      // Server is the Creator/Authority (Identity), User is the Payer/Owner.
      const nftConfig: any = {
        mint: mintSigner,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5) as any, // 5% royalties
        tokenStandard: TokenStandard.NonFungible,
        authority: this.umi.identity, // Server authorized
        updateAuthority: this.umi.identity, // Server keeps control
        isMutable: false,
        creators: [
          {
            address: this.umi.identity.publicKey,
            verified: true, // Server signs
            share: 100,
          }
        ],
        tokenOwner: user,
      };

      // Add collection reference if collection exists
      if (this.collectionMint) {
        nftConfig.collection = some({
          key: toPublicKey(this.collectionMint),
          verified: true, // Server is Authority, so we can verify atomically
        });
      }

      const createNftBuilder = createNft(this.umi, nftConfig);

      // Add Priority Fees (Crucial for Reliability)
      const computeLimitIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 750_000 }) // Standard NFT minting is expensive
      );
      const priorityFeeIx = fromWeb3JsInstruction(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
      );

      const builderWithFees = createNftBuilder
        .prepend({ instruction: priorityFeeIx, bytesCreatedOnChain: 0, signers: [] })
        .prepend({ instruction: computeLimitIx, bytesCreatedOnChain: 0, signers: [] });

      // 5. Build and Partially Sign
      // Payer is User. Server signs as Authority/Creator/CollectionAuth. MintSigner signs as Mint.
      const transaction = await builderWithFees.buildAndSign({
        ...this.umi, // REQUIRED: Provide RPC and Transactions context
        payer: // 3. User (Payer) - We only have their public key and a placeholder sign function
          // The client will actually sign this transaction.
          // We cast as Signer to satisfy Umi's strict typing, knowing we won't execute this signer server-side.
          {
            publicKey: user,
            signTransaction: async (tx: any) => tx,
            signMessage: async (msg: any) => msg,
            signAllTransactions: async (txs: any) => txs
          } as unknown as Signer,
        // User placeholder
      });

      // Serialize
      const base64Transaction = Buffer.from(
        this.umi.transactions.serialize(transaction)
      ).toString("base64");

      return {
        transaction: base64Transaction,
        mint: mintSigner.publicKey.toString(),
        nftVariant: selectedNFT
      };

    } catch (error) {
      console.error("Failed to create claim transaction:", error);
      throw error;
    }
  }


  /**
   * Helper: Extract Leaf Index from Transaction (Public)
   * Uses multiple parsing strategies with fallback
   */
  public async extractLeafIndexFromTransaction(signature: string): Promise<number> {
    if (!this.umi) {
      throw new Error("Umi not initialized.");
    }
    try {
      // Wait for confirmation
      const latestBlockhash = await this.umi.rpc.getLatestBlockhash();
      const sigBytes = bs58.decode(signature);

      await this.umi.rpc.confirmTransaction(
        sigBytes, {
        strategy: {
          type: "blockhash",
          ...latestBlockhash
        }
      }
      );

      // Get connection from UMI
      const rpcEndpoint =
        process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcEndpoint, "confirmed");

      // Fetch transaction with logs (with retry)
      let tx = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        tx = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (tx && tx.meta && tx.meta.logMessages) break;
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!tx || !tx.meta || !tx.meta.logMessages) {
        console.warn("⚠️ Could not fetch transaction logs after 3 attempts, using leaf index 0");
        return 0;
      }

      const logs = tx.meta.logMessages;

      // Strategy 1: Look for "leaf index: <number>" pattern
      for (const log of logs) {
        const match = log.match(/leaf\s*index[:\s]+(\d+)/i);
        if (match && match[1]) {
          const leafIndex = parseInt(match[1], 10);
          console.log(`✅ Extracted leaf index (pattern 1): ${leafIndex}`);
          return leafIndex;
        }
      }

      // Strategy 2: Look for "nonce: <number>" pattern (alternative Bubblegum log)
      for (const log of logs) {
        const match = log.match(/nonce[:\s]+(\d+)/i);
        if (match && match[1]) {
          const leafIndex = parseInt(match[1], 10);
          console.log(`✅ Extracted leaf index from nonce: ${leafIndex}`);
          return leafIndex;
        }
      }

      // Strategy 3: Look for numeric values in Bubblegum MintV1 success logs
      for (const log of logs) {
        if (log.includes("MintV1") && log.includes("success")) {
          // Try to find any number that could be the leaf index
          const numMatch = log.match(/\b(\d{1,10})\b/);
          if (numMatch && numMatch[1]) {
            const leafIndex = parseInt(numMatch[1], 10);
            console.log(`✅ Extracted leaf index from MintV1 log: ${leafIndex}`);
            return leafIndex;
          }
        }
      }

      // Fallback: Return 0 instead of throwing (the NFT was still minted)
      console.warn("⚠️ Could not parse leaf index from logs. Using 0 as fallback.");
      console.log("Raw logs:", logs.slice(0, 10).join("\n"));
      return 0;

    } catch (error) {
      console.error("❌ Error extracting leaf index:", error);
      // Return 0 as fallback instead of throwing - the NFT was likely minted
      console.warn("⚠️ Returning leaf index 0 as fallback");
      return 0;
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

        // Use mintToCollectionV1 for verified collection membership
        let mintIx;
        if (this.collectionMint) {
          mintIx = mintToCollectionV1(this.umi, {
            leafOwner,
            merkleTree: merkleTreePubkey,
            collectionMint: toPublicKey(this.collectionMint),
            metadata: {
              name: truncateNFTName(`INV ${invoice.invoiceNumber}`),
              symbol: "INV",
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              collection: none(), // Collection verified via collectionMint parameter
              creators: [
                {
                  address: toPublicKey(invoice.invoicerWalletAddress),
                  verified: false,
                  share: 100,
                },
              ],
            },
          });
        } else {
          mintIx = mintV1(this.umi, {
            leafOwner,
            merkleTree: merkleTreePubkey,
            metadata: {
              name: truncateNFTName(`INV ${invoice.invoiceNumber}`),
              symbol: "INV",
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              collection: none(),
              creators: [
                {
                  address: toPublicKey(invoice.invoicerWalletAddress),
                  verified: false,
                  share: 100,
                },
              ],
            },
          });
        }

        const result = await this.executeWithRetry(() => mintIx.sendAndConfirm(this.umi));
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






  /**
   * Derive Asset ID from Leaf Index
   */
  public async deriveAssetId(leafIndex: number): Promise<string> {
    if (!this.merkleTree) {
      throw new Error("Merkle Tree not initialized");
    }
    const assetId = await findLeafAssetIdPda(this.umi, {
      merkleTree: toPublicKey(this.merkleTree), // Fixed: use runtime merkleTree, not config
      leafIndex: leafIndex,
    });
    return assetId.toString();
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
