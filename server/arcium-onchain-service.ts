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
import { Buffer } from "buffer";
import { getTokenMint, getDecimalsForMint } from "@shared/config";


// Arcium MXE Program ID - validated on first use
function getArciumProgramId(): PublicKey {
    const programIdStr = process.env.ARCIUM_PROGRAM_ID;
    if (!programIdStr) {
        throw new Error(
            "ARCIUM_PROGRAM_ID environment variable is not set. " +
            "Please deploy your Arcium MXE program and set this variable, " +
            "or disable Arcium features by setting ENABLE_ARCIUM_ENCRYPTION=false."
        );
    }
    return new PublicKey(programIdStr);
}

// Lazy initialization
let ARCIUM_PROGRAM_ID: PublicKey | null = null;
function getProgramId(): PublicKey {
    if (!ARCIUM_PROGRAM_ID) {
        ARCIUM_PROGRAM_ID = getArciumProgramId();
    }
    return ARCIUM_PROGRAM_ID;
}

// Minimal IDL for Arcium MXE create_invoice instruction (dynamically generated)
function getArciumIDL(): any {
    const programId = getProgramId();
    return {
        version: "0.1.0",
        name: "arcium_mxe",
        address: programId.toString(),
        metadata: { address: programId.toString() },
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
}

// Token mint addresses handled via shared/config

export class ArciumOnChainService {
    private connection: Connection;
    private provider: anchor.AnchorProvider;
    private program: Program | null = null;
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

        // Initialize program lazily to avoid IDL parsing issues during static analysis/tests
        // this.program = new Program(ARCIUM_IDL, this.provider);

        // Load server keypair for server-side signing if available
        this.loadServerKeypair();
    }

    private getProgram(): Program {
        if (!this.program) {
            this.program = new Program(getArciumIDL(), this.provider);
        }
        return this.program;
    }

    private loadServerKeypair(): void {
        const privateKeyStr = process.env.ARCIUM_PRIVATE_KEY || process.env.SERVER_PRIVATE_KEY;
        if (privateKeyStr) {
            try {
                const privateKey = JSON.parse(privateKeyStr);
                this.serverKeypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
                logger.info("Arcium on-chain service: Server keypair loaded", "arcium-onchain");
            } catch {
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

        // Use the validated program ID (will throw if not configured)
        const programId = getProgramId();

        return PublicKey.findProgramAddressSync(
            [Buffer.from("invoice"), authority.toBuffer(), invoiceIdBytes],
            programId
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
            // Get token mint
            const currency = invoice.currency?.toUpperCase() || "USDC";
            const network = process.env.SOLANA_NETWORK || "devnet";
            const mintAddress = getTokenMint(currency, network);

            // Dynamic amount conversion
            const decimals = getDecimalsForMint(mintAddress);
            const amount = new anchor.BN(Math.round(parseFloat(invoice.totalAmount) * Math.pow(10, decimals)));

            const dueDate = new anchor.BN(Math.floor(new Date(invoice.dueDate).getTime() / 1000));
            const contentHash = this.createContentHash(invoice);
            const assetId = this.createPlaceholderAssetId();

            // Customer wallet (payer in Arcium terms = who pays the invoice)
            const payer = new PublicKey(invoice.invoiceeWalletAddress);

            // Build instruction
            const ix = await this.getProgram().methods
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
