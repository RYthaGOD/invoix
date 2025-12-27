# Production Deployment Guide - NFT Service on Devnet

> **Updated:** December 2025 | **NFT Engine:** 8K Premium 3D (Midnight Prism)

## Current Production Status

✅ **Network**: Devnet  
✅ **Payer Wallet Balance**: 5 SOL  
✅ **Code**: Pushed to GitHub (commit 0eb8a41)
✅ **NFT Visuals**: 8K Premium 3D Glass & Holographic Trading Cards

## Visual Architecture

| NFT Type | Endpoint | Visual Style |
|----------|----------|--------------|
| Invoice | `/api/images/dynamic-nft/invoice-3d/:id.svg` | 8K Glass Card with Midnight Prism gradients |
| Receipt | `/api/images/dynamic-nft/invoice-3d/receipt-:id.svg` | Same engine with PAID stamp overlay |
| Community Drop | `/api/images/dynamic-nft/community-3d/:id.svg` | 8K Holographic Trading Card |
| Private Invoice | Auto-detected | 3D Lock with "Arcium TEE Encrypted" |

## Production Environment Variables

Add these to your production environment (Railway/Vercel/etc.):

```bash
# Solana Network
SOLANA_RPC_URL=https://api.devnet.solana.com

# NFT Service Payer Keypair
# Use the PAYER_PRIVATE_KEY from your production .env
# Format: [1,2,3,4,5,...]
PAYER_PRIVATE_KEY=[your_production_keypair_array]

# Optional: Pre-existing Merkle Tree (if you have one)
# MERKLE_TREE_ADDRESS=<your_existing_tree_address>

# Optional: Pre-existing Collection NFT
# GENESIS_COLLECTION_MINT=<your_existing_collection_address>
```

## Deployment Steps

### 1. Update Environment Variables

In your production platform (Railway):

1. Go to your project settings
2. Add/update environment variables:
   - `SOLANA_RPC_URL=https://api.devnet.solana.com`
   - `PAYER_PRIVATE_KEY=<your_production_keypair>`
3. Save changes

### 2. Deploy Latest Code

The code is already pushed to GitHub. Your platform should auto-deploy, or:

```bash
# Trigger manual deployment if needed
git push origin main
```

### 3. Monitor Deployment Logs

Watch for these initialization messages:

```
✅ [BOOT] Listening on port 5000
🎨 Creating Merkle Tree... (if first time)
✅ Created merkle tree: <ADDRESS>
✅ Created Collection NFT: <ADDRESS>
💾 Persisted Merkle Tree to DB
✅ Invoice NFT service initialized
🚀 [READY] Invoix Platform is fully operational!
```

### 4. Verify NFT Service

After deployment:

```bash
# Check if service is ready
curl https://your-production-url.com/health

# Should return: {"status":"ok"}
```

## First-Time Initialization

If this is the first deployment with NFT service:

1. **Merkle Tree Creation** (~0.005 SOL)
   - Automatically created on first startup
   - Address saved to database
   - Supports 16,384 compressed NFTs

2. **Collection NFT** (~0.02 SOL)
   - "INVOIX Genesis Collection" created
   - Groups all NFTs for marketplace visibility
   - Address saved to database

3. **Total Cost**: ~0.025 SOL (one-time)

## Subsequent Deployments

On future deployments:

- Merkle tree address loaded from database
- Collection NFT address loaded from database
- No additional SOL spent
- Service initializes instantly

## Testing NFT Minting in Production

### 1. Create Test Invoice

1. Navigate to production URL
2. Create invoice with "Mint as NFT" enabled
3. Submit invoice

### 2. Verify Transaction Flow

1. User signs service fee (0.0001 SOL)
2. User signs NFT minting transaction
3. NFT appears in user's wallet

### 3. Check on Solana Explorer

View NFT on devnet:
```
https://explorer.solana.com/address/<NFT_MINT_ADDRESS>?cluster=devnet
```

## Monitoring

### Check Payer Wallet Balance

```bash
# View on explorer
https://explorer.solana.com/address/<PAYER_PUBLIC_KEY>?cluster=devnet
```

### Expected SOL Usage

- **Merkle Tree**: 0.005 SOL (one-time)
- **Collection NFT**: 0.02 SOL (one-time)
- **Per Invoice NFT**: ~0.001 SOL (compressed)
- **Per Payment Receipt**: ~0.001 SOL (compressed)

With 5 SOL, you can mint approximately **4,900+ NFTs** before needing to refill.

## Troubleshooting

### "NFT service not initialized"

**Check**:
1. `PAYER_PRIVATE_KEY` is set correctly
2. `SOLANA_RPC_URL` points to devnet
3. Payer wallet has sufficient balance
4. Database connection is working

**Solution**: Check deployment logs for initialization errors

### "Insufficient funds" Error

**Check**: Payer wallet balance on devnet explorer

**Solution**: Add more devnet SOL to payer wallet

### Merkle Tree Not Persisting

**Symptom**: New merkle tree created on each deployment

**Cause**: Database connection issues

**Solution**: 
1. Verify `DATABASE_URL` is correct
2. Check database is accessible from production
3. Manually set `MERKLE_TREE_ADDRESS` in environment variables

## Summary

✅ **Ready for Production**:
- Code pushed to GitHub
- NFT service configured for devnet
- Payer wallet funded with 5 SOL
- Automatic initialization on deployment

🎯 **Next Steps**:
1. Update production environment variables
2. Deploy/redeploy application
3. Monitor logs for successful initialization
4. Test NFT minting with a sample invoice

📊 **Capacity**:
- Current balance: 5 SOL
- Can mint: ~4,900 NFTs
- Sufficient for initial production testing
