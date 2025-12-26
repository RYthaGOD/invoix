# NFT Service Setup Guide - Devnet

## Quick Setup Steps

### 1. Add Environment Variables to `.env`

Add these lines to your `.env` file:

```bash
# Solana Network Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com

# NFT Service Payer Keypair (Generated)
# Public Key: [SEE OUTPUT ABOVE]
PAYER_PRIVATE_KEY=[COPY FROM TERMINAL OUTPUT]

# Optional: Remove these to auto-create on first run
# MERKLE_TREE_ADDRESS=
# GENESIS_COLLECTION_MINT=
```

### 2. Fund the Payer Wallet

The payer wallet needs devnet SOL to create the merkle tree (~0.01 SOL minimum).

**Faucet URL:** [SEE OUTPUT ABOVE]

Or use the CLI:
```bash
solana airdrop 1 [PUBLIC_KEY] --url devnet
```

### 3. Restart the Server

Once funded, restart your dev server:
```bash
npm run dev
```

The NFT service will automatically:
- ✅ Initialize with the payer keypair
- ✅ Create a new merkle tree on devnet
- ✅ Create a genesis collection NFT
- ✅ Persist the addresses to the database

### 4. Verify Setup

Run the diagnostic script:
```bash
npx tsx scripts/diagnose-nft-service.ts
```

## What Happens on First Run

1. **Merkle Tree Creation** (~0.005 SOL)
   - Creates a compressed NFT tree
   - Supports 16,384 NFTs
   - Address saved to database

2. **Collection NFT** (~0.02 SOL)
   - Creates "INVOIX Genesis Collection"
   - Groups all NFTs for marketplace visibility
   - Address saved to database

3. **Database Persistence**
   - Merkle tree address → `system_settings` table
   - Collection mint → `system_settings` table
   - Survives server restarts

## Troubleshooting

### "Insufficient funds" Error
- Fund the payer wallet with at least 0.1 SOL for safety
- Check balance: `solana balance [PUBLIC_KEY] --url devnet`

### "NFT service not initialized"
- Check server logs for initialization errors
- Verify PAYER_PRIVATE_KEY is valid JSON array
- Ensure database connection is working

### Database Connection Issues
- The server is currently having DB connection issues
- NFT service will still initialize but won't persist merkle tree
- You'll need to set MERKLE_TREE_ADDRESS in .env manually if DB fails

## Next Steps After Setup

Once the NFT service is initialized:

1. **Test Invoice NFT Minting**
   - Create an invoice with "Mint as NFT" enabled
   - Sign the transaction in your wallet
   - Verify NFT appears in your wallet

2. **Check NFT Details**
   - View on Solana Explorer (devnet)
   - Check metadata on-chain
   - Verify compressed NFT structure

3. **Monitor Costs**
   - Compressed NFTs: ~$0.001 each
   - Standard NFTs: ~$0.02 each
   - Transfers: ~$0.0005 each
