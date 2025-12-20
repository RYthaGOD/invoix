# 🔒 Arcium MXE Deployment Manual (WSL Edition)

Since the `arcium` CLI requires a Linux environment, you must use **WSL2 (Windows Subsystem for Linux)** to build and deploy your confidential computing environment.

## Phase 1: Setup WSL Environment

**Open your WSL Terminal (Ubuntu)** and run the following commands to install the necessary tools.

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version
```

### 2. Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"
export PATH="/home/$(whoami)/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### 3. Install Arcium CLI
Use the official installation script (or Cargo if preferred):
```bash
cargo install arcium-cli
# Verify installation
arcium --version
```

### 4. Setup Wallet in WSL
You need a Solana wallet inside WSL. You can generate a new one or copy your keypair.
```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com
solana airdrop 2
```

## Phase 2: Build & Deploy

Navigate to your project folder inside WSL.
*Note: Your Windows files are mounted at `/mnt/c/Users/...`*

```bash
# Example path - adjust to your actual username/path
cd /mnt/c/Users/craig/OneDrive/Desktop/B2B\ solana/arcium-mxe
```

### 1. Build the MXE
```bash
arcium build
```

### 2. Deploy to Devnet
```bash
arcium deploy --cluster devnet
```

**⚠️ IMPORTANT:** Copy the **Program ID** output by this command!

## Phase 3: Integrate with Windows App

Return to your **Windows VS Code** environment.

1.  Open `.env` in the project root.
2.  Update the following variable with your new Program ID:
    ```env
    ARCIUM_PROGRAM_ID=Your_New_Program_ID_Here
    ENABLE_ARCIUM_ENCRYPTION=true
    ```
3.  Open `arcium-mxe/Arcium.toml` (if you want to persist it) and update the `arcium_mxe` field under `[programs.devnet]`.

## Phase 4: Verification

Run the verification script from **Windows**:
```bash
npm run dev
# Then checking the server logs or running the script:
npx ts-node scripts/verify-arcium.ts
```
