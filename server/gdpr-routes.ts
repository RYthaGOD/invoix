/**
 * GDPR Compliance Routes
 * 
 * Implements GDPR-required endpoints:
 * - DELETE /api/gdpr/delete-my-data - Right to be Forgotten (Article 17)
 * - GET /api/gdpr/export-my-data - Right to Data Portability (Article 20)
 * 
 * All endpoints require wallet authentication and are rate-limited.
 */

import { Router, Request, Response } from 'express';
import { requireWalletOwnership, strictRateLimit } from './security';
import { gdprService } from './gdpr-service';
import { logger } from './logger';

const router = Router();

/**
 * Request data deletion (Right to be Forgotten - GDPR Article 17)
 * DELETE /api/gdpr/delete-my-data
 * 
 * Deletes or anonymizes all user data in compliance with GDPR.
 * - Deletes: Auth nonces, webhook endpoints
 * - Anonymizes: Invoices, payments, profiles (preserves audit trail)
 * 
 * @requires Authentication
 * @rateLimit 10 requests per 15 minutes
 */
router.delete('/delete-my-data', requireWalletOwnership, strictRateLimit, async (req: any, res: Response) => {
    try {
        const walletAddress = req.authenticatedWallet;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Log the request for audit trail (immutable)
        logger.warn(`GDPR deletion requested by ${walletAddress}`, 'gdpr', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        // Process deletion request
        const result = await gdprService.processDataDeletionRequest(walletAddress);

        // Destroy session after deletion
        req.session.destroy((err: any) => {
            if (err) {
                logger.error('Session destroy error after GDPR deletion', 'gdpr', { error: err.message });
            }
        });

        // Return success response
        res.json({
            success: true,
            message: result.message,
            deletedRecords: result.deletedRecords,
            anonymizedRecords: result.anonymizedRecords,
            details: result.details,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        logger.error('GDPR deletion endpoint error', 'gdpr', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Failed to process data deletion request. Please contact support if this persists.'
        });
    }
});

/**
 * Export user data (Right to Data Portability - GDPR Article 20)
 * GET /api/gdpr/export-my-data
 * 
 * Exports all user data in machine-readable JSON format.
 * Includes: profile, invoices, payments, subscriptions, credit score
 * 
 * @requires Authentication
 * @rateLimit 10 requests per 15 minutes
 */
router.get('/export-my-data', requireWalletOwnership, strictRateLimit, async (req: any, res: Response) => {
    try {
        const walletAddress = req.authenticatedWallet;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Log export request for audit
        logger.info(`GDPR data export requested by ${walletAddress}`, 'gdpr', {
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        // Export user data
        const data = await gdprService.exportUserData(walletAddress);

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="invoix-data-${walletAddress.slice(0, 8)}-${Date.now()}.json"`);

        // Return data
        res.json(data);

    } catch (error: any) {
        logger.error('GDPR export endpoint error', 'gdpr', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Failed to export data. Please contact support if this persists.'
        });
    }
});

/**
 * Check if user has data (for confirmation after deletion)
 * GET /api/gdpr/check-data
 * 
 * @requires Authentication
 */
router.get('/check-data', requireWalletOwnership, async (req: any, res: Response) => {
    try {
        const walletAddress = req.authenticatedWallet;

        if (!walletAddress) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const hasData = await gdprService.hasUserData(walletAddress);

        res.json({
            success: true,
            hasData,
            walletAddress: hasData ? walletAddress : 'No data found'
        });

    } catch (error: any) {
        logger.error('GDPR check-data endpoint error', 'gdpr', { error: error.message });

        res.status(500).json({
            success: false,
            message: 'Failed to check data status'
        });
    }
});

/**
 * Register GDPR routes with Express app
 */
export function registerGDPRRoutes(app: any) {
    app.use('/api/gdpr', router);
    logger.info('GDPR routes registered at /api/gdpr', 'gdpr');
}
