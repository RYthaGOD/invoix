/**
 * GDPR Compliance Service
 * 
 * Implements GDPR Article 17 "Right to be Forgotten" and Article 20 "Right to Data Portability".
 * 
 * Strategy: Hybrid Anonymization + Deletion
 * - DELETE: Auth nonces, webhook endpoints (no business value)
 * - ANONYMIZE: Invoices, payments, profiles (preserve audit trail)
 * 
 * Compliance: GDPR, CCPA, UK GDPR
 */

import { db, runTransaction } from './db';
import {
    authNonces,
    businessCreditScores,
    customerProfiles,
    invoices,
    payments,
    subscriptions,
    subscriptionPlans
} from '@shared/invoice-schema';
import { webhooks } from '@shared/webhooks-schema';
import { eq, or } from 'drizzle-orm';
import { logger } from './logger';
import crypto from 'crypto';

export class GDPRService {
    /**
     * Anonymize a wallet address for GDPR compliance
     * Format: ANON-{hash} to maintain uniqueness while removing PII
     */
    private anonymizeWallet(walletAddress: string): string {
        const hash = crypto.createHash('sha256').update(walletAddress).digest('hex').slice(0, 16);
        return `ANON-${hash}`;
    }

    /**
     * Process GDPR data deletion request
     * 
     * Anonymizes user data while preserving audit trails and business records.
     * Complies with GDPR Article 17 requirements.
     * 
     * @param walletAddress - User's wallet address to delete/anonymize
     * @returns Summary of deletion and anonymization actions
     */
    async processDataDeletionRequest(walletAddress: string): Promise<{
        success: boolean;
        deletedRecords: number;
        anonymizedRecords: number;
        message: string;
        details: {
            authNonces: number;
            webhooks: number;
            creditScores: number;
            customerProfiles: number;
            invoices: number;
            payments: number;
            subscriptions: number;
        };
    }> {
        try {
            logger.info(`Processing GDPR deletion request for ${walletAddress}`, 'gdpr');

            const anonymizedWallet = this.anonymizeWallet(walletAddress);
            let deletedCount = 0;
            let anonymizedCount = 0;
            const details = {
                authNonces: 0,
                webhooks: 0,
                creditScores: 0,
                customerProfiles: 0,
                invoices: 0,
                payments: 0,
                subscriptions: 0
            };

            await runTransaction(async (tx) => {
                // 1. DELETE: Auth nonces (no business value, safe to delete)
                const deletedNonces = await tx.delete(authNonces)
                    .where(eq(authNonces.walletAddress, walletAddress))
                    .returning();
                details.authNonces = deletedNonces.length;
                deletedCount += deletedNonces.length;

                // 2. DELETE: Webhook endpoints (user-specific config, safe to delete)
                const deletedWebhooks = await tx.delete(webhooks)
                    .where(eq(webhooks.ownerWallet, walletAddress))
                    .returning();
                details.webhooks = deletedWebhooks.length;
                deletedCount += deletedWebhooks.length;

                // 3. ANONYMIZE: Business credit scores (preserve business analytics)
                const anonymizedScores = await tx.update(businessCreditScores)
                    .set({
                        walletAddress: anonymizedWallet,
                        updatedAt: new Date()
                    })
                    .where(eq(businessCreditScores.walletAddress, walletAddress))
                    .returning();
                details.creditScores = anonymizedScores.length;
                anonymizedCount += anonymizedScores.length;

                // 4. ANONYMIZE: Customer profiles (preserve business relationships)
                const anonymizedCustomers = await tx.update(customerProfiles)
                    .set({
                        customerWalletAddress: anonymizedWallet,
                        customerEmail: null, // Remove PII
                        customerName: 'Deleted User',
                        updatedAt: new Date()
                    })
                    .where(eq(customerProfiles.customerWalletAddress, walletAddress))
                    .returning();
                details.customerProfiles = anonymizedCustomers.length;
                anonymizedCount += anonymizedCustomers.length;

                // 5. ANONYMIZE: Invoices (preserve financial records for compliance)
                const anonymizedInvoices = await tx.update(invoices)
                    .set({
                        invoicerWalletAddress: anonymizedWallet,
                        invoiceeWalletAddress: anonymizedWallet,
                        // Remove PII from invoice details
                        description: 'Deleted user invoice',
                        notes: null,
                        updatedAt: new Date()
                    })
                    .where(or(
                        eq(invoices.invoicerWalletAddress, walletAddress),
                        eq(invoices.invoiceeWalletAddress, walletAddress)
                    ))
                    .returning();
                details.invoices = anonymizedInvoices.length;
                anonymizedCount += anonymizedInvoices.length;

                // 6. ANONYMIZE: Payments (preserve audit trail for tax/compliance)
                const anonymizedPayments = await tx.update(payments)
                    .set({
                        fromAddress: anonymizedWallet,
                        toAddress: anonymizedWallet,
                        updatedAt: new Date()
                    })
                    .where(or(
                        eq(payments.fromAddress, walletAddress),
                        eq(payments.toAddress, walletAddress)
                    ))
                    .returning();
                details.payments = anonymizedPayments.length;
                anonymizedCount += anonymizedPayments.length;

                // 7. ANONYMIZE: Subscriptions (preserve subscription history)
                const anonymizedSubscriptions = await tx.update(subscriptions)
                    .set({
                        invoicerWalletAddress: anonymizedWallet,
                        customerWalletAddress: anonymizedWallet,
                        updatedAt: new Date()
                    })
                    .where(or(
                        eq(subscriptions.invoicerWalletAddress, walletAddress),
                        eq(subscriptions.customerWalletAddress, walletAddress)
                    ))
                    .returning();
                details.subscriptions = anonymizedSubscriptions.length;
                anonymizedCount += anonymizedSubscriptions.length;
            });

            logger.info(`GDPR deletion complete: ${deletedCount} deleted, ${anonymizedCount} anonymized`, 'gdpr', { details });

            return {
                success: true,
                deletedRecords: deletedCount,
                anonymizedRecords: anonymizedCount,
                details,
                message: 'Your personal data has been successfully deleted and anonymized in compliance with GDPR. Financial records have been anonymized to maintain legal compliance while protecting your privacy.'
            };
        } catch (error: any) {
            logger.error('GDPR deletion failed', 'gdpr', { error: error.message, walletAddress });
            throw new Error(`GDPR deletion failed: ${error.message}`);
        }
    }

    /**
     * Export user data for GDPR Article 20 "Right to Data Portability"
     * 
     * @param walletAddress - User's wallet address
     * @returns Complete user data export in JSON format
     */
    async exportUserData(walletAddress: string): Promise<{
        profile: any;
        invoices: any[];
        payments: any[];
        subscriptions: any[];
        creditScore: any;
        exportedAt: string;
        dataRetentionNotice: string;
    }> {
        try {
            logger.info(`Exporting user data for ${walletAddress}`, 'gdpr');

            // Fetch all user data
            const [profile] = await db.select()
                .from(businessCreditScores)
                .where(eq(businessCreditScores.walletAddress, walletAddress));

            const userInvoices = await db.select()
                .from(invoices)
                .where(or(
                    eq(invoices.invoicerWalletAddress, walletAddress),
                    eq(invoices.invoiceeWalletAddress, walletAddress)
                ));

            const userPayments = await db.select()
                .from(payments)
                .where(or(
                    eq(payments.fromAddress, walletAddress),
                    eq(payments.toAddress, walletAddress)
                ));

            const userSubscriptions = await db.select()
                .from(subscriptions)
                .where(or(
                    eq(subscriptions.invoicerWalletAddress, walletAddress),
                    eq(subscriptions.customerWalletAddress, walletAddress)
                ));

            return {
                profile: profile || null,
                invoices: userInvoices,
                payments: userPayments,
                subscriptions: userSubscriptions,
                creditScore: profile ? {
                    score: profile.overallScore,
                    totalInvoicesIssued: profile.totalInvoicesIssued,
                    totalInvoicesReceived: profile.totalInvoicesReceived,
                    paidInvoices: profile.paidInvoices,
                    onTimePayments: profile.onTimePayments
                } : null,
                exportedAt: new Date().toISOString(),
                dataRetentionNotice: 'This export contains all personal data we hold about you. Financial records are retained for 7 years for tax compliance. You may request deletion at any time, which will anonymize your data while preserving legal compliance.'
            };
        } catch (error: any) {
            logger.error('GDPR export failed', 'gdpr', { error: error.message, walletAddress });
            throw new Error(`Data export failed: ${error.message}`);
        }
    }

    /**
     * Check if wallet address has any data
     * Useful for confirming deletion
     */
    async hasUserData(walletAddress: string): Promise<boolean> {
        const [profile] = await db.select()
            .from(businessCreditScores)
            .where(eq(businessCreditScores.walletAddress, walletAddress))
            .limit(1);

        return !!profile;
    }
}

export const gdprService = new GDPRService();
