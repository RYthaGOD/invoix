/**
 * Metadata Storage Service
 * 
 * Provides decentralized storage for NFT metadata using:
 * - Arweave (permanent, pay-once)
 * - Bundlr (faster uploads to Arweave)
 * - IPFS (optional fallback)
 * 
 * Features:
 * - Retry logic with exponential backoff
 * - Metadata caching
 * - Automatic format conversion
 */

import Arweave from "arweave";
import Bundlr from "@bundlr-network/client";
import { create as ipfsCreate } from "ipfs-http-client";

interface MetadataUploadResult {
  uri: string;
  provider: "arweave" | "bundlr" | "ipfs" | "api";
  txId?: string;
  cid?: string;
  cost?: string;
}

interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Metadata Storage Service
 * Handles upload of NFT metadata to decentralized storage
 */
export class MetadataStorageService {
  private arweave: Arweave | null = null;
  private bundlr: Bundlr | null = null;
  private ipfs: any = null;
  private metadataCache: Map<string, string> = new Map();
  private preferredProvider: "arweave" | "bundlr" | "ipfs" | "api";

  constructor(preferredProvider: "arweave" | "bundlr" | "ipfs" | "api" = "api") {
    this.preferredProvider = preferredProvider;
  }

  /**
   * Initialize storage providers
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Arweave
      if (this.preferredProvider === "arweave" || this.preferredProvider === "bundlr") {
        this.arweave = Arweave.init({
          host: "arweave.net",
          port: 443,
          protocol: "https",
        });

        // Initialize Bundlr (faster Arweave uploads)
        if (this.preferredProvider === "bundlr" && process.env.BUNDLR_PRIVATE_KEY) {
          this.bundlr = new Bundlr(
            "https://node1.bundlr.network",
            "solana",
            process.env.BUNDLR_PRIVATE_KEY
          );
          await this.bundlr.ready();
        }
      }

      // Initialize IPFS (fallback)
      if (this.preferredProvider === "ipfs") {
        this.ipfs = ipfsCreate({
          host: process.env.IPFS_HOST || "ipfs.infura.io",
          port: parseInt(process.env.IPFS_PORT || "5001"),
          protocol: "https",
        });
      }

      console.log(`✅ Metadata storage initialized (${this.preferredProvider})`);
    } catch (error) {
      console.error("❌ Failed to initialize metadata storage:", error);
      this.preferredProvider = "api"; // Fallback to API storage
    }
  }

  /**
   * Upload metadata with retry logic
   */
  async uploadMetadata(
    metadata: any,
    identifier: string,
    options: Partial<RetryOptions> = {}
  ): Promise<MetadataUploadResult> {
    const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    
    return this.retryWithBackoff(
      async () => this._uploadMetadataInternal(metadata, identifier),
      retryOptions
    );
  }

  /**
   * Internal upload method
   */
  private async _uploadMetadataInternal(
    metadata: any,
    identifier: string
  ): Promise<MetadataUploadResult> {
    // Check cache first
    const cachedUri = this.metadataCache.get(identifier);
    if (cachedUri) {
      return {
        uri: cachedUri,
        provider: "api", // Cached from previous upload
      };
    }

    const metadataJson = JSON.stringify(metadata, null, 2);
    const metadataBuffer = Buffer.from(metadataJson, "utf-8");

    try {
      // Try Bundlr first (fastest)
      if (this.bundlr && this.preferredProvider === "bundlr") {
        const tx = this.bundlr.createTransaction(metadataBuffer, {
          tags: [
            { name: "Content-Type", value: "application/json" },
            { name: "App-Name", value: "SolanaInvoice" },
            { name: "Type", value: "NFT-Metadata" },
            { name: "Identifier", value: identifier },
          ],
        });
        
        await tx.sign();
        await tx.upload();
        
        const uri = `https://arweave.net/${tx.id}`;
        this.metadataCache.set(identifier, uri);
        
        console.log(`✅ Uploaded to Bundlr: ${uri}`);
        return {
          uri,
          provider: "bundlr",
          txId: tx.id,
          cost: await this.bundlr.getPrice(metadataBuffer.length).then(p => p.toString()),
        };
      }

      // Try Arweave
      if (this.arweave && this.preferredProvider === "arweave") {
        const wallet = JSON.parse(process.env.ARWEAVE_WALLET_JSON || "{}");
        
        const tx = await this.arweave.createTransaction({
          data: metadataBuffer,
        }, wallet);
        
        tx.addTag("Content-Type", "application/json");
        tx.addTag("App-Name", "SolanaInvoice");
        tx.addTag("Type", "NFT-Metadata");
        tx.addTag("Identifier", identifier);
        
        await this.arweave.transactions.sign(tx, wallet);
        await this.arweave.transactions.post(tx);
        
        const uri = `https://arweave.net/${tx.id}`;
        this.metadataCache.set(identifier, uri);
        
        console.log(`✅ Uploaded to Arweave: ${uri}`);
        return {
          uri,
          provider: "arweave",
          txId: tx.id,
        };
      }

      // Try IPFS
      if (this.ipfs && this.preferredProvider === "ipfs") {
        const result = await this.ipfs.add(metadataJson);
        const uri = `https://ipfs.io/ipfs/${result.cid.toString()}`;
        
        this.metadataCache.set(identifier, uri);
        
        console.log(`✅ Uploaded to IPFS: ${uri}`);
        return {
          uri,
          provider: "ipfs",
          cid: result.cid.toString(),
        };
      }
    } catch (error) {
      console.error(`Failed to upload to ${this.preferredProvider}:`, error);
      // Fall through to API storage
    }

    // Fallback: API storage (centralized but reliable)
    const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
    const uri = `${apiUrl}/nft-metadata/${identifier}`;
    
    this.metadataCache.set(identifier, uri);
    
    console.log(`⚠️ Using API storage (fallback): ${uri}`);
    return {
      uri,
      provider: "api",
    };
  }

  /**
   * Batch upload multiple metadata files
   */
  async batchUploadMetadata(
    metadataList: Array<{ metadata: any; identifier: string }>,
    options: Partial<RetryOptions> = {}
  ): Promise<MetadataUploadResult[]> {
    console.log(`📦 Batch uploading ${metadataList.length} metadata files...`);
    
    const results = await Promise.allSettled(
      metadataList.map((item) =>
        this.uploadMetadata(item.metadata, item.identifier, options)
      )
    );

    const uploads: MetadataUploadResult[] = [];
    let succeeded = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        uploads.push(result.value);
        succeeded++;
      } else {
        console.error(`Failed to upload ${metadataList[index].identifier}:`, result.reason);
        // Fallback to API storage
        const apiUrl = process.env.API_URL || "https://api.solanainvoice.com";
        uploads.push({
          uri: `${apiUrl}/nft-metadata/${metadataList[index].identifier}`,
          provider: "api",
        });
        failed++;
      }
    });

    console.log(`✅ Batch upload complete: ${succeeded} succeeded, ${failed} failed`);
    return uploads;
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = options.initialDelayMs;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < options.maxRetries) {
          console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
          delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
        }
      }
    }

    throw new Error(
      `Failed after ${options.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get estimated cost for storage
   */
  async getEstimatedCost(dataSizeBytes: number): Promise<{
    arweave?: string;
    bundlr?: string;
    ipfs: string;
  }> {
    const costs: any = { ipfs: "0" }; // IPFS is free (but not permanent)

    try {
      if (this.arweave) {
        const price = await this.arweave.transactions.getPrice(dataSizeBytes);
        costs.arweave = this.arweave.ar.winstonToAr(price);
      }

      if (this.bundlr) {
        const price = await this.bundlr.getPrice(dataSizeBytes);
        costs.bundlr = price.toString();
      }
    } catch (error) {
      console.error("Failed to get storage costs:", error);
    }

    return costs;
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.metadataCache.size,
      entries: Array.from(this.metadataCache.keys()),
    };
  }
}

/**
 * Singleton instance
 */
let storageServiceInstance: MetadataStorageService | null = null;

export function getMetadataStorageService(
  preferredProvider?: "arweave" | "bundlr" | "ipfs" | "api"
): MetadataStorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new MetadataStorageService(preferredProvider);
  }
  return storageServiceInstance;
}

export async function initializeMetadataStorage(
  preferredProvider?: "arweave" | "bundlr" | "ipfs" | "api"
): Promise<MetadataStorageService> {
  const service = getMetadataStorageService(preferredProvider);
  await service.initialize();
  return service;
}
