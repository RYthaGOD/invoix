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
  findLeafAssetIdPda,
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
  private collectionMint: string | null = null; // Collection NFT for marketplace visibility
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

        if (storedTree.length > 0) {
          this.merkleTree = storedTree[0].value;
          console.log(`✅ Loaded Merkle Tree from DB: ${this.merkleTree}`);
        } else {
          // 3. Create new tree if none exists

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

          // Persist to DB
          await db.insert(systemSettings).values({
            key: "merkle_tree_address",
            value: this.merkleTree!,
            description: "Compressed NFT Merkle Tree Address",
          });
          console.log(`💾 Persisted Merkle Tree to DB`);
        }
      }

      // Load or create Collection NFT for marketplace integration
      const storedCollection = await db.select().from(systemSettings).where(eq(systemSettings.key, "genesis_collection_mint")).limit(1);

      if (storedCollection.length > 0) {
        this.collectionMint = storedCollection[0].value;
        console.log(`✅ Loaded Collection NFT from DB: ${this.collectionMint}`);
      } else {
        // Create collection NFT on first run
        console.log(`🎨 Creating INVOIX Genesis Collection NFT...`);
        await this.createCollectionNFT();
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
        sellerFeeBasisPoints: percentAmount(5), // 5% royalties on all trades
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

      const mintIx = mintV1(this.umi, {
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
              // We list the Payer as creator but they cannot sign (server is minting)
              // So verified MUST be false
              address: toPublicKey(params.payment.fromAddress),
              verified: false,
              share: 100, // They own 100% of "creation" credit
            },
          ],
        },
      });

      const result = await mintIx.sendAndConfirm(this.umi);
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
   * Mint Business Identity NFT
   * Creates verified business credential NFT
   */
  /**
   * Create Business Identity Mint Transaction (User Pays)
   * 1. Transfers 0.008 SOL Fee to Treasury
   * 2. Mints the NFT (User pays gas + rent)
   */
  async createBusinessIdentityMintTransaction(
    businessProfile: SelectBusinessProfile,
    userPublicKey: string,
    treasuryAddress: string,
    verificationLevel: "basic" | "verified" | "premium" = "basic"
  ): Promise<{
    transaction: string; // Base64
    mint: string;
  }> {
    if (!this.isReady()) {
      throw new Error("NFT service not initialized");
    }

    try {
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
      const treasury = toPublicKey(treasuryAddress);

      // 4. Create Transfer Instruction (0.008 SOL Fee)
      // We use web3.js to create the instruction, then convert to Umi
      const transferIxWeb3 = SystemProgram.transfer({
        fromPubkey: new PublicKey(userPublicKey),
        toPubkey: new PublicKey(treasuryAddress),
        lamports: 0.008 * LAMPORTS_PER_SOL,
      });

      const transferIx = fromWeb3JsInstruction(transferIxWeb3);

      // 5. Build NFT Mint Transaction
      // Server is the Creator/Authority (Identity), User is the Payer/Owner.
      const createNftBuilder = createNft(this.umi, {
        mint: mintSigner,
        name: metadata.name,
        symbol: "BIZ",
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
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

    // Dynamic SVG Image
    const imageUri = `${apiUrl}/api/images/dynamic-nft/invoice/${invoice.id}.svg`;

    // PRIVACY V2 LOGIC
    if (invoice.isPrivate) {
      // 1. Calculate Integrity Hash
      const preImage = serializeInvoiceForHashing(invoice);
      const dataHash = crypto.createHash("sha256").update(preImage).digest("hex");

      return {
        name: `Invoice #${invoice.invoiceNumber} (Private)`, // Obfuscated Name
        symbol: "INV-P",
        uri: `${apiUrl}/nft-metadata/invoice/${invoice.id}`,
        description: `This invoice is private. Data integrity is verified on-chain via SHA256 hash. Verify ownership to decrypt contents.`,
        image: imageUri, // Returns the "Lock" SVG
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
      name: `Invoice ${invoice.invoiceNumber}`,
      symbol: "INV",
      uri: `${apiUrl}/nft-metadata/invoice/${invoice.id}`,
      description: `B2B Invoice from ${invoice.invoicerWalletAddress} to ${invoice.invoiceeWalletAddress}`,
      image: imageUri,
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

      // 1. Generate Metadata
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      const imageUri = `${apiUrl}/uploads/${selectedNFT.image}`;

      const metadata: InvoiceNFTMetadata = {
        name: selectedNFT.name,
        symbol: "INVX",
        uri: "", // Will be set after upload
        description: `INVOIX Genesis Collection - ${selectedNFT.rarity.toUpperCase()} Edition. Limited to 1000 total.`,
        image: imageUri,
        attributes: [
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

      // 2. Mint Standard NFT with Collection and Royalties
      const mint = generateSigner(this.umi);

      // Build NFT creation with collection if available
      const nftConfig: any = {
        mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5), // 5% royalties on secondary sales
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

      // Add collection reference if collection exists
      if (this.collectionMint) {
        nftConfig.collection = some({
          key: toPublicKey(this.collectionMint),
          verified: false, // Will be verified by collection authority later
        });
        console.log(`[NFT] Adding to collection: ${this.collectionMint}`);
      }

      const createNftIx = createNft(this.umi, nftConfig);

      const result = await createNftIx.sendAndConfirm(this.umi);
      const signature = result.signature.toString();

      console.log(`✅ Minted ${selectedNFT.name} (${selectedNFT.rarity}). Mint: ${mint.publicKey.toString()} Sig: ${signature}`);

      return {
        mint: mint.publicKey.toString(),
        signature: signature,
        nftVariant: selectedNFT
      };

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

      // 1. Generate Metadata
      const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
      const imageUri = `${apiUrl}/uploads/${nftVariant.image}`;

      const metadata: InvoiceNFTMetadata = {
        name: nftVariant.name,
        symbol: "INVX",
        uri: "",
        description: `INVOIX Genesis Collection - ${nftVariant.rarity.toUpperCase()} Edition. Limited to 1000 total.`,
        image: imageUri,
        attributes: [
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
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5), // 5% royalties
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
      const result = await createNftIx.sendAndConfirm(this.umi);
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
   * Helper: Extract Leaf Index from Transaction (Public)
   */
  public async extractLeafIndexFromTransaction(signature: string): Promise<number> {
    if (!this.umi) {
      throw new Error("Umi not initialized.");
    }
    try {
      // Wait for confirmation
      const latestBlockhash = await this.umi.rpc.getLatestBlockhash();
      // bs58 is imported at the top level
      // const bs58 = require('bs58'); // Removed to prevent runtime crash in ESM
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
