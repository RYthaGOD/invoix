#!/bin/bash

# Railway Environment Variables Setup Script
# Run this after authenticating with: railway login

echo "🚀 Setting up LazorKit environment variables in Railway..."

# Set frontend variables (VITE_*)
echo "Setting frontend variables..."
railway variables set VITE_ENABLE_PASSKEY_AUTH=false
railway variables set VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com
railway variables set VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
railway variables set VITE_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com

# Set backend variables
echo "Setting backend variables..."
railway variables set LAZORKIT_PROGRAM_ID=Lazor1111111111111111111111111111111111111111

echo "✅ All LazorKit variables set!"
echo ""
echo "⚠️  IMPORTANT: Update LAZORKIT_PROGRAM_ID with the actual program ID before enabling passkey auth"
echo ""
echo "To enable passkey authentication:"
echo "  railway variables set VITE_ENABLE_PASSKEY_AUTH=true"
echo ""
echo "Triggering redeploy..."
railway up --detach

echo "✅ Done! Check Railway dashboard for deployment status."
