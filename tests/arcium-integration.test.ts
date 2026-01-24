/**
 * Arcium MXE Integration Tests
 * 
 * Tests for on-chain Arcium MXE integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PublicKey } from '@solana/web3.js';

describe('Arcium MXE Integration', () => {
    describe('API Endpoints', () => {
        it('should return Arcium status', async () => {
            const response = await fetch('http://localhost:3000/api/arcium/status');
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('available');
            expect(data).toHaveProperty('mode');
            expect(data).toHaveProperty('programId');
            expect(data.programId).toBe('5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe');
        });

        it('should derive invoice PDA', async () => {
            const testAuthority = PublicKey.unique().toString();
            const testInvoiceId = 'TEST-INV-001';

            const response = await fetch(
                `http://localhost:3000/api/arcium/invoice-pda/${testInvoiceId}?authority=${testAuthority}`
            );

            expect(response.ok).toBe(true);
            const data = await response.json();
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
            const response1 = await fetch(
                `http://localhost:3000/api/arcium/invoice-pda/${invoiceId}?authority=${authority}`
            );
            const data1 = await response1.json();

            const response2 = await fetch(
                `http://localhost:3000/api/arcium/invoice-pda/${invoiceId}?authority=${authority}`
            );
            const data2 = await response2.json();

            // Should be identical
            expect(data1.pda).toBe(data2.pda);
        });

        it('should derive different PDAs for different invoice IDs', async () => {
            const authority = PublicKey.unique().toString();

            const response1 = await fetch(
                `http://localhost:3000/api/arcium/invoice-pda/INV-001?authority=${authority}`
            );
            const data1 = await response1.json();

            const response2 = await fetch(
                `http://localhost:3000/api/arcium/invoice-pda/INV-002?authority=${authority}`
            );
            const data2 = await response2.json();

            // Should be different
            expect(data1.pda).not.toBe(data2.pda);
        });
    });

    describe('Authorization', () => {
        it('should require authentication for transaction creation', async () => {
            const response = await fetch('http://localhost:3000/api/arcium/create-invoice-tx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: 'TEST',
                    amount: 100,
                    dueDate: new Date().toISOString(),
                    currency: 'USDC',
                    buyerWallet: PublicKey.unique().toString(),
                    authorityPublicKey: PublicKey.unique().toString(),
                }),
            });

            // Should require auth
            expect(response.status).toBe(401);
        });

        it('should require authentication for decryption', async () => {
            const response = await fetch('http://localhost:3000/api/arcium/decrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: 'TEST',
                    requestorPublicKey: PublicKey.unique().toString(),
                }),
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
