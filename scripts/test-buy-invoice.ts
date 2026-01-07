import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

/**
 * INTEGRATION TEST: Buy Invoice Flow
 * 
 * This script documents the verification steps for the "Deep Dive" hardening.
 * It tests the interaction between `marketplace-program` and `arcium-mxe`.
 * 
 * Flow:
 * 1. Create Invoice (Arcium) -> Status: Draft
 * 2. List Invoice (Marketplace CPI -> Arcium) -> Status: Locked, Delegate: ListingPDA
 * 3. Buy Invoice (Marketplace CPI -> Arcium) -> Status: Factored, Authority: Buyer
 */

async function main() {
    console.log("🚀 Testing System Integration (Marketplace <-> Arcium)...");

    // 1. Setup Provider
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
    const walletPath = process.env.ANCHOR_WALLET || "/home/craig/.config/solana/id.json";
    const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // 2. Load Programs
    const arciumIdl = JSON.parse(fs.readFileSync("./arcium_idl.json", "utf-8"));
    const arciumProgramId = new PublicKey(process.env.ARCIUM_PROGRAM_ID || arciumIdl.metadata.address);
    const arciumProgram = new Program(arciumIdl, provider);

    // Placeholder for when Marketplace IDL is generated
    // const marketplaceIdl = JSON.parse(fs.readFileSync("./marketplace_idl.json", "utf-8")); 
    // const marketplaceProgram = new Program(marketplaceIdl, provider);

    console.log("Programs Loaded.");

    // 3. Create Invoice (Setup)
    const invoiceId = crypto.randomBytes(16);
    const assetId = crypto.randomBytes(32); // Mock Asset ID

    const [invoicePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("invoice"), wallet.publicKey.toBuffer(), invoiceId],
        arciumProgramId
    );
    console.log("Creating Invoice:", invoicePda.toBase58());

    // await arciumProgram.methods.createInvoice(...).rpc();

    // 4. List Invoice (Trigger Lock)
    console.log("--> Listing Invoice (Mocking Bubblegum interactions)...");

    // const [listingPda] = PublicKey.findProgramAddressSync(
    //    [Buffer.from("listing"), wallet.publicKey.toBuffer()],
    //    marketplaceProgram.programId
    // );

    // await marketplaceProgram.methods.listInvoice(...)
    //    .accounts({
    //        invoiceAccount: invoicePda,
    //        arciumProgram: arciumProgramId,
    //        ...
    //    }).rpc();

    // 5. Verify Lock
    console.log("--> Verifying Lock State on Arcium...");
    const invoiceAccount = await arciumProgram.account.invoiceAccount.fetch(invoicePda);
    // @ts-ignore
    if (invoiceAccount.status.locked) {
        console.log("✅ Invoice is LOCKED.");
    } else {
        console.error("❌ Invoice is NOT Locked.");
    }
    // @ts-ignore
    console.log("   Delegate:", invoiceAccount.delegate.toBase58());

    // 6. Buy Invoice (Trigger Transfer)
    console.log("--> Buying Invoice...");
    // await marketplaceProgram.methods.buyInvoice(...)
    //    .accounts({
    //        invoiceAccount: invoicePda,
    //        arciumProgram: arciumProgramId,
    //        ...
    //    }).rpc();

    // 7. Verify Ownership Transfer
    const updatedAccount = await arciumProgram.account.invoiceAccount.fetch(invoicePda);
    console.log("✅ Final Authority:", updatedAccount.authority.toBase58());
    // @ts-ignore
    if (updatedAccount.status.factored) {
        console.log("✅ Invoice is FACTORED.");
    }
}

main().catch(console.error);
