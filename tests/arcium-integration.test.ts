/**
 * Arcium MXE Integration Tests
 * 
 * Tests for on-chain Arcium MXE integration
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup-integration';
import { PublicKey } from '@solana/web3.js';

describe('Arcium MXE Integration', () => {
    describe('API Endpoints', () => {
        it('should return Arcium status', async () => {
            const response = await request(app).get('/api/arcium/status');
            expect(response.status).toBe(200);

            const data = response.body;
            expect(data).toHaveProperty('available');
            expect(data).toHaveProperty('mode');
            expect(data).toHaveProperty('programId');
            // Allow for env variable override or default
            expect(typeof data.programId).toBe('string');
        });

        it('should derive invoice PDA', async () => {
            const testAuthority = PublicKey.unique().toString();
            const testInvoiceId = 'TEST-INV-001';

            const response = await request(app)
                .get(`/api/arcium/invoice-pda/${testInvoiceId}`)
                .query({ authority: testAuthority });

            expect(response.status).toBe(200);
            const data = response.body;
            expect(data).toHaveProperty('pda');
            expect(data.pda).toBeTruthy();
            expect(data.invoiceId).toBe(testInvoiceId);
        });
    });

    describe('PDA Derivation', () => {
        it('should derive consistent PDAs', async () => {
            const authority = PublicKey.unique().toString();
            const invoiceId = 'CONSISTENT-TEST';

            // Call twice
            const response1 = await request(app)
                .get(`/api/arcium/invoice-pda/${invoiceId}`)
                .query({ authority });
            const data1 = response1.body;

            const response2 = await request(app)
                .get(`/api/arcium/invoice-pda/${invoiceId}`)
                .query({ authority });
            const data2 = response2.body;

            // Should be identical
            expect(data1.pda).toBe(data2.pda);
        });

        it('should derive different PDAs for different invoice IDs', async () => {
            const authority = PublicKey.unique().toString();

            const response1 = await request(app)
                .get('/api/arcium/invoice-pda/INV-001')
                .query({ authority });
            const data1 = response1.body;

            const response2 = await request(app)
                .get('/api/arcium/invoice-pda/INV-002')
                .query({ authority });
            const data2 = response2.body;

            // Should be different
            expect(data1.pda).not.toBe(data2.pda);
        });
    });

    describe('Authorization', () => {
        it('should require authentication for transaction creation', async () => {
            const response = await request(app)
                .post('/api/arcium/create-invoice-tx')
                .send({
                    invoiceId: 'TEST',
                    amount: 100,
                    dueDate: new Date().toISOString(),
                    currency: 'USDC',
                    buyerWallet: PublicKey.unique().toString(),
                    authorityPublicKey: PublicKey.unique().toString(),
                });

            // Should require auth
            expect(response.status).toBe(401);
        });

        it('should require authentication for decryption', async () => {
            const response = await request(app)
                .post('/api/arcium/decrypt')
                .send({
                    invoiceId: 'TEST',
                    requestorPublicKey: PublicKey.unique().toString(),
                });

            // Should require auth
            expect(response.status).toBe(401);
        });
    });
});

describe('Client-Side Integration', () => {
    it('should export useArciumClient hook', async () => {
        const module = await import('../client/src/lib/arcium-client');
        expect(module.useArciumClient).toBeDefined();
        expect(typeof module.useArciumClient).toBe('function');
    });

    it('should export useCreateInvoiceWithArcium hook', async () => {
        const module = await import('../client/src/lib/arcium-client');
        expect(module.useCreateInvoiceWithArcium).toBeDefined();
        expect(typeof module.useCreateInvoiceWithArcium).toBe('function');
    });
});

describe('Security Hardening', () => {
    describe('Input Validation', () => {
        it('should validate encryption input parameters', async () => {
            const { getArciumService, initializeArciumService } = await import('../server/arcium-service');
            await initializeArciumService();
            const service = getArciumService();

            // Test with null transaction data
            const result1 = await service.encryptTransaction(null as any, []);
            expect(result1.success).toBe(false);
            expect(result1.error).toContain('Invalid transaction data');

            // Test with missing required fields
            const result2 = await service.encryptTransaction(
                { amount: '', fromAddress: '', toAddress: '', txSignature: '', timestamp: 0, tokenAmount: '', items: [] },
                []
            );
            expect(result2.success).toBe(false);
            expect(result2.error).toContain('Missing required fields');

            // Test with invalid Solana address
            const result3 = await service.encryptTransaction(
                {
                    amount: '100',
                    tokenAmount: '100000000',
                    fromAddress: 'invalid-address',
                    toAddress: PublicKey.unique().toString(),
                    txSignature: 'test',
                    timestamp: Date.now(),
                    items: []
                },
                [PublicKey.unique().toString(), PublicKey.unique().toString()]
            );
            expect(result3.success).toBe(false);
            expect(result3.error).toContain('Invalid fromAddress');

            // Test with insufficient allowed parties
            const result4 = await service.encryptTransaction(
                {
                    amount: '100',
                    tokenAmount: '100000000',
                    fromAddress: PublicKey.unique().toString(),
                    toAddress: PublicKey.unique().toString(),
                    txSignature: 'test',
                    timestamp: Date.now(),
                    items: []
                },
                [PublicKey.unique().toString()] // Only 1 party
            );
            expect(result4.success).toBe(false);
            expect(result4.error).toContain('at least 2 parties');
        });

        it('should validate allowed party addresses', async () => {
            const { getArciumService, initializeArciumService } = await import('../server/arcium-service');
            await initializeArciumService();
            const service = getArciumService();

            const result = await service.encryptTransaction(
                {
                    amount: '100',
                    tokenAmount: '100000000',
                    fromAddress: PublicKey.unique().toString(),
                    toAddress: PublicKey.unique().toString(),
                    txSignature: 'test',
                    timestamp: Date.now(),
                    items: []
                },
                [PublicKey.unique().toString(), 'invalid-party-address']
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid party address');
        });
    });

    describe('Status Endpoint Enhancement', () => {
        it('should include programDeployed in status response', async () => {
            const response = await request(app).get('/api/arcium/status');
            expect(response.status).toBe(200);

            const data = response.body;
            expect(data).toHaveProperty('programDeployed');
            expect(typeof data.programDeployed).toBe('boolean');
        });

        it('should include serverPublicKey in status response when available', async () => {
            const response = await request(app).get('/api/arcium/status');
            expect(response.status).toBe(200);

            const data = response.body;
            expect(data).toHaveProperty('serverPublicKey');
            // May be null if service not initialized
            if (data.available) {
                expect(typeof data.serverPublicKey).toBe('string');
            }
        });

        it('should include lastHealthCheck timestamp in status response', async () => {
            const response = await request(app).get('/api/arcium/status');
            expect(response.status).toBe(200);

            const data = response.body;
            expect(data).toHaveProperty('lastHealthCheck');
            // Should be a valid ISO date string
            const date = new Date(data.lastHealthCheck);
            expect(date.toString()).not.toBe('Invalid Date');
        });
    });

    describe('Program Verification', () => {
        it('should verify program deployment caching', async () => {
            const { getArciumOnChainService } = await import('../server/arcium-onchain-service');
            const service = getArciumOnChainService();

            // Clear cache first
            service.clearVerificationCache();

            // First call - should hit the network
            const result1 = await service.verifyProgramDeployed();

            // Second call - should use cache
            const result2 = await service.verifyProgramDeployed();

            // Results should be consistent
            expect(result1).toBe(result2);
        });
    });
});

describe('SDK-Only Fallback', () => {
    it('should return sdk-only mode when program not configured', async () => {
        // This test depends on environment config
        // When ARCIUM_PROGRAM_ID is not set or program is not deployed,
        // the status should indicate sdk-only mode
        const response = await request(app).get('/api/arcium/status');
        expect(response.status).toBe(200);

        const data = response.body;
        // Mode should be either 'sdk-only' or 'on-chain'
        expect(['sdk-only', 'on-chain']).toContain(data.mode);

        // If programDeployed is false, mode should be sdk-only
        if (!data.programDeployed) {
            expect(data.mode).toBe('sdk-only');
        }
    });
});

