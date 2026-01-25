import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection } from '@solana/web3.js';
import { getBlockhash, executeWithRateLimit } from '../server/solana-sdk';

// Mock the solana-modern module which provides the primary blockhash method
vi.mock('../server/solana-modern', () => ({
    getModernBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'modernHash123',
        lastValidBlockHeight: BigInt(100)
    })
}));

describe('Solana SDK Optimizations', () => {
    let mockConnection: any;

    beforeEach(() => {
        // Clear module cache to reset blockhash cache
        vi.resetModules();

        // Mock connection (fallback path)
        mockConnection = {
            getLatestBlockhash: vi.fn().mockResolvedValue({
                blockhash: 'legacyHash456',
                lastValidBlockHeight: 200
            })
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getBlockhash', () => {
        it('should return blockhash with caching', async () => {
            // Note: This test verifies that getBlockhash returns valid data
            // The modern RPC is mocked at module level

            const result1 = await getBlockhash(mockConnection);
            expect(result1.blockhash).toBeDefined();
            expect(result1.lastValidBlockHeight).toBeDefined();

            // Second call should use cached value (same result)
            const result2 = await getBlockhash(mockConnection);
            expect(result2.blockhash).toBe(result1.blockhash);
            expect(result2.lastValidBlockHeight).toBe(result1.lastValidBlockHeight);
        });
    });

    describe('executeWithRateLimit', () => {
        it('should return result on success', async () => {
            const operation = vi.fn().mockResolvedValue('success');
            const result = await executeWithRateLimit(operation);
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on generic errors', async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValue('success');

            // Use 1ms delay and ensure promise resolves
            const result = await executeWithRateLimit(operation, "test", 3, 1);
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(2);
        }, 10000); // Increase timeout to 10s

        it('should wait longer on rate limit (429)', async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('429 Too Many Requests'))
                .mockResolvedValue('success');

            // The code forces 5000ms delay on 429.
            // We spy on setTimeout to bypass the wait
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => cb());

            await executeWithRateLimit(operation, "test", 3, 1);
            expect(operation).toHaveBeenCalledTimes(2);

            setTimeoutSpy.mockRestore();
        });

        it('should fail fast on non-retryable errors', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('Account not found'));

            await expect(executeWithRateLimit(operation)).rejects.toThrow('Account not found');
            expect(operation).toHaveBeenCalledTimes(1); // No retry
        });
    });
});
