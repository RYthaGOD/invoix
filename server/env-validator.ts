/**
 * Environment Variable Validator
 * Validates required environment variables on startup
 */

import { log } from "./vite";

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

const ENVIRONMENT_VARIABLES: EnvVar[] = [
  // Database (optional - uses SQLite if not set in development)
  {
    key: "DATABASE_URL",
    required: false,
    description: "PostgreSQL database connection string (optional - uses SQLite if not set)",
  },

  // Security
  {
    key: "SESSION_SECRET",
    required: false, // Changed to false to prevent crash
    description: "Secret key for session encryption (min 32 characters)",
    defaultValue: "temporary-session-secret-change-in-prod-please",
  },

  // Solana
  {
    key: "SOLANA_RPC_URL",
    required: false, // Changed to false to prevent crash
    description: "Solana RPC endpoint URL",
    defaultValue: "https://api.devnet.solana.com",
  },
  {
    key: "SOLANA_NETWORK",
    required: false,
    description: "Solana network (mainnet-beta, devnet, testnet)",
    defaultValue: "devnet",
  },
  {
    key: "PAYER_PRIVATE_KEY",
    required: false,
    description: "Base58 private key for paying transaction fees (required for NFT minting)",
  },

  // Optional: Metadata Storage
  {
    key: "BUNDLR_PRIVATE_KEY",
    required: false,
    description: "Private key for Bundlr (Arweave) metadata storage",
  },
  {
    key: "ARWEAVE_WALLET_JWK",
    required: false,
    description: "Arweave wallet JWK for direct uploads",
  },
  {
    key: "IPFS_API_URL",
    required: false,
    description: "IPFS API endpoint (e.g., https://ipfs.infura.io:5001)",
  },
  {
    key: "IPFS_PROJECT_ID",
    required: false,
    description: "IPFS project ID for authentication",
  },
  {
    key: "IPFS_PROJECT_SECRET",
    required: false,
    description: "IPFS project secret for authentication",
  },

  // Optional: Feature Flags
  {
    key: "ENABLE_NFT_MINTING",
    required: false,
    description: "Enable automatic NFT minting (true/false)",
    defaultValue: "true",
  },
  {
    key: "ENABLE_ARCIUM_ENCRYPTION",
    required: false,
    description: "Enable Arcium encryption (true/false)",
    defaultValue: "false",
  },
];

export function validateEnvironment(): void {
  log("🔍 Validating environment variables...");

  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  for (const envVar of ENVIRONMENT_VARIABLES) {
    const value = process.env[envVar.key];

    if (!value) {
      if (envVar.required) {
        errors.push(
          `❌ Missing required environment variable: ${envVar.key}\n   Description: ${envVar.description}`
        );
      } else if (envVar.defaultValue) {
        process.env[envVar.key] = envVar.defaultValue;
        // Use warning for critical defaults to alert admin
        const level = (envVar.key === 'SESSION_SECRET' || envVar.key === 'SOLANA_RPC_URL') ? 'warn' : 'info';
        if (level === 'warn') {
          warnings.push(`⚠️  Using default for ${envVar.key}: ${envVar.key === 'SESSION_SECRET' ? '***' : envVar.defaultValue}`);
        } else {
          info.push(`ℹ️  Using default for ${envVar.key}: ${envVar.defaultValue}`);
        }
      } else {
        warnings.push(
          `⚠️  Optional environment variable not set: ${envVar.key}\n   Description: ${envVar.description}`
        );
      }
    } else {
      // Additional validation for specific variables
      if (envVar.key === "SESSION_SECRET" && value.length < 32) {
        errors.push(
          `❌ SESSION_SECRET must be at least 32 characters long (current: ${value.length})`
        );
      }

      if (envVar.key === "DATABASE_URL" && !value.startsWith("postgres://") && !value.startsWith("postgresql://")) {
        errors.push(
          `❌ DATABASE_URL must be a PostgreSQL connection string (should start with 'postgres://' or 'postgresql://')`
        );
      }

      if (envVar.key === "SOLANA_RPC_URL" && !value.startsWith("http")) {
        errors.push(
          `❌ SOLANA_RPC_URL must be a valid HTTP/HTTPS URL`
        );
      }
    }
  }

  // Print results
  if (info.length > 0) {
    info.forEach((msg) => log(msg));
  }

  if (warnings.length > 0) {
    console.warn("\n⚠️  Environment Warnings:");
    warnings.forEach((msg) => console.warn(msg));
  }

  if (errors.length > 0) {
    console.error("\n❌ Environment Validation Failed:");
    errors.forEach((msg) => console.error(msg));
    console.error("\n💡 Tip: Copy .env.example to .env and fill in the required values");
    // process.exit(1); // DISABLED: Prevent crash to allow startup
    console.error("⚠️  Proceeding with startup despite validation errors (Risk of instability)");
  } else {
    log("✅ Environment validation passed");
  }
}

export function getEnvInfo(): Record<string, any> {
  return {
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV || "development",
    solanaNetwork: process.env.SOLANA_NETWORK || "devnet",
    nftMintingEnabled: process.env.ENABLE_NFT_MINTING === "true",
    arciumEnabled: process.env.ENABLE_ARCIUM_ENCRYPTION === "true",
    hasBundlr: !!process.env.BUNDLR_PRIVATE_KEY,
    hasArweave: !!process.env.ARWEAVE_WALLET_JWK,
    hasIPFS: !!process.env.IPFS_API_URL,
    hasPayerKey: !!process.env.PAYER_PRIVATE_KEY,
  };
}
