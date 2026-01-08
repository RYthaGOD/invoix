import * as anchor from "@coral-xyz/anchor";
const { Program } = anchor;
import type { Program as ProgramType } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { logger } from "./logger";
import { dasService } from "./das-service";
import { getInvoiceNFTService } from "./nft-service";

/**
 * Marketplace Service
 * Handles interaction with the Non-Custodial Marketplace Smart Contract
 */

// Placeholder ID - User must update after deployment
const PROGRAM_ID = new PublicKey(process.env.MARKETPLACE_PROGRAM_ID || "InvxMkt111111111111111111111111111111111111");

// Minimal IDL for the Marketplace Program
const IDL: any = {
    "version": "0.1.0",
    "name": "marketplace_program",
    "metadata": {
        "address": PROGRAM_ID.toString()
    },
    "instructions": [
        {
            "name": "listInvoice",
            "accounts": [
                { "name": "seller", "isMut": true, "isSigner": true },
                { "name": "listingState", "isMut": true, "isSigner": false },
                { "name": "treeAuthority", "isMut": true, "isSigner": false },
                { "name": "merkleTree", "isMut": true, "isSigner": false },
                { "name": "currencyMint", "isMut": false, "isSigner": false },
                { "name": "logWrapper", "isMut": false, "isSigner": false },
                { "name": "compressionProgram", "isMut": false, "isSigner": false },
                { "name": "bubblegumProgram", "isMut": false, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "root", "type": { "array": ["u8", 32] } },
                { "name": "dataHash", "type": { "array": ["u8", 32] } },
                { "name": "creatorHash", "type": { "array": ["u8", 32] } },
                { "name": "nonce", "type": "u64" },
                { "name": "index", "type": "u32" },
                { "name": "price", "type": "u64" }
            ]
        },
        {
            "name": "buyInvoice",
            "accounts": [
                { "name": "buyer", "isMut": true, "isSigner": true },
                { "name": "listingState", "isMut": true, "isSigner": false },
                { "name": "seller", "isMut": true, "isSigner": false },
                { "name": "buyerTokenAccount", "isMut": true, "isSigner": false },
                { "name": "sellerTokenAccount", "isMut": true, "isSigner": false },
                { "name": "treasuryTokenAccount", "isMut": true, "isSigner": false },
                { "name": "currencyMint", "isMut": false, "isSigner": false },
                { "name": "treeAuthority", "isMut": true, "isSigner": false },
                { "name": "merkleTree", "isMut": true, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false },
                { "name": "logWrapper", "isMut": false, "isSigner": false },
                { "name": "compressionProgram", "isMut": false, "isSigner": false },
                { "name": "bubblegumProgram", "isMut": false, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "root", "type": { "array": ["u8", 32] } },
                { "name": "dataHash", "type": { "array": ["u8", 32] } },
                { "name": "creatorHash", "type": { "array": ["u8", 32] } },
                { "name": "nonce", "type": "u64" },
                { "name": "index", "type": "u32" }
            ]
        },
        {
            "name": "cancelListing",
            "accounts": [
                { "name": "seller", "isMut": true, "isSigner": true },
                { "name": "listingState", "isMut": true, "isSigner": false },
                { "name": "treeAuthority", "isMut": true, "isSigner": false },
                { "name": "merkleTree", "isMut": true, "isSigner": false },
                { "name": "logWrapper", "isMut": false, "isSigner": false },
                { "name": "compressionProgram", "isMut": false, "isSigner": false },
                { "name": "bubblegumProgram", "isMut": false, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "root", "type": { "array": ["u8", 32] } },
                { "name": "dataHash", "type": { "array": ["u8", 32] } },
                { "name": "creatorHash", "type": { "array": ["u8", 32] } },
                { "name": "nonce", "type": "u64" },
                { "name": "index", "type": "u32" }
            ]
        }
    ]
};

export class MarketplaceService {
    private connection: Connection;
    private provider: anchor.AnchorProvider;
    private program: any;

    constructor() {
        const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
        this.connection = new Connection(rpcUrl, "confirmed");

        // Server Wallet (Payer for rent/fees if needed, but usually client pays)
        // We use a dummy wallet for read-only provider initialization
        const wallet = new anchor.Wallet(Keypair.generate());
        this.provider = new anchor.AnchorProvider(this.connection, wallet, {
            commitment: "confirmed",
        });

        this.program = new Program(IDL, IDL.metadata.address, this.provider);
    }

    /**
     * Create List Invoice Transaction
     */
    async createListInvoiceTransaction(
        sellerPublicKey: string,
        invoiceId: string,
        assetId: string, // cNFT Asset ID
        price: number,
        currencyMint: string
    ): Promise<string> {
        try {
            // 1. Fetch Asset Proof from DAS
            const assetProof = await dasService.getAssetProof(assetId);
            const { root, proof, node_index, leaf, tree_id } = assetProof;

            // 2. Fetch Asset Data (for dataHash/creatorHash)
            const asset = await dasService.getAsset(assetId);
            if (!asset.compression) {
                throw new Error("Invalid asset: Not a compressed NFT");
            }

            const dataHash = Array.from(bs58.decode(asset.compression.data_hash));
            const creatorHash = Array.from(bs58.decode(asset.compression.creator_hash));
            // DAS returns root as Base58 string (usually)
            // If it fails, fallback to hex or verify structure.
            const rootBytes = Array.from(bs58.decode(root));

            // 3. Derive PDA
            // Seed: "listing", seller, assetId
            // TODO: Ensure Anchor program supports this seed structure. If strictly "listing" + seller, limit is 1.
            const seller = new PublicKey(sellerPublicKey);
            const assetMint = new PublicKey(assetId);

            const [listingState] = PublicKey.findProgramAddressSync(
                [Buffer.from("listing"), seller.toBuffer(), assetMint.toBuffer()],
                this.program.programId
            );

            const treeAuthority = await this.getTreeAuthority(new PublicKey(tree_id));

            // 4. Build Instruction
            const ix = await this.program.methods
                .listInvoice(
                    rootBytes,
                    dataHash,
                    creatorHash,
                    new anchor.BN(node_index), // nonce/leafIndex conflict? usually nonce=leafIndex for V1
                    node_index,
                    new anchor.BN(price)
                )
                .accounts({
                    seller: seller,
                    listingState: listingState,
                    treeAuthority: treeAuthority,
                    merkleTree: new PublicKey(tree_id),
                    currencyMint: new PublicKey(currencyMint),
                    logWrapper: new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"),
                    compressionProgram: new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"),
                    bubblegumProgram: new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(
                    proof.map(p => ({
                        pubkey: new PublicKey(p),
                        isSigner: false,
                        isWritable: false
                    }))
                )
                .instruction();

            // 5. Build Transaction
            const tx = new Transaction().add(ix);
            tx.feePayer = seller;
            const latestBlockhash = await this.connection.getLatestBlockhash();
            tx.recentBlockhash = latestBlockhash.blockhash;

            return tx.serialize({ requireAllSignatures: false }).toString("base64");

        } catch (error: any) {
            logger.error("Failed to create list tx", "marketplace", { error: error.message });
            throw error;
        }
    }

    /**
     * Create Buy Invoice Transaction
     */
    async createBuyInvoiceTransaction(
        buyerPublicKey: string,
        sellerPublicKey: string,
        assetId: string,
        currencyMint: string
    ): Promise<string> {
        try {
            const assetProof = await dasService.getAssetProof(assetId);
            const { root, proof, node_index, tree_id } = assetProof;

            const buyer = new PublicKey(buyerPublicKey);
            const seller = new PublicKey(sellerPublicKey);
            const assetMint = new PublicKey(assetId);

            const [listingState] = PublicKey.findProgramAddressSync(
                [Buffer.from("listing"), seller.toBuffer(), assetMint.toBuffer()],
                this.program.programId
            );

            // Token Accounts
            const buyerAta = await this.getAta(buyer, new PublicKey(currencyMint));
            const sellerAta = await this.getAta(seller, new PublicKey(currencyMint));
            const treasuryAta = await this.getAta(new PublicKey(process.env.TREASURY_WALLET!), new PublicKey(currencyMint));

            const treeAuthority = await this.getTreeAuthority(new PublicKey(tree_id));

            // Fetch Real Hashes
            const asset = await dasService.getAsset(assetId);
            if (!asset.compression) throw new Error("Invalid Asset");

            const dataHash = Array.from(bs58.decode(asset.compression.data_hash));
            const creatorHash = Array.from(bs58.decode(asset.compression.creator_hash));
            const rootBytes = Array.from(bs58.decode(root));

            const ix = await this.program.methods
                .buyInvoice(
                    rootBytes,
                    dataHash,
                    creatorHash,
                    new anchor.BN(node_index),
                    node_index
                )
                .accounts({
                    buyer: buyer,
                    listingState: listingState,
                    seller: seller,
                    buyerTokenAccount: buyerAta,
                    sellerTokenAccount: sellerAta,
                    treasuryTokenAccount: treasuryAta,
                    currencyMint: new PublicKey(currencyMint),
                    treeAuthority: treeAuthority,
                    merkleTree: new PublicKey(tree_id),
                    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                    logWrapper: new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"),
                    compressionProgram: new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"),
                    bubblegumProgram: new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(
                    proof.map(p => ({
                        pubkey: new PublicKey(p),
                        isSigner: false,
                        isWritable: false
                    }))
                )
                .instruction();

            const tx = new Transaction().add(ix);
            tx.feePayer = buyer;
            const latestBlockhash = await this.connection.getLatestBlockhash();
            tx.recentBlockhash = latestBlockhash.blockhash;

            return tx.serialize({ requireAllSignatures: false }).toString("base64");

        } catch (error: any) {
            logger.error("Failed to create buy tx", "marketplace", { error: error.message });
            throw error;
        }
    }

    /**
     * Create Cancel Listing Transaction
     * Retruns the NFT from PDA to Seller
     */
    async createCancelListingTransaction(
        sellerPublicKey: string,
        invoiceId: string,
        assetId: string
    ): Promise<string> {
        try {
            // 1. Fetch Asset Proof from DAS (needed to verify leaf ownership in program)
            const assetProof = await dasService.getAssetProof(assetId);
            const { root, proof, node_index, leaf, tree_id } = assetProof;

            // 2. Fetch Asset Data (for dataHash/creatorHash)
            const asset = await dasService.getAsset(assetId);
            if (!asset.compression) {
                throw new Error("Invalid asset: Not a compressed NFT");
            }

            const dataHash = Array.from(bs58.decode(asset.compression.data_hash));
            const creatorHash = Array.from(bs58.decode(asset.compression.creator_hash));
            const rootBytes = Array.from(bs58.decode(root));

            // 3. Derive PDA
            // Must match seeds used in listInvoice: "listing", seller, assetMint
            const seller = new PublicKey(sellerPublicKey);
            const assetMint = new PublicKey(assetId);

            const [listingState] = PublicKey.findProgramAddressSync(
                [Buffer.from("listing"), seller.toBuffer(), assetMint.toBuffer()],
                this.program.programId
            );

            // 4. Build Cancel Instruction
            // Arguments: root, dataHash, creatorHash, nonce, index
            const ix = await this.program.methods
                .cancelListing(
                    rootBytes,
                    dataHash,
                    creatorHash,
                    new anchor.BN(node_index), // nonce
                    node_index // index
                )
                .accounts({
                    seller: seller,
                    listingState: listingState,
                    merkleTree: new PublicKey(tree_id),
                    // Anchor handles systemProgram, logWrapper, bubblegumProgram if defined in IDL
                })
                .remainingAccounts(
                    proof.map(p => ({
                        pubkey: new PublicKey(p),
                        isWritable: false,
                        isSigner: false
                    }))
                )
                .instruction();

            // 5. Build Transaction
            const tx = new Transaction().add(ix);
            tx.feePayer = seller;

            // We need a blockhash. Since we are on server, we can fetch it.
            const latestBlockhash = await this.connection.getLatestBlockhash("confirmed");
            tx.recentBlockhash = latestBlockhash.blockhash;

            // Serialize for client signature
            return tx.serialize({ requireAllSignatures: false }).toString("base64");

        } catch (error: any) {
            logger.error("Failed to create cancel listing tx", "marketplace", { error: error.message });
            throw error;
        }
    }

    // Helper: Get Tree Authority PDA
    private async getTreeAuthority(merkleTree: PublicKey): Promise<PublicKey> {
        const [treeAuthority] = PublicKey.findProgramAddressSync(
            [merkleTree.toBuffer()],
            new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY")
        );
        return treeAuthority;
    }

    // Helper: Get ATA (simplified)
    private async getAta(owner: PublicKey, mint: PublicKey): Promise<PublicKey> {
        const { getAssociatedTokenAddress } = await import("@solana/spl-token");
        return getAssociatedTokenAddress(mint, owner);
    }
}

export const marketplaceService = new MarketplaceService();
