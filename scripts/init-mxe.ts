import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function main() {
    console.log("🚀 Initializing Arcium MXE On-Chain State...");

    // 1. Setup Provider
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

    // Load Wallet
    const walletPath = process.env.ANCHOR_WALLET || "/home/craig/.config/solana/id.json";
    const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // 2. Load Program
    // We need the IDL. After build, it should be in target/idl/arcium_mxe.json
    const idlPath = "./arcium_idl.json";
    if (!fs.existsSync(idlPath)) {
        console.error("❌ SDK IDL not found.");
        process.exit(1);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const programId = new PublicKey(process.env.ARCIUM_PROGRAM_ID!);
    console.log(`   Program ID: ${programId.toBase58()}`);

    // Update IDL address to match actual deployment
    idl.address = programId.toBase58();
    if (idl.metadata) {
        idl.metadata.address = programId.toBase58();
    } else {
        idl.metadata = { address: programId.toBase58() };
    }

    const program = new Program(idl, provider);

    // 3. Derive MXE PDA
    const [mxeAccountPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("MXEAccount"), programId.toBuffer()],
        programId
    );
    console.log(`   Target MXE PDA: ${mxeAccountPda.toBase58()}`);

    // 4. Call Initialize
    try {
        const tx = await program.methods
            .initialize(bump)
            .accounts({
                mxeAccount: mxeAccountPda,
                authority: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("✅ Initialization TX:", tx);
        console.log("🎉 MXE Account Initialized Successfully!");
    } catch (e) {
        console.error("❌ Initialization Failed:", e);
    }
}

main().catch(console.error);
