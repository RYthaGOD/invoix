
import { db } from "../db";
import { auditLogs } from "@shared/invoice-schema";
import { logger } from "../logger";

/**
 * Log sensitive access attempts for security audit trail
 * 
 * @param params Audit log parameters
 */
export async function logMetadataAccess(params: {
    identifier: string;
    userWallet?: string;
    accessGranted: boolean;
    ipAddress: string;
    details?: string;
}) {
    try {
        await db.insert(auditLogs).values({
            action: 'metadata_access',
            userId: params.userWallet || null,
            resourceId: params.identifier,
            accessGranted: params.accessGranted,
            ipAddress: params.ipAddress,
            details: params.details || null,
            timestamp: new Date()
        });

        // Alert on suspicious failure patterns (e.g. valid ID but access denied)
        if (!params.accessGranted) {
            logger.warn(`[SECURITY AUDIT] Access DENIED for ${params.identifier} from ${params.ipAddress} (User: ${params.userWallet || 'Unknown'})`, "security");
        }
    } catch (error) {
        // Fallback logging if DB fails
        logger.error("Failed to write audit log", "security", { error, params });
    }
}

/**
 * Check for potential enumeration attacks from a specific IP/User
 *
 * Note: Primary rate limiting is handled by express-rate-limit middleware.
 * This function can be extended for sophisticated detection if needed:
 * - Track failed access patterns per IP
 * - Detect sequential ID enumeration attempts
 * - Implement adaptive rate limiting based on behavior
 *
 * For most use cases, the standard rate limiting is sufficient.
 */
export async function checkForEnumerationAttack(userWallet: string | undefined, ipAddress: string): Promise<void> {
    // Currently delegated to express-rate-limit middleware
    // Extend this function if behavioral analysis is needed
}
