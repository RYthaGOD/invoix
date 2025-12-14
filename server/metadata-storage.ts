/**
 * Metadata Storage Service
 * 
 * Provides storage for NFT metadata using:
 * - Arweave (permanent, pay-once) - requires ARWEAVE_WALLET_JSON env var
 * - API storage (centralized fallback, always works)
 * 
 * Note: Bundlr and IPFS support can be re-added post-launch with Irys.
 */

import Arweave from "arweave";

interface MetadataUploadResult {
  uri: string;
  provider: "arweave" | "api";
  txId?: string;
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
 * Handles upload of NFT metadata to storage
 */
export class MetadataStorageService {
  private arweave: Arweave | null = null;
  private metadataCache: Map<string, string> = new Map();
  private preferredProvider: "arweave" | "api";

  constructor(preferredProvider: "arweave" | "api" = "api") {
    this.preferredProvider = preferredProvider;
  }

  /**
   * Initialize storage providers
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Arweave if configured
      if (this.preferredProvider === "arweave" && process.env.ARWEAVE_WALLET_JSON) {
        this.arweave = Arweave.init({
          host: "arweave.net",
          port: 443,
          protocol: "https",
        });
        console.log("✅ Metadata storage initialized (arweave)");
      } else {
        this.preferredProvider = "api";
        console.log("✅ Metadata storage initialized (api)");
      }
    } catch (error) {
      console.error("❌ Failed to initialize metadata storage:", error);
      this.preferredProvider = "api";
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
   * Upload raw file with retry logic
   */
  async uploadFile(
    data: Buffer | string,
    identifier: string,
    contentType: string,
    options: Partial<RetryOptions> = {}
  ): Promise<MetadataUploadResult> {
    const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

    return this.retryWithBackoff(
      async () => this._uploadMetadataInternal(data, identifier, contentType),
      retryOptions
    );
  }

  /**
   * Internal upload method
   */
  private async _uploadMetadataInternal(
    data: any,
    identifier: string,
    contentType: string = "application/json"
  ): Promise<MetadataUploadResult> {
    // Check cache first (ignore if buffer to ensure we don't return old data for new file)
    // Actually, identifier usually unique (payment-id), so cache is fine.
    const cachedUri = this.metadataCache.get(identifier);
    if (cachedUri) {
      return {
        uri: cachedUri,
        provider: "api",
      };
    }

    let uploadData: Buffer | string;

    // Determine if data is binary (Buffer) or JSON (Object)
    if (Buffer.isBuffer(data)) {
      uploadData = data;
    } else {
      uploadData = JSON.stringify(data, null, 2);
      // Ensure content type is JSON if identifying as such
      if (contentType === "application/json") {
        // Already default
      }
    }

    // Fallback if not buffer but no content type specified beyond default
    if (!Buffer.isBuffer(data) && contentType !== "application/json") {
      // If passed string but claims to be image/svg, convert to buffer
      uploadData = Buffer.from(data);
    }

    try {
      // Try Arweave if configured
      if (this.arweave && this.preferredProvider === "arweave" && process.env.ARWEAVE_WALLET_JSON) {
        const wallet = JSON.parse(process.env.ARWEAVE_WALLET_JSON);

        const tx = await this.arweave.createTransaction({
          data: uploadData,
        }, wallet);

        tx.addTag("Content-Type", contentType);
        tx.addTag("App-Name", "Invoix");
        tx.addTag("Type", contentType === "application/json" ? "NFT-Metadata" : "NFT-Asset");
        tx.addTag("Identifier", identifier);

        await this.arweave.transactions.sign(tx, wallet);
        await this.arweave.transactions.post(tx);

        const uri = `https://arweave.net/${tx.id}`;
        this.metadataCache.set(identifier, uri);

        console.log(`✅ Uploaded to Arweave (${contentType}): ${uri}`);
        return {
          uri,
          provider: "arweave",
          txId: tx.id,
        };
      }
    } catch (error) {
      console.error(`Failed to upload to arweave:`, error);
    }

    // Fallback: API storage (centralized but reliable)
    // Metadata will be served by our own API endpoint
    // Note: We don't really support binary storage fallback in this simple class yet without filesystem writing.
    // However, for metadata-storage abstraction, we assume if ARWEAVE fails for binary, 
    // we might need a backup. But for now, let's assume API endpoint handles dynamic generation for invoices anyway.
    // For receipts, if Arweave fails, we have a problem. 
    // BUT: The dynamic endpoint can serve the receipt SVG too if we route it!

    const apiUrl = process.env.API_URL || "";
    // If it's an image, point to dynamic endpoint (simplified fallback strategy)
    const uri = contentType.startsWith("image/")
      ? `${apiUrl}/api/images/dynamic-nft/${identifier}.svg`
      : `${apiUrl}/api/nft-metadata/${identifier}`;

    this.metadataCache.set(identifier, uri);

    console.log(`📦 Using API storage fallback: ${uri}`);
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
        const apiUrl = process.env.API_URL || "";
        uploads.push({
          uri: `${apiUrl}/api/nft-metadata/${metadataList[index].identifier}`,
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
  preferredProvider?: "arweave" | "api"
): MetadataStorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new MetadataStorageService(preferredProvider);
  }
  return storageServiceInstance;
}

export async function initializeMetadataStorage(
  preferredProvider?: "arweave" | "api"
): Promise<MetadataStorageService> {
  const service = getMetadataStorageService(preferredProvider);
  await service.initialize();
  return service;
}
