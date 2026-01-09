# Railway Environment Variables Setup - LazorKit Integration

## 🚀 New Variables to Add

Add these environment variables to your Railway project for LazorKit passkey authentication:

### Frontend Variables (VITE_*)
**These are exposed to the frontend**

```bash


# LazorKit RPC endpoint for smart wallet operations
VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com

# Portal URL for WebAuthn credential management
VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh

# Paymaster URL for gasless transactions (devnet default)
VITE_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com
```

### Backend Variables
**Server-side only**

```bash
# LazorKit smart wallet program ID (for signature verification)
# IMPORTANT: Replace with actual program ID from LazorKit docs before enabling
LAZORKIT_PROGRAM_ID=Lazor1111111111111111111111111111111111111111
```

---

## 📋 How to Add Variables to Railway

### Option A: Railway Dashboard (Recommended)
1. Go to https://railway.app/dashboard
2. Select your `invoix` project
3. Click on your service (backend)
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add each variable above one by one
7. Click **Deploy** to apply changes

### Option B: Railway CLI
If you authenticate the CLI:

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Set variables

railway variables set VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com
railway variables set VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
railway variables set VITE_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com
railway variables set LAZORKIT_PROGRAM_ID=Lazor1111111111111111111111111111111111111111

# Trigger redeploy
railway up
```

---

## ⚙️ Configuration Notes

### For Testing (Devnet)


### Before Enabling Passkey Auth
1. **Update `LAZORKIT_PROGRAM_ID`**
   - Get actual program ID from LazorKit documentation
   - Current value is a placeholder

2. **Test Locally First**
   ```bash
   # In your local .env
   
   npm run dev
   # Test passkey flow thoroughly
   ```

3. **Enable in Railway**


---

## 🔒 Security Checklist

Before enabling in production:
- [ ] `LAZORKIT_PROGRAM_ID` updated with real value
- [ ] Tested passkey flow locally
- [ ] Verified signature verification works
- [ ] Tested gasless transactions via paymaster
- [ ] Monitored error logs for issues

---

## 📊 Variable Summary

| Variable | Type | Default | Required |
|----------|------|---------|----------|

| `VITE_LAZORKIT_RPC_URL` | Frontend | devnet RPC | Optional (has fallback) |
| `VITE_LAZORKIT_PORTAL_URL` | Frontend | portal.lazor.sh | Optional (has fallback) |
| `VITE_LAZORKIT_PAYMASTER_URL` | Frontend | devnet paymaster | Optional (has fallback) |
| `LAZORKIT_PROGRAM_ID` | Backend | Placeholder | **Required before enabling** |

---

## 🚨 Important Notes

1. **All variables have safe defaults** - Your app will continue working even if you don't set these

3. **No breaking changes** - Traditional wallet auth continues to work regardless
4. **Gradual rollout** - Enable in staging first, then production

---

## ✅ Post-Deployment Verification

After adding variables to Railway:

1. **Check deployment logs**
   ```bash
   railway logs
   ```

2. **Verify environment in app**
   - Navigate to your Railway URL
   - Open browser console
   - Check: `import.meta.env.VITE_LAZORKIT_RPC_URL`

3. **Test auth flow**
   - If enabled, verify passkey button appears
   - If disabled, verify traditional auth still works
