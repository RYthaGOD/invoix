# Quick Railway Setup Commands

Copy and paste these commands to set up LazorKit environment variables in Railway:

```bash
# 1. Login to Railway (if not already logged in)
railway login

# 2. Link to your project (if not already linked)  
railway link

# 3. Set all LazorKit variables at once
railway variables set \
  VITE_ENABLE_PASSKEY_AUTH=false \
  VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com \
  VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh \
  VITE_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com \
  LAZORKIT_PROGRAM_ID=Lazor1111111111111111111111111111111111111111

# 4. Redeploy to apply changes
railway up --detach
```

## Or run the automated script:
```bash
./setup-railway-lazorkit.sh
```

## Variables being set:
- ✅ VITE_ENABLE_PASSKEY_AUTH (disabled by default)
- ✅ VITE_LAZORKIT_RPC_URL  
- ✅ VITE_LAZORKIT_PORTAL_URL
- ✅ VITE_LAZORKIT_PAYMASTER_URL
- ⚠️  LAZORKIT_PROGRAM_ID (placeholder - update before enabling)

## After setup:
Your Railway deployment will have all LazorKit variables configured, but passkey auth will remain disabled until you're ready to enable it.
