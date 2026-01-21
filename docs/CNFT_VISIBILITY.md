# cNFT Visibility Guide (Production on Devnet)

To ensure Invoice and Receipt cNFTs are visible in user wallets (Phantom, Backpack, etc.) for a production deployment running on **Devnet**, verify the following requirements.

## 1. RPC Configuration (Triton Devnet)
You are using **Triton RPC** (Devnet). Ensure your Triton endpoint supports the **Digital Asset Standard (DAS)** (Read API/Bubblegum).

*   **Requirement**: The RPC URL must support methods like `getAsset` and `getAssetProof`.
*   **Verification**: Run the included script with your Triton Devnet URL set in `.env` (`SOLANA_RPC_URL`).
    ```bash
    npx tsx scripts/verify-rpc.ts
    ```
    If successful, your Triton Devnet node is compatible.

## 2. Collection Verification (Enabled)
Code has been updated (`useCollectionVerification = true`) to ensure all cNFTs are verified members of the "Invoix Genesis Collection".
*   **Process**:
    1.  The server detects if the `GENESIS_COLLECTION_MINT` exists on Devnet.
    2.  If not, it **creates a new Collection NFT**.
    3.  **Cost**: ~0.02 SOL (Devnet SOL is free).
    4.  **Action**: Ensure your server wallet (`PAYER_PRIVATE_KEY`) has Devnet SOL. You can airdrop explicitly if needed: `solana airdrop 1 <wallet-address>` (though Triton RPCs often don't support airdrop calls directly, use the faucet website).

## 3. Merkle Tree (Devnet)
If no `MERKLE_TREE_ADDRESS` is defined:
*   **Action**: The server creates a new Merkle Tree (Depth 20).
*   **Cost**: ~1.7 to 5 SOL (Devnet SOL).
*   **Recommendation**:
    *   Ensure your wallet has >2 SOL (Devnet).
    *   If you hit rate limits or issues, you can configure a smaller tree in `nft-service.ts` (e.g., `maxDepth: 14`), but Depth 20 is standard for production-like capacity.

## 4. Metadata Accessibility (Crucial)
Wallets must reach your API to load images.
*   **API URL**: Ensure `API_URL` env var points to your publicly accessible domain (e.g., `https://dev-api.invoix.com` or your railway URL).
*   **Check**:
    1.  Mint a test invoice.
    2.  Open the Metadata URI in a browser (incognito/mobile) to verify it is reachable from outside the server's network.

## Summary Checklist

- [ ] **RPC**: `SOLANA_RPC_URL` is set to Triton Devnet URL.
- [ ] **Verification**: Ran `scripts/verify-rpc.ts`.
- [ ] **Wallet**: `PAYER_PRIVATE_KEY` has Devnet SOL (use `faucet.solana.com`).
- [ ] **Config**: `API_URL` is set to public HTTPS domain.
- [ ] **Network**: `SOLANA_NETWORK=devnet`.
