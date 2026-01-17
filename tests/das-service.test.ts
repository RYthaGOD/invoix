
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dasService } from '../server/das-service';
import axios from 'axios';

vi.mock('axios');

describe('DAS Service Caching', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should cache getAsset calls for the same assetId', async () => {
        const mockResult = { id: 'asset1', metadata: {} };
        (axios.post as any).mockResolvedValue({
            data: { result: mockResult }
        });

        // First call - should hit RPC
        const result1 = await dasService.getAsset('asset1');
        expect(result1).toEqual(mockResult);
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Second call immediately after - should hit cache
        const result2 = await dasService.getAsset('asset1');
        expect(result2).toEqual(mockResult);
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Different asset ID - should hit RPC
        (axios.post as any).mockResolvedValueOnce({
            data: { result: { id: 'asset2' } }
        });
        await dasService.getAsset('asset2');
        expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after 5 seconds', async () => {
        vi.setSystemTime(new Date(2025, 0, 1, 10, 0, 0));
        const uniqueId = 'asset-expiry-test-1';
        const mockResult = { id: uniqueId, metadata: {} };
        (axios.post as any).mockResolvedValue({
            data: { result: mockResult }
        });

        // First call
        await dasService.getAsset(uniqueId);
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Advance time by 6 seconds
        vi.setSystemTime(new Date(2025, 0, 1, 10, 0, 6));

        // Second call - should hit RPC again
        await dasService.getAsset(uniqueId);
        expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should cache getAssetProof calls', async () => {
        const mockProof = { root: 'root', proof: [], node_index: 0, leaf: 'leaf', tree_id: 'tree' };
        (axios.post as any).mockResolvedValue({
            data: { result: mockProof }
        });

        // First call
        const result1 = await dasService.getAssetProof('asset1');
        expect(result1).toEqual(mockProof);
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Second call - cached
        const result2 = await dasService.getAssetProof('asset1');
        expect(result2).toEqual(mockProof);
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
});
