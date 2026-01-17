import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection } from '@solana/web3.js';
import { getBlockhash, executeWithRateLimit } from '../server/solana-sdk';

describe('Solana SDK Optimizations', () => {
    let mockConnection: any;

    beforeEach(() => {
        // Mock connection
        mockConnection = {
            getLatestBlockhash: vi.fn().mockResolvedValue({
                blockhash: 'hash1',
                lastValidBlockHeight: 100
            })
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getBlockhash', () => {
        it('should cache blockhash for 30 seconds', async () => {
            vi.useFakeTimers();

            // First call - should hit RPC
            const result1 = await getBlockhash(mockConnection);
            expect(result1.blockhash).toBe('hash1');
            expect(mockConnection.getLatestBlockhash).toHaveBeenCalledTimes(1);

            // Second call immediately - should use cache
            const result2 = await getBlockhash(mockConnection);
            expect(result2.blockhash).toBe('hash1');
            expect(mockConnection.getLatestBlockhash).toHaveBeenCalledTimes(1);

            // Advance time by 29s - still cache
            vi.advanceTimersByTime(29000);
            await getBlockhash(mockConnection);
            expect(mockConnection.getLatestBlockhash).toHaveBeenCalledTimes(1);

            // Advance time past 30s - should refresh
            vi.advanceTimersByTime(2000); // Total 31s

            // Hack: We need to reset the mock implementation to return a new hash for clarity
            mockConnection.getLatestBlockhash.mockResolvedValue({
                blockhash: 'hash2',
                lastValidBlockHeight: 200
            });

            const result3 = await getBlockhash(mockConnection);
            expect(result3.blockhash).toBe('hash2');
            expect(mockConnection.getLatestBlockhash).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
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

            // Use 1ms delay
            const result = await executeWithRateLimit(operation, "test", 3, 1);
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(2);
        });

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
