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

