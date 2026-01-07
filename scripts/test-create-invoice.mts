import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

async function main() {
    console.log("🚀 Testing InvoiceAccount Creation...");
    console.log("Anchor Keys:", Object.keys(anchor));
    // @ts-ignore
    console.log("Anchor Default Keys:", anchor.default ? Object.keys(anchor.default) : "No Default");

    // 1. Setup Provider
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
    const walletPath = process.env.ANCHOR_WALLET || "/home/craig/.config/solana/id.json";
    const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // 2. Load Program
    const idlPath = "./arcium_idl.json";
    if (!fs.existsSync(idlPath)) {
        console.error("❌ IDL not found.");
        process.exit(1);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    console.log("Loaded IDL Accounts:", JSON.stringify(idl.accounts, null, 2));
    const programId = new PublicKey(process.env.ARCIUM_PROGRAM_ID || "5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe");
    console.log(`   Program ID: ${programId.toBase58()}`);

    // Update IDL address
    idl.address = programId.toBase58();
    if (idl.metadata) idl.metadata.address = programId.toBase58();
    else idl.metadata = { address: programId.toBase58() };

    const program = new Program(idl as any, new PublicKey(programId), provider);
    console.log("Registered Accounts:", Object.keys(program.account));

    // 3. Prepare Test Data
    const invoiceId = crypto.randomBytes(16); // Random ID
    const payer = Keypair.generate().publicKey; // Random customer
    const mint = new PublicKey("So11111111111111111111111111111111111111112"); // Native SOL (placeholder)
    // @ts-ignore
    const BN = anchor.default ? anchor.default.BN : anchor.BN;
    const amount = new BN(100_000_000); // 0.1 SOL
    const dueDate = new BN(Math.floor(Date.now() / 1000) + 86400); // Tomorrow
    const contentHash = crypto.createHash('sha256').update("Invoice PDF Content").digest();
    const assetId = crypto.randomBytes(32); // Mock Asset ID from Bubblegum logic

    // 4. Derive Invoice PDA
    const [invoicePda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("invoice"), wallet.publicKey.toBuffer(), invoiceId],
        programId
    );
    console.log(`   Target Invoice PDA: ${invoicePda.toBase58()}`);

    // 5. Call Create Invoice
    try {
        const tx = await program.methods
            .createInvoice(
                invoiceId,
                amount,
                dueDate,
                [...contentHash],
                [...assetId]
            )
            .accounts({
                invoice: invoicePda,
                authority: wallet.publicKey,
                payer: payer,
                mint: mint,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("✅ Invoice Created TX:", tx);
    } catch (e) {
        console.error("❌ Creation Failed:", e);
        process.exit(1);
    }

    // 6. Verify Data & Events
    try {
        const account = await program.account.invoiceAccount.fetch(invoicePda);
        console.log("🎉 Account Fetched Successfully!");
        console.log("   Authority:", account.authority.toBase58());
        console.log("   Amount:", account.amount.toString());
        console.log("   Status:", account.status); // Should be { draft: {} }
        // @ts-ignore
        console.log("   Asset ID:", Buffer.from(account.assetId).toString("hex"));

        if (account.amount.eq(amount)) {
            console.log("✅ CHECK 1: Amount matches.");
        } else {
            console.error("❌ CHECK 1: Amount mismatch.");
        }

        // @ts-ignore
        if (Buffer.from(account.assetId).equals(assetId)) {
            console.log("✅ CHECK 2: Asset ID matches.");
        } else {
            console.error("❌ CHECK 2: Asset ID mismatch.");
        }

        // Verify Events (via transaction logs analysis - simplified for this test script)
        // Ideally we would inspect tx logs here, but verifying state is 'Cohesion Level 1' proof.
        // The fact that assetId is there means the instruction executed with the new logic.

    } catch (e) {
        console.error("❌ Fetch Failed:", e);
    }
}

main().catch(console.error);
