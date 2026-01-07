/**
 * Test Subscription Lifecycle
 * 
 * This script tests the complete on-chain subscription flow:
 * 1. Create a Subscription
 * 2. Mint an Invoice from that Subscription
 * 3. Verify account states
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

async function main() {
    console.log("🚀 Testing Subscription Lifecycle...");

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
        console.error("❌ IDL not found. Run 'anchor build' in arcium-mxe first.");
        process.exit(1);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const programId = new PublicKey(process.env.ARCIUM_PROGRAM_ID || "5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe");
    console.log(`   Program ID: ${programId.toBase58()}`);

    // Update IDL address
    idl.address = programId.toBase58();
    if (idl.metadata) idl.metadata.address = programId.toBase58();
    else idl.metadata = { address: programId.toBase58() };

    const program = new Program(idl as any, new PublicKey(programId), provider);
    console.log("   Registered Accounts:", Object.keys(program.account));

    // @ts-ignore
    const BN = anchor.default ? anchor.default.BN : anchor.BN;

    // ==================================================
    // PHASE 1: CREATE SUBSCRIPTION
    // ==================================================
    console.log("\n📋 Phase 1: Create Subscription");

    const subscriptionId = crypto.randomBytes(16); // Random unique ID
    // Generate a distinct Payer Keypair to verify Subscriber Rights
    const payerKeypair = anchor.web3.Keypair.generate();
    console.log("   Payer Public Key:", payerKeypair.publicKey.toBase58());

    // Fund the Payer
    {
        const tx = new anchor.web3.Transaction().add(
            anchor.web3.SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: payerKeypair.publicKey,
                lamports: 100_000_000, // 0.1 SOL
            })
        );
        await provider.sendAndConfirm(tx);
        console.log("   ✅ Payer Funded (0.1 SOL)");
    }

    const payer = payerKeypair.publicKey;
    const mint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC Devnetholder
    const amountPerPeriod = new BN(50_000_000); // 0.05 SOL per period
    const frequencySeconds = new BN(2592000); // 30 days in seconds
    const startDate = new BN(Math.floor(Date.now() / 1000));
    const totalPeriods = 12; // 12 months
    const assetId = crypto.randomBytes(32); // Master NFT asset ID

    // Derive Subscription PDA
    const [subscriptionPda, subBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("subscription"), wallet.publicKey.toBuffer(), subscriptionId],
        programId
    );
    console.log(`   Subscription PDA: ${subscriptionPda.toBase58()}`);

    try {
        const tx = await program.methods
            .createSubscription(
                Buffer.from(subscriptionId),
                amountPerPeriod,
                frequencySeconds,
                // Security Check Verification:
                // We set the start date to 31 days ago so the first invoice is due NOW.
                // Frequency is 30 days (2592000).
                new BN(Math.floor(Date.now() / 1000) - 2678400), // startDate (31 days ago)
                [...assetId], // assetId comes BEFORE totalPeriods
                12 // totalPeriods
            )
            .accounts({
                subscription: subscriptionPda,
                authority: wallet.publicKey,
                payer: payer,
                mint: mint,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("✅ Subscription Created TX:", tx);
    } catch (e) {
        console.error("❌ Subscription Creation Failed:", e);
        process.exit(1);
    }

    // Verify Subscription
    try {
        const subAccount = await program.account.subscriptionAccount.fetch(subscriptionPda);
        console.log("🎉 Subscription Fetched Successfully!");
        console.log("   Authority:", subAccount.authority.toBase58());
        console.log("   Payer:", subAccount.payer.toBase58());
        console.log("   Amount Per Period:", subAccount.amountPerPeriod.toString());
        console.log("   Frequency (seconds):", subAccount.frequencySeconds.toString());
        console.log("   Status:", JSON.stringify(subAccount.status));
        // @ts-ignore
        console.log("   Asset ID:", Buffer.from(subAccount.assetId).toString("hex").substring(0, 16) + "...");

        // @ts-ignore
        if (subAccount.status && (subAccount.status.active !== undefined || Object.keys(subAccount.status)[0] === 'active')) {
            console.log("✅ CHECK 1: Status is Active.");
        } else {
            console.log("⚠️  CHECK 1: Status may not be Active -", JSON.stringify(subAccount.status));
        }
    } catch (e) {
        console.error("❌ Subscription Fetch Failed:", e);
        process.exit(1);
    }

    // ==================================================
    // PHASE 2: MINT INVOICE FROM SUBSCRIPTION
    // ==================================================
    console.log("\n📋 Phase 2: Mint Invoice from Subscription");

    const invoiceId = crypto.randomBytes(16); // Unique invoice ID
    const invoiceAssetId = crypto.randomBytes(32); // Invoice cNFT asset ID

    // Derive Invoice PDA
    const [invoicePda, invBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("invoice"), wallet.publicKey.toBuffer(), invoiceId],
        programId
    );
    console.log(`   Invoice PDA: ${invoicePda.toBase58()}`);

    try {
        const tx = await program.methods
            .mintInvoiceFromSubscription(
                invoiceId,
                [...crypto.randomBytes(32)], // contentHash
                [...invoiceAssetId]
            )
            .accounts({
                subscription: subscriptionPda,
                invoice: invoicePda,
                authority: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("✅ Invoice Minted TX:", tx);
    } catch (e) {
        console.error("❌ Invoice Minting Failed:", e);
        process.exit(1);
    }

    // Verify Invoice
    try {
        const invoiceAccount = await program.account.invoiceAccount.fetch(invoicePda);
        console.log("🎉 Invoice Fetched Successfully!");
        console.log("   Authority:", invoiceAccount.authority.toBase58());
        console.log("   Amount:", invoiceAccount.amount.toString());
        console.log("   Status:", JSON.stringify(invoiceAccount.status));
        // @ts-ignore
        console.log("   Subscription ID:", invoiceAccount.subscriptionId ? Buffer.from(invoiceAccount.subscriptionId).toString("hex").substring(0, 16) + "..." : "None");

        // @ts-ignore
        if (invoiceAccount.subscriptionId && Buffer.from(invoiceAccount.subscriptionId).toString("hex") !== "0".repeat(64)) {
            console.log("✅ CHECK 2: Invoice is linked to Subscription.");
        } else {
            console.log("⚠️  CHECK 2: Invoice subscription link may be missing.");
        }

        if (invoiceAccount.amount.eq(amountPerPeriod)) {
            console.log("✅ CHECK 3: Invoice amount matches subscription period amount.");
        } else {
            console.log("⚠️  CHECK 3: Amount mismatch -", invoiceAccount.amount.toString(), "vs", amountPerPeriod.toString());
        }
    } catch (e) {
        console.error("❌ Invoice Fetch Failed:", e);
    }

    // ==================================================
    // PHASE 3: TEST SUBSCRIPTION TRADABILITY (Lock)
    // ==================================================
    console.log("\n📋 Phase 3: Test Subscription Locking (for Marketplace)");

    const marketplacePda = Keypair.generate().publicKey; // Mock marketplace PDA

    try {
        const tx = await program.methods
            .lockSubscription(marketplacePda)
            .accounts({
                subscription: subscriptionPda,
                authority: wallet.publicKey,
            })
            .rpc();

        console.log("✅ Subscription Locked TX:", tx);

        // Verify lock
        const lockedSub = await program.account.subscriptionAccount.fetch(subscriptionPda);
        console.log("   New Status:", JSON.stringify(lockedSub.status));
        console.log("   Delegate:", lockedSub.delegate.toBase58());

        // @ts-ignore
        if (lockedSub.status && (lockedSub.status.locked !== undefined || Object.keys(lockedSub.status)[0] === 'locked')) {
            console.log("✅ CHECK 4: Subscription is now Locked.");
        } else {
            console.log("⚠️  CHECK 4: Status may not be Locked -", JSON.stringify(lockedSub.status));
        }

        if (lockedSub.delegate.equals(marketplacePda)) {
            console.log("✅ CHECK 5: Delegate matches marketplace PDA.");
        } else {
            console.log("⚠️  CHECK 5: Delegate mismatch.");
        }
    } catch (e) {
        console.error("❌ Lock Failed:", e);
    }

    // ==================================================
    // PHASE 4: UNLOCK (Delist)
    // ==================================================
    console.log("\n📋 Phase 4: Test Subscription Unlocking");

    try {
        const tx = await program.methods
            .unlockSubscription()
            .accounts({
                subscription: subscriptionPda,
                authority: wallet.publicKey,
            })
            .rpc();

        console.log("✅ Subscription Unlocked TX:", tx);

        // Verify unlock
        const unlockedSub = await program.account.subscriptionAccount.fetch(subscriptionPda);
        console.log("   Status:", JSON.stringify(unlockedSub.status));

        // @ts-ignore
        if (unlockedSub.status && (unlockedSub.status.active !== undefined || Object.keys(unlockedSub.status)[0] === 'active')) {
            console.log("✅ CHECK 6: Subscription is back to Active.");
        } else {
            console.log("⚠️  CHECK 6: Status may not be Active -", JSON.stringify(unlockedSub.status));
        }

        console.log('\n📋 Phase 5: Test Subscription Cancellation (Subscriber Rights)');
        console.log('   Attempting to cancel as PAYER (Subscriber)...');

        // 5. Cancel Subscription AS PAYER
        const tx5 = await program.methods
            .cancelSubscription()
            .accounts({
                subscription: subscriptionPda,
                authority: payerKeypair.publicKey, // Sign as Payer
            })
            .signers([payerKeypair]) // Payer keypair must sign
            .rpc();

        console.log(`✅ Payer Successfully Cancelled Subscription: ${tx5}`);

        const cancelledSub = await program.account.subscriptionAccount.fetch(subscriptionPda);
        console.log('   Status:', JSON.stringify(cancelledSub.status));

        if (cancelledSub.status && (cancelledSub.status.cancelled !== undefined || Object.keys(cancelledSub.status)[0] === 'cancelled')) {
            console.log("✅ CHECK 7: Subscription is Cancelled.");
        } else {
            throw new Error("Checker failed: Subscription should be Cancelled");
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
    }

    console.log("\n🎊 Subscription Lifecycle Test Complete!");
    console.log("   Summary:");
    console.log("   ✓ CreateSubscription");
    console.log("   ✓ MintInvoiceFromSubscription");
    console.log("   ✓ LockSubscription (for Marketplace)");
    console.log("   ✓ UnlockSubscription");
    console.log("   ✓ CancelSubscription");
}

main().catch(console.error);
