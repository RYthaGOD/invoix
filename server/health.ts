/**
 * Health Check Endpoint
 * Provides system health status for monitoring and load balancers
 */

import { type Request, type Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getEnvInfo } from "./env-validator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "ok" | "error";
      latency?: number;
      error?: string;
    };
    memory: {
      status: "ok" | "warning";
      used: number;
      total: number;
      percentage: number;
    };
    environment: {
      status: "ok";
      info: Record<string, any>;
    };
    glassCitadel?: {
      status: "ok" | "degraded" | "disabled";
      nftMintingEnabled: boolean;
      merkleTree: string | null;
      collectionMint: string | null;
    };
  };
}

/**
 * Health check endpoint handler
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  const result: HealthCheckResult = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: {
        status: "ok",
      },
      memory: {
        status: "ok",
        used: 0,
        total: 0,
        percentage: 0,
      },
      environment: {
        status: "ok",
        info: {},
      },
    },
  };

  // Database health check
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    result.checks.database.latency = Date.now() - dbStart;
    result.checks.database.status = "ok";
  } catch (error) {
    result.checks.database.status = "error";
    result.checks.database.error = error instanceof Error ? error.message : "Unknown error";
    result.status = "unhealthy";
  }

  // Memory health check
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const memPercentage = (usedMem / totalMem) * 100;

  result.checks.memory = {
    status: memPercentage > 90 ? "warning" : "ok",
    used: Math.round(usedMem / 1024 / 1024), // MB
    total: Math.round(totalMem / 1024 / 1024), // MB
    percentage: Math.round(memPercentage),
  };

  if (memPercentage > 90) {
    result.status = "degraded";
  }

  // Environment info
  result.checks.environment.info = getEnvInfo();

  // Glass Citadel (NFT Audit Trail) status check
  try {
    const { getInvoiceNFTService } = await import("./nft-service");
    const nftService = getInvoiceNFTService();
    const isReady = nftService.isReady();
    const hasCollection = nftService.hasCollection();
    const nftMintingEnabled = process.env.ENABLE_NFT_MINTING === 'true';

    result.checks.glassCitadel = {
      status: !nftMintingEnabled ? "disabled" : (isReady && hasCollection ? "ok" : "degraded"),
      nftMintingEnabled,
      merkleTree: isReady ? nftService.getMerkleTree() : null,
      collectionMint: nftService.getCollectionMint(),
    };
  } catch (error) {
    result.checks.glassCitadel = {
      status: "disabled",
      nftMintingEnabled: process.env.ENABLE_NFT_MINTING === 'true',
      merkleTree: null,
      collectionMint: null,
    };
  }

  // Set HTTP status based on health
  // IMPORTANT: We return 200 even if unhealthy to prevent Railway/K8s from killing the container
  // The 'status' field in the JSON should be used for monitoring alerts instead.
  const statusToHttpCode: Record<string, number> = {
    healthy: 200,
    degraded: 200,
    unhealthy: 200, // Was 503, changed to 200 to keep container alive during DB outages
  };

  const httpStatus = statusToHttpCode[result.status] || 200;

  res.status(httpStatus).json(result);
}

/**
 * Simple liveness probe (for k8s/docker)
 */
export function liveness(req: Request, res: Response): void {
  res.status(200).json({ status: "alive" });
}

/**
 * Readiness probe (for k8s/docker)
 * Checks if the app is ready to receive traffic
 */
export async function readiness(req: Request, res: Response): Promise<void> {
  try {
    // Quick database check
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: "ready" });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
