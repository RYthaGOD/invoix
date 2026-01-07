# Railway Environment Variables - Copy & Paste Ready

## ✅ REQUIRED VARIABLES (15 core variables)

```bash
# === DATABASE (1) ===
DATABASE_URL=postgresql://user:password@host.supabase.co:6543/postgres?sslmode=require

# === SECURITY (2) ===
SESSION_SECRET=<GENERATE_WITH_COMMAND_BELOW>
NODE_ENV=production

# === SOLANA (2) ===
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# === ARCIUM ENCRYPTION (3) ===
ARCIUM_PROGRAM_ID=<YOUR_ARCIUM_PROGRAM_ID>
ARCIUM_PRIVATE_KEY=[1,2,3,...]
ENABLE_ARCIUM_ENCRYPTION=true

# === NFT MINTING (4) ===
PAYER_PRIVATE_KEY=[1,2,3,...]
MERKLE_TREE_ADDRESS=<YOUR_MERKLE_TREE>
GENESIS_COLLECTION_MINT=<YOUR_COLLECTION_MINT>
ENABLE_NFT_MINTING=true

# === PLATFORM (2) ===
PLATFORM_TREASURY_WALLET=<YOUR_TREASURY_WALLET>
X402_PAYMENT_REQUIRED=true

# === FRONTEND (1) ===
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## 🏪 OPTIONAL: MARKETPLACE & RECURRING ECONOMY (3 additional variables)

```bash
# Marketplace Program (for invoice trading/factoring)
MARKETPLACE_PROGRAM_ID=<YOUR_MARKETPLACE_PROGRAM_ID>

# Enable marketplace features
ENABLE_MARKETPLACE=true

# Subscription cleanup interval (hours)
SUBSCRIPTION_CLEANUP_INTERVAL=24
```

---

## 🔑 OPTIONAL: LAZORKIT PASSKEY AUTH (5 additional variables)

```bash
# Backend
LAZORKIT_PROGRAM_ID=<LAZORKIT_PROGRAM_ID>

# Frontend
VITE_ENABLE_PASSKEY_AUTH=true
VITE_LAZORKIT_PROGRAM_ID=<SAME_AS_ABOVE>
VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com
VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
```

---

## 🛠️ QUICK COMMANDS

### Generate SESSION_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate Keypairs (for ARCIUM_PRIVATE_KEY and PAYER_PRIVATE_KEY)
```bash
solana-keygen new --no-bip39-passphrase -o key.json
cat key.json  # Copy the array [1,2,3,...]
```

### Get DATABASE_URL from Supabase
1. Go to Supabase Dashboard
2. Settings → Database → Connection Pooling
3. Copy "Connection string" (port 6543)
4. Add `?sslmode=require` at the end

---

## 📋 VARIABLE DETAILS

### DATABASE_URL
- Get from: Supabase → Database → Connection Pooling
- Format: `postgresql://user:pass@host:6543/postgres?sslmode=require`
- **Important**: Use port **6543** (pooler), not 5432

### SESSION_SECRET
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Length: 64 characters
- Keep secret!

### ARCIUM_PROGRAM_ID
- Get from: Your Arcium program deployment
- Format: Solana public key (base58)

### ARCIUM_PRIVATE_KEY & PAYER_PRIVATE_KEY
- Generate with: `solana-keygen new`
- Format: Array of 64 numbers `[1,2,3,...]`
- Fund PAYER_PRIVATE_KEY with SOL for NFT minting

### MERKLE_TREE_ADDRESS & GENESIS_COLLECTION_MINT
- Get from: Metaplex collection/tree creation
- Format: Solana public keys (base58)

### PLATFORM_TREASURY_WALLET
- Your wallet address for receiving platform fees
- Format: Solana public key (base58)

### LAZORKIT_PROGRAM_ID
- Get from: LazorKit documentation
- Format: Solana public key (base58)
- **Optional**: Only if using passkey auth

---

## ⚡ MINIMAL SETUP (No Arcium, No NFTs, No Passkeys)

If you want to start with basic features only:

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=<generate>
NODE_ENV=production
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_TREASURY_WALLET=<your-wallet>
X402_PAYMENT_REQUIRED=true
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com

# Set these to false to disable features
ENABLE_ARCIUM_ENCRYPTION=false
ENABLE_NFT_MINTING=false
VITE_ENABLE_PASSKEY_AUTH=false
```

---

## 📊 VARIABLE COUNT SUMMARY

**Minimal setup**: 8 variables  
**Full setup (no passkeys, no marketplace)**: 15 variables  
**Full setup (with passkeys)**: 20 variables  
**Full setup (with passkeys + marketplace)**: 23 variables

---

## 🚀 HOW TO ADD TO RAILWAY

### Method 1: Dashboard (Easiest)
1. Go to Railway → Your Project → Variables
2. Click "+ New Variable"
3. Copy each variable name and value
4. Click "Add"
5. Redeploy

### Method 2: Railway CLI
```bash
railway login
railway link
railway variables set DATABASE_URL="postgresql://..."
railway variables set SESSION_SECRET="<hex>"
# ... add all variables
railway up
```

---

## ✅ CHECKLIST

Before deploying, verify you have:

- [ ] DATABASE_URL (from Supabase)
- [ ] SESSION_SECRET (generated)
- [ ] SOLANA_RPC_URL (set to devnet or mainnet)
- [ ] ARCIUM_PROGRAM_ID (if using encryption)
- [ ] ARCIUM_PRIVATE_KEY (if using encryption)
- [ ] PAYER_PRIVATE_KEY (if using NFTs, and funded with SOL)
- [ ] MERKLE_TREE_ADDRESS (if using NFTs)
- [ ] GENESIS_COLLECTION_MINT (if using NFTs)
- [ ] PLATFORM_TREASURY_WALLET (your treasury)
- [ ] X402_PAYMENT_REQUIRED (set to true)
- [ ] VITE_SOLANA_RPC_URL (frontend RPC)
- [ ] LAZORKIT_PROGRAM_ID (if using passkeys)
- [ ] VITE_ENABLE_PASSKEY_AUTH (if using passkeys)
- [ ] MARKETPLACE_PROGRAM_ID (if enabling marketplace)
- [ ] ENABLE_MARKETPLACE (if enabling marketplace)

---

## 🆘 TROUBLESHOOTING

**Database won't connect**:
- Verify port 6543 (not 5432)
- Add `?sslmode=require` to end of URL
- Check Supabase project is active

**NFT minting fails**:
- Fund PAYER_PRIVATE_KEY with SOL: `solana airdrop 1 <address> --url devnet`
- Verify MERKLE_TREE_ADDRESS exists on-chain

**Passkey auth doesn't show**:
- Verify `VITE_ENABLE_PASSKEY_AUTH=true`
- Check LAZORKIT_PROGRAM_ID is correct
- Redeploy after adding variables

---

## 🔒 SECURITY NOTES

- ✅ Never commit `.env` to GitHub
- ✅ Use different keys for dev/production
- ✅ Rotate SESSION_SECRET monthly
- ✅ Keep private keys only in Railway
- ✅ Use hardware wallet for treasury
- ✅ Enable 2FA on Railway

---

**Total Time to Setup**: ~15 minutes  
**Difficulty**: Easy (copy-paste + generate keys)

For full details, see the complete guide in the artifact browser.
