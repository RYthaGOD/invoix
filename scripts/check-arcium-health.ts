/**
 * Arcium MXE Comprehensive Health Check
 *
 * Verifies all components of the Arcium integration:
 * 1. Environment configuration
 * 2. SDK service initialization
 * 3. On-chain program deployment
 * 4. Encryption/decryption round-trip
 * 5. PDA derivation
 */

import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { config } from "dotenv";

// Load environment variables
config();

interface HealthCheckResult {
  check: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: Record<string, any>;
}

const results: HealthCheckResult[] = [];

function log(check: string, status: "pass" | "fail" | "warn", message: string, details?: Record<string, any>) {
  const icons = { pass: "✅", fail: "❌", warn: "⚠️" };
  console.log(`${icons[status]} ${check}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2).split("\n").join("\n   "));
  }
  results.push({ check, status, message, details });
}

async function checkEnvironment(): Promise<void> {
  console.log("\n📋 ENVIRONMENT CONFIGURATION\n");

  // Check ENABLE_ARCIUM_ENCRYPTION
  const arciumEnabled = process.env.ENABLE_ARCIUM_ENCRYPTION === "true";
  log(
    "ENABLE_ARCIUM_ENCRYPTION",
    arciumEnabled ? "pass" : "warn",
    arciumEnabled ? "Enabled" : "Disabled (Arcium features will be inactive)",
    { value: process.env.ENABLE_ARCIUM_ENCRYPTION || "not set" }
  );

  // Check ARCIUM_PROGRAM_ID
  const programId = process.env.ARCIUM_PROGRAM_ID;
  if (programId) {
    try {
      new PublicKey(programId);
      log("ARCIUM_PROGRAM_ID", "pass", "Valid Solana address", { programId });
    } catch {
      log("ARCIUM_PROGRAM_ID", "fail", "Invalid Solana address format", { programId });
    }
  } else {
    log("ARCIUM_PROGRAM_ID", "warn", "Not set (on-chain features unavailable)");
  }

  // Check PAYER_PRIVATE_KEY or ARCIUM_PRIVATE_KEY
  const hasPrivateKey = !!(process.env.PAYER_PRIVATE_KEY || process.env.ARCIUM_PRIVATE_KEY);
  log(
    "Private Key",
    hasPrivateKey ? "pass" : "warn",
    hasPrivateKey ? "Configured" : "Not set (server will use ephemeral keys)",
    { source: process.env.ARCIUM_PRIVATE_KEY ? "ARCIUM_PRIVATE_KEY" : process.env.PAYER_PRIVATE_KEY ? "PAYER_PRIVATE_KEY" : "none" }
  );

  // Check SOLANA_RPC_URL
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  log("SOLANA_RPC_URL", "pass", "Configured", { url: rpcUrl });

  // Check SOLANA_NETWORK
  const network = process.env.SOLANA_NETWORK || "devnet";
  log("SOLANA_NETWORK", "pass", `Network: ${network}`, { network });
}

async function checkSdkService(): Promise<boolean> {
  console.log("\n🔐 SDK SERVICE INITIALIZATION\n");

  try {
    // Dynamically import the service to avoid initialization issues
    const { getArciumService, initializeArciumService } = await import("../server/arcium-service");

    // Initialize if not already
    const success = await initializeArciumService();

    if (success) {
      const service = getArciumService();
      const publicKey = service.getServerPublicKey();

      log("SDK Initialization", "pass", "Service initialized successfully", {
        hasPublicKey: !!publicKey,
        publicKeyPreview: publicKey ? Buffer.from(publicKey).toString("hex").substring(0, 32) + "..." : null,
      });
      return true;
    } else {
      log("SDK Initialization", "fail", "Service failed to initialize");
      return false;
    }
  } catch (error: any) {
    log("SDK Initialization", "fail", `Error: ${error.message}`);
    return false;
  }
}

async function checkOnChainProgram(): Promise<boolean> {
  console.log("\n⛓️ ON-CHAIN PROGRAM VERIFICATION\n");

  const programId = process.env.ARCIUM_PROGRAM_ID;
  if (!programId) {
    log("Program Deployment", "warn", "ARCIUM_PROGRAM_ID not configured, skipping on-chain check");
    return false;
  }

  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    const pubkey = new PublicKey(programId);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo) {
      log("Program Deployment", "fail", "Program not found on-chain", {
        programId,
        network: process.env.SOLANA_NETWORK || "devnet",
      });
      return false;
    }

    if (!accountInfo.executable) {
      log("Program Deployment", "fail", "Account exists but is not executable (not a program)", {
        programId,
        dataLen: accountInfo.data.length,
      });
      return false;
    }

    log("Program Deployment", "pass", "Program verified on-chain", {
      programId,
      dataLen: accountInfo.data.length,
      owner: accountInfo.owner.toString(),
    });
    return true;
  } catch (error: any) {
    log("Program Deployment", "fail", `Error: ${error.message}`);
    return false;
  }
}

async function checkEncryptionRoundtrip(): Promise<boolean> {
  console.log("\n🔒 ENCRYPTION ROUND-TRIP TEST\n");

  try {
    const { getArciumService } = await import("../server/arcium-service");
    const service = getArciumService();

    if (!service.isAvailable()) {
      log("Encryption Round-trip", "fail", "SDK service not available");
      return false;
    }

    // Generate test keypairs for allowed parties
    const party1 = Keypair.generate();
    const party2 = Keypair.generate();

    const testData = {
      amount: "100.00",
      tokenAmount: "100000000",
      fromAddress: party1.publicKey.toBase58(),
      toAddress: party2.publicKey.toBase58(),
      txSignature: "testSignature123",
      timestamp: Date.now(),
      description: "Health check test invoice",
      items: [{ description: "Test item", quantity: 1, price: 100 }],
    };

    const allowedParties = [party1.publicKey.toBase58(), party2.publicKey.toBase58()];

    // Encrypt
    const encryptResult = await service.encryptTransaction(testData, allowedParties);

    if (!encryptResult.success) {
      log("Encryption Round-trip", "fail", `Encryption failed: ${encryptResult.error}`);
      return false;
    }

    log("Encryption", "pass", "Data encrypted successfully", {
      encryptedDataLength: encryptResult.encryptedData.length,
      encryptionKeyLength: encryptResult.encryptionKey.length,
    });

    // Decrypt
    const decryptedData = await service.decryptTransaction(
      encryptResult.encryptedData,
      encryptResult.encryptionKey
    );

    if (!decryptedData) {
      log("Decryption", "fail", "Decryption returned null");
      return false;
    }

    // Verify data integrity
    const dataMatch =
      decryptedData.amount === testData.amount &&
      decryptedData.fromAddress === testData.fromAddress &&
      decryptedData.toAddress === testData.toAddress;

    if (dataMatch) {
      log("Decryption", "pass", "Data decrypted and verified successfully");
      log("Encryption Round-trip", "pass", "Full round-trip successful");
      return true;
    } else {
      log("Decryption", "fail", "Decrypted data does not match original");
      return false;
    }
  } catch (error: any) {
    log("Encryption Round-trip", "fail", `Error: ${error.message}`);
    return false;
  }
}

async function checkPdaDerivation(): Promise<boolean> {
  console.log("\n📍 PDA DERIVATION TEST\n");

  const programId = process.env.ARCIUM_PROGRAM_ID;
  if (!programId) {
    log("PDA Derivation", "warn", "ARCIUM_PROGRAM_ID not configured, skipping PDA test");
    return false;
  }

  try {
    const testAuthority = Keypair.generate().publicKey;
    const testInvoiceId = "test-invoice-" + Date.now();

    const invoiceIdBytes = Buffer.from(testInvoiceId, "utf-8");
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("invoice"), testAuthority.toBuffer(), invoiceIdBytes],
      new PublicKey(programId)
    );

    // Derive again to verify determinism
    const [pda2, bump2] = PublicKey.findProgramAddressSync(
      [Buffer.from("invoice"), testAuthority.toBuffer(), invoiceIdBytes],
      new PublicKey(programId)
    );

    const isDeterministic = pda.equals(pda2) && bump === bump2;

    if (isDeterministic) {
      log("PDA Derivation", "pass", "PDA derivation is deterministic", {
        authority: testAuthority.toBase58(),
        invoiceId: testInvoiceId,
        pda: pda.toBase58(),
        bump,
      });
      return true;
    } else {
      log("PDA Derivation", "fail", "PDA derivation is not deterministic");
      return false;
    }
  } catch (error: any) {
    log("PDA Derivation", "fail", `Error: ${error.message}`);
    return false;
  }
}

async function generateReport(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📊 HEALTH CHECK SUMMARY");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️ Warnings: ${warned}`);

  const overallStatus = failed > 0 ? "UNHEALTHY" : warned > 0 ? "DEGRADED" : "HEALTHY";
  const statusIcon = failed > 0 ? "❌" : warned > 0 ? "⚠️" : "✅";

  console.log(`\n${statusIcon} Overall Status: ${overallStatus}`);

  if (failed > 0) {
    console.log("\n🔧 Failed checks require attention:");
    results.filter((r) => r.status === "fail").forEach((r) => {
      console.log(`   - ${r.check}: ${r.message}`);
    });
  }

  if (warned > 0) {
    console.log("\n💡 Warnings (non-blocking but recommended to address):");
    results.filter((r) => r.status === "warn").forEach((r) => {
      console.log(`   - ${r.check}: ${r.message}`);
    });
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("🏥 ARCIUM MXE COMPREHENSIVE HEALTH CHECK");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await checkEnvironment();
  const sdkOk = await checkSdkService();
  const programOk = await checkOnChainProgram();

  if (sdkOk) {
    await checkEncryptionRoundtrip();
  }

  if (programOk) {
    await checkPdaDerivation();
  }

  await generateReport();

  // Exit with appropriate code
  const failed = results.filter((r) => r.status === "fail").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Health check failed:", error);
  process.exit(1);
});
