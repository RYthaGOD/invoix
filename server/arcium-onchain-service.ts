/**
 * Arcium On-Chain Service
 * 
 * Handles on-chain Arcium MXE invoice account operations.
 * Creates InvoiceAccount PDAs for marketplace integration.
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { logger } from "./logger";
import { createHash } from "crypto";

// Arcium MXE Program ID
const ARCIUM_PROGRAM_ID = new PublicKey(
    process.env.ARCIUM_PROGRAM_ID || "5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe"
);

// Minimal IDL for Arcium MXE create_invoice instruction
const ARCIUM_IDL: any = {
    version: "0.1.0",
    name: "arcium_mxe",
    metadata: { address: ARCIUM_PROGRAM_ID.toString() },
    instructions: [
        {
            name: "createInvoice",
            accounts: [
                { name: "invoice", isMut: true, isSigner: false },
                { name: "authority", isMut: true, isSigner: true },
                { name: "payer", isMut: false, isSigner: false },
                { name: "mint", isMut: false, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
            ],
            args: [
                { name: "invoiceId", type: "bytes" },
                { name: "amount", type: "u64" },
                { name: "dueDate", type: "i64" },
                { name: "contentHash", type: { array: ["u8", 32] } },
                { name: "assetId", type: { array: ["u8", 32] } },
            ],
        },
    ],
};

// Token mint addresses for common stablecoins
const TOKEN_MINTS: Record<string, string> = {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    PYUSD: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    EURC: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    SOL: "So11111111111111111111111111111111111111112",
};

export class ArciumOnChainService {
    private connection: Connection;
    private provider: anchor.AnchorProvider;
    private program: Program;
    private serverKeypair: Keypair | null = null;

    constructor() {
        const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
        this.connection = new Connection(rpcUrl, "confirmed");

        // Create a dummy wallet for reading (actual signing happens client-side)
        const dummyWallet = {
            publicKey: PublicKey.default,
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any[]) => txs,
        };

        this.provider = new anchor.AnchorProvider(this.connection, dummyWallet as any, {
            commitment: "confirmed",
        });

        this.program = new Program(ARCIUM_IDL, ARCIUM_IDL.metadata.address, this.provider);

        // Load server keypair for server-side signing if available
        this.loadServerKeypair();
    }

    private loadServerKeypair(): void {
        const privateKeyStr = process.env.ARCIUM_PRIVATE_KEY || process.env.SERVER_PRIVATE_KEY;
        if (privateKeyStr) {
            try {
                const privateKey = JSON.parse(privateKeyStr);
                this.serverKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
                logger.info("Arcium on-chain service: Server keypair loaded", "arcium-onchain");
            } catch (e) {
                logger.warn("Failed to load server keypair for Arcium", "arcium-onchain");
            }
        }
    }

    /**
     * Derive the InvoiceAccount PDA
     * Seeds: ["invoice", authority, invoice_id]
     */
    deriveInvoicePda(authority: PublicKey, invoiceId: string): [PublicKey, number] {
        const invoiceIdBytes = Buffer.from(invoiceId, "utf-8");
        return PublicKey.findProgramAddressSync(
            [Buffer.from("invoice"), authority.toBuffer(), invoiceIdBytes],
            ARCIUM_PROGRAM_ID
        );
    }

    /**
     * Create a hash of invoice content for on-chain storage
     */
    private createContentHash(invoice: any): number[] {
        const content = JSON.stringify({
            description: invoice.description || "",
            currency: invoice.currency,
            totalAmount: invoice.totalAmount,
        });
        const hash = createHash("sha256").update(content).digest();
        return Array.from(hash);
    }

    /**
     * Create a placeholder asset ID (will be updated when NFT is minted)
     */
    private createPlaceholderAssetId(): number[] {
        return new Array(32).fill(0);
    }

    /**
     * Build transaction to create an on-chain Arcium InvoiceAccount
     * 
     * @param invoice - Invoice data from database
     * @param authorityPublicKey - Invoice creator's wallet
     * @returns Transaction to sign and submit
     */
    async createInvoiceAccountTransaction(
        invoice: {
            id: string;
            totalAmount: string;
            dueDate: Date | string;
            currency: string;
            description?: string;
            invoiceeWalletAddress: string;
        },
        authorityPublicKey: string
    ): Promise<{ transaction: string; invoicePda: string }> {
        try {
            const authority = new PublicKey(authorityPublicKey);
            const [invoicePda] = this.deriveInvoicePda(authority, invoice.id);

            // Check if account already exists
            const existingAccount = await this.connection.getAccountInfo(invoicePda);
            if (existingAccount) {
                logger.info("Invoice PDA already exists", "arcium-onchain", { pda: invoicePda.toString() });
                return {
                    transaction: "", // No transaction needed
                    invoicePda: invoicePda.toString(),
                };
            }

            // Prepare arguments
            const invoiceIdBytes = Buffer.from(invoice.id, "utf-8");
            const amount = new anchor.BN(Math.round(parseFloat(invoice.totalAmount) * 1e6)); // Convert to micro units
            const dueDate = new anchor.BN(Math.floor(new Date(invoice.dueDate).getTime() / 1000));
            const contentHash = this.createContentHash(invoice);
            const assetId = this.createPlaceholderAssetId();

            // Get token mint
            const currency = invoice.currency?.toUpperCase() || "USDC";
            const mintAddress = TOKEN_MINTS[currency] || TOKEN_MINTS.USDC;

            // Customer wallet (payer in Arcium terms = who pays the invoice)
            const payer = new PublicKey(invoice.invoiceeWalletAddress);

            // Build instruction
            const ix = await this.program.methods
                .createInvoice(
                    invoiceIdBytes,
                    amount,
                    dueDate,
                    contentHash,
                    assetId
                )
                .accounts({
                    invoice: invoicePda,
                    authority: authority,
                    payer: payer,
                    mint: new PublicKey(mintAddress),
                    systemProgram: SystemProgram.programId,
                })
                .instruction();

            // Build transaction
            const tx = new Transaction().add(ix);
            tx.feePayer = authority;
            const latestBlockhash = await this.connection.getLatestBlockhash();
            tx.recentBlockhash = latestBlockhash.blockhash;

            return {
                transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
                invoicePda: invoicePda.toString(),
            };
        } catch (error: any) {
            logger.error("Failed to create invoice account transaction", "arcium-onchain", {
                error: error.message,
                invoiceId: invoice.id,
            });
            throw error;
        }
    }

    /**
     * Create invoice account using server keypair (for background operations)
     * Only works if server has authority to create invoices (which it doesn't in normal flow)
     */
    async createInvoiceAccountServerSide(
        invoice: {
            id: string;
            totalAmount: string;
            dueDate: Date | string;
            currency: string;
            description?: string;
            invoiceeWalletAddress: string;
        },
        authorityPublicKey: string
    ): Promise<string | null> {
        if (!this.serverKeypair) {
            logger.warn("Server keypair not available for Arcium", "arcium-onchain");
            return null;
        }

        try {
            const { transaction, invoicePda } = await this.createInvoiceAccountTransaction(
                invoice,
                authorityPublicKey
            );

            if (!transaction) {
                // Account already exists
                return invoicePda;
            }

            // This would only work if the server keypair matches the authority
            // In practice, the authority is the user's wallet, so this won't work
            // This is here for completeness but won't be used in normal flow
            logger.warn("Server-side creation requires authority signature", "arcium-onchain");
            return null;
        } catch (error: any) {
            logger.error("Server-side invoice creation failed", "arcium-onchain", {
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Check if an Arcium invoice account exists
     */
    async invoiceAccountExists(invoicePda: string): Promise<boolean> {
        try {
            const account = await this.connection.getAccountInfo(new PublicKey(invoicePda));
            return account !== null;
        } catch {
            return false;
        }
    }

    /**
     * Get derived PDA for an invoice without creating it
     */
    getInvoicePdaPreview(authority: string, invoiceId: string): string {
        const [pda] = this.deriveInvoicePda(new PublicKey(authority), invoiceId);
        return pda.toString();
    }
}

// Singleton instance
let arciumOnChainServiceInstance: ArciumOnChainService | null = null;

export function getArciumOnChainService(): ArciumOnChainService {
    if (!arciumOnChainServiceInstance) {
        arciumOnChainServiceInstance = new ArciumOnChainService();
    }
    return arciumOnChainServiceInstance;
}
