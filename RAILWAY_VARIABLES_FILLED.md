# Railway Environment Variables - FILLED WITH YOUR VALUES

## ✅ REQUIRED VARIABLES (15 core variables)

Copy these to Railway Dashboard → Variables:

```bash
# === DATABASE (1) ===
# Get from: Supabase Dashboard → Settings → Database → Connection Pooling
# IMPORTANT: Use port 6543 (pooler) and add ?sslmode=require
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require

# === SECURITY (2) ===
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890
NODE_ENV=production

# === SOLANA (2) ===
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# === ARCIUM ENCRYPTION (3) ===
# Your deployed Arcium MXE program ID
ARCIUM_PROGRAM_ID=MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU
# Generate with: solana-keygen new -o arcium-key.json && cat arcium-key.json
ARCIUM_PRIVATE_KEY=[123,45,67,89,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56]
ENABLE_ARCIUM_ENCRYPTION=true

# === NFT MINTING (4) ===
# Generate with: solana-keygen new -o payer-key.json && cat payer-key.json
# IMPORTANT: Fund this keypair with SOL: solana airdrop 1 <address> --url devnet
PAYER_PRIVATE_KEY=[98,76,54,32,10,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56,78,90,12,34,56]
# Get from Metaplex tree creation output
MERKLE_TREE_ADDRESS=TreeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# Get from Metaplex collection creation output  
GENESIS_COLLECTION_MINT=NFTcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ENABLE_NFT_MINTING=true

# === PLATFORM (2) ===
# Your treasury wallet for receiving 1% platform fees
PLATFORM_TREASURY_WALLET=YourTreasuryWalletAddressHere11111111111111111
X402_PAYMENT_REQUIRED=true

# === FRONTEND (1) ===
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

---

## 🏪 OPTIONAL: MARKETPLACE (2 variables)

```bash
# Your deployed marketplace program ID
MARKETPLACE_PROGRAM_ID=InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m
# Enable marketplace features
ENABLE_MARKETPLACE=true
```

---

## 🔑 OPTIONAL: LAZORKIT PASSKEY AUTH (5 variables)

```bash
# Backend - LazorKit program ID
LAZORKIT_PROGRAM_ID=LazorXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Frontend - Enable passkey auth UI
VITE_ENABLE_PASSKEY_AUTH=true
VITE_LAZORKIT_PROGRAM_ID=LazorXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com
VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
```

---

## 🛠️ HOW TO FILL IN YOUR VALUES

### 1. DATABASE_URL (from Supabase)
```bash
# Go to: https://supabase.com/dashboard/project/YOUR-PROJECT/settings/database
# Copy "Connection Pooling" string (port 6543)
# Add ?sslmode=require at the end
DATABASE_URL=postgresql://postgres.abcdefgh:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### 2. SESSION_SECRET (generate now)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output, paste as SESSION_SECRET
```

### 3. ARCIUM_PROGRAM_ID (your deployed program)
```bash
# Found in: arcium-mxe/target/idl/arcium_mxe.json
# Or from deployment output after: anchor deploy
# Your current program: MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU
ARCIUM_PROGRAM_ID=MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU
```

### 4. ARCIUM_PRIVATE_KEY (generate keypair)
```bash
# Generate new keypair
solana-keygen new --no-bip39-passphrase -o arcium-key.json

# View as array
cat arcium-key.json
# Copy the array [1,2,3,...] and paste as ARCIUM_PRIVATE_KEY
```

### 5. PAYER_PRIVATE_KEY (generate and fund)
```bash
# Generate payer keypair
solana-keygen new --no-bip39-passphrase -o payer-key.json

# Get address
solana address -k payer-key.json

# Fund with devnet SOL
solana airdrop 2 <ADDRESS-FROM-ABOVE> --url devnet

# Copy array from payer-key.json
cat payer-key.json
```

### 6. MERKLE_TREE_ADDRESS & GENESIS_COLLECTION_MINT
```bash
# If you haven't created these yet:
# Follow Metaplex docs: https://developers.metaplex.com/bubblegum

# Or use existing test values (devnet):
MERKLE_TREE_ADDRESS=11111111111111111111111111111111
GENESIS_COLLECTION_MINT=11111111111111111111111111111111
```

### 7. PLATFORM_TREASURY_WALLET
```bash
# Use your main wallet or create dedicated treasury:
solana-keygen new -o treasury.json
solana address -k treasury.json
# Copy address as PLATFORM_TREASURY_WALLET
```

### 8. MARKETPLACE_PROGRAM_ID (optional)
```bash
# Found in: marketplace-program/target/idl/invoice_marketplace.json
# Or from anchor deploy output
# Your current program: InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m
MARKETPLACE_PROGRAM_ID=InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m
```

### 9. LAZORKIT_PROGRAM_ID (optional, if using passkeys)
```bash
# Get from LazorKit documentation or contact LazorKit team
# Devnet program ID (example):
LAZORKIT_PROGRAM_ID=LazorkitABCDEF123456789ABCDEF123456789AB
```

---

## 📝 STEP-BY-STEP SETUP GUIDE

### Step 1: Set Up Supabase Database
1. Go to https://supabase.com
2. Create new project (or use existing)
3. Go to Settings → Database
4. Copy "Connection Pooling" URL
5. Add `?sslmode=require` at end
6. Save as `DATABASE_URL`

### Step 2: Generate Session Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy output → `SESSION_SECRET`

### Step 3: Generate Keypairs
```bash
# Arcium keypair
solana-keygen new -o arcium-key.json
cat arcium-key.json  # Copy array

# Payer keypair (for NFTs)
solana-keygen new -o payer-key.json
cat payer-key.json  # Copy array

# Get payer address and fund it
solana address -k payer-key.json
solana airdrop 2 <address> --url devnet
```

### Step 4: Get Program IDs
```bash
# Arcium program (already deployed)
ARCIUM_PROGRAM_ID=MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU

# Marketplace program (if deployed)
MARKETPLACE_PROGRAM_ID=InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m
```

### Step 5: Add to Railway
1. Go to Railway Dashboard
2. Select your project
3. Go to Variables tab
4. Click "+ New Variable"
5. Add each variable (name + value)
6. Click "Deploy" after adding all

---

## 🎯 ACTUAL VALUES FOR YOUR PROJECT

Based on your deployed programs:

```bash
# === YOUR DEPLOYED PROGRAMS ===
ARCIUM_PROGRAM_ID=MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU
MARKETPLACE_PROGRAM_ID=InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m

# === GENERATION COMMANDS ===
# SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ARCIUM_PRIVATE_KEY:
solana-keygen new -o arcium-key.json && cat arcium-key.json

# PAYER_PRIVATE_KEY (and fund):
solana-keygen new -o payer-key.json && cat payer-key.json
solana airdrop 2 $(solana address -k payer-key.json) --url devnet

# TREASURY WALLET:
solana-keygen new -o treasury.json
solana address -k treasury.json
```

---

## ⚠️ IMPORTANT NOTES

1. **Keep keypairs secure**: Never commit `.json` files to git
2. **Fund payer wallet**: Needs SOL for NFT minting transactions
3. **Use pooler**: DATABASE_URL must use port 6543, not 5432
4. **SSL required**: Add `?sslmode=require` to Supabase URL
5. **Generate fresh SESSION_SECRET**: Don't use example value
6. **Passkeys optional**: Set `VITE_ENABLE_PASSKEY_AUTH=false` to disable
7. **Marketplace optional**: Set `ENABLE_MARKETPLACE=false` to disable

---

## ✅ QUICK COPY-PASTE (With your program IDs)

```bash
DATABASE_URL=<YOUR_SUPABASE_URL_HERE>?sslmode=require
SESSION_SECRET=<RUN_GENERATION_COMMAND>
NODE_ENV=production
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
ARCIUM_PROGRAM_ID=MXEyfbvSXmVDtVPo3ijmYhUDneQ15hT4WGUncUctVpU
ARCIUM_PRIVATE_KEY=<RUN_GENERATION_COMMAND>
ENABLE_ARCIUM_ENCRYPTION=true
PAYER_PRIVATE_KEY=<RUN_GENERATION_COMMAND>
MERKLE_TREE_ADDRESS=<FROM_METAPLEX_SETUP>
GENESIS_COLLECTION_MINT=<FROM_METAPLEX_SETUP>
ENABLE_NFT_MINTING=true
PLATFORM_TREASURY_WALLET=<YOUR_WALLET_ADDRESS>
X402_PAYMENT_REQUIRED=true
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
MARKETPLACE_PROGRAM_ID=InvxMkt3pA3hYn8V7JbmBKZ1FjJQX9YwqG5K6Zx8uP9m
ENABLE_MARKETPLACE=false
VITE_ENABLE_PASSKEY_AUTH=false
```

**Total time to setup**: ~20 minutes  
**Difficulty**: Easy (mostly copy-paste + run commands)
