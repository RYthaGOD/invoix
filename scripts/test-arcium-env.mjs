// Set environment variables before importing
process.env.ARCIUM_CLUSTER_OFFSET = '1';

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
    getArciumProgram,
    getArciumProgramId,
    getArciumEnv,
    getMXEPublicKey,
    getMXEAccAddress
} from '@arcium-hq/client';

console.log("=== Arcium SDK Integration Test ===\n");

const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// Create a dummy wallet for read-only provider
const dummyWallet = new anchor.Wallet(Keypair.generate());
const provider = new anchor.AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });

console.log("1. SDK Program ID:", getArciumProgramId().toBase58());
console.log("2. SDK Env:", getArciumEnv());

// Get the program using SDK
const program = getArciumProgram(provider);
console.log("3. Program from SDK:", program.programId.toBase58());

// Derive MXE Account Address
const mxeAddress = getMXEAccAddress(program.programId);
console.log("4. MXE Account PDA:", mxeAddress.toBase58());

// Try to fetch MXE Account
console.log("\n5. Attempting to fetch MXE Account Info...");
try {
    const mxeAccountInfo = await connection.getAccountInfo(mxeAddress);
    if (mxeAccountInfo) {
        console.log("   ✅ MXE Account EXISTS!");
        console.log("   Owner:", mxeAccountInfo.owner.toBase58());
        console.log("   Data length:", mxeAccountInfo.data.length);
    } else {
        console.log("   ❌ MXE Account does NOT exist on-chain!");
    }
} catch (err) {
    console.log("   ❌ Error fetching MXE Account:", err.message);
}

// Try to fetch the MXE Public Key using the SDK helper
console.log("\n6. Attempting to use getMXEPublicKey()...");
try {
    const mxeKey = await getMXEPublicKey(provider, program.programId);
    console.log("   ✅ MXE Public Key fetched:", mxeKey);
} catch (err) {
    console.log("   ❌ getMXEPublicKey failed:", err.message);
}

console.log("\n=== Test Complete ===");
