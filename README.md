# 💼 Invoix: The Hybrid B2B Settlement Layer

> **Hardened Confidential B2B Invoicing on Solana powered by Arcium v0.5.2 & Midnight Prism 3.0**

**Invoix** is an enterprise-grade settlement platform that bridges traditional business accounting with instantaneous, trustless value transfer. Featuring **industrial hardening**, military-grade privacy via Arcium, and the high-fidelity **Midnight Prism 3.0** design system.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://explorer.solana.com)
[![Arcium](https://img.shields.io/badge/Arcium-v0.5.2-green)](https://docs.arcium.com)
[![LazorKit](https://img.shields.io/badge/LazorKit-v2.0-blue)](https://lazor.sh)

---

## 🌟 Key Features

### 🔑 **Smart Wallet Authentication (LazorKit)**
- **Biometric Login**: Seamless sign-in using FaceID/TouchID via Passkeys.
- **Gasless Transactions**: Enterprise users enjoy sponsored transactions via the LazorKit Paymaster.
- **Smart Accounts**: Programmable wallets enabling multi-signature approvals and recovery.
- **Default Enabled**: All users have access to secure, non-custodial smart wallets out of the box.

### 🔐 **Tier-0 Confidentiality (Arcium v0.5.2)**
- **End-to-End Encryption**: Sensitive invoice data (amounts, line items, parties) is encrypted using `x25519` and `RescueCipher` before leaving the client.
- **On-Chain MXE**: Integrated with a custom Arcium MXE (Multi-Party Execution) program for verifiable confidential computing.
- **Access Control**: Only the Invoicer and Invoicee hold the keys to decrypt their transaction details.

### 💎 **Pearlescent Design System**
- **Mother of Pearl (Dark)**: Deep gunmetal surfaces with nacreous pink/cyan iridescence.
- **White Pearlescent (Light)**: Shimmering ice white with subtle rainbow prism effects.
- **Hardened System HUD**: Real-time transparency widget tracking Arcium MXE status, Anti-Replay Guard, and Atomic Ledger health.

### 💳 **Instant Web3 Settlement**
- **Multi-Currency Support**: Settle in **USDC**, **EURC**, or **SOL**.
- **Proof-of-Payment NFTs**: Successful payments automatically mint a **Compressed NFT (cNFT)** receipt, providing an immutable on-chain record for accounting.
- **Atomic Fees**: Platform fees (1%) are settled atomically during the payment transaction, ensuring trustless revenue sharing.

### ⚡ **x402 Anti-Spam Protocol**
- Implements a mandatory micropayment (0.0001 SOL) for invoice creation.
- Protects the database from spam and DOS attacks while maintaining a low barrier to entry for businesses.

### 🔄 **Recurring Economy**
- **Subscription Management**: Full recurring billing engine with automated invoice generation.
- **Credit Scoring**: On-chain reputation system tracking payment reliability and volume.
- **Marketplace**: Buy and sell outstanding invoices to unlock immediate liquidity.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v20+)
- **Solana CLI** (v1.18+)
- **PostgreSQL** (Local or Cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/RYthaGOD/invoix.git
cd invoix

# Install dependencies
npm install

# Initialize environment
cp .env.example .env
# Fill in your DATABASE_URL and ARCIUM_PROGRAM_ID

# Run migrations (Postgres) or Generate Schema (SQLite)
npm run db:push

# Start development server
npm run dev
```

### Environment Configuration
| Variable | Description |
| :--- | :--- |
| `ARCIUM_PROGRAM_ID` | Your deployed Arcium MXE program. |
| `ENABLE_ARCIUM_ENCRYPTION` | Set to `true` to enable TEE-based confidentiality. |
| `DATABASE_URL` | PostgreSQL connection string (supports IPv4 auto-resolution). |
| `VITE_LAZORKIT_RPC_URL` | Custom RPC endpoint for LazorKit operations. |

---

## 🧪 Testing & Verification

Invoix maintains a rigorous test suite covering safe math, security sanitization, and lifecycle transitions.

```bash
# Run full suite (31+ Test Suites)
npm run test
```

---

## 🗺️ Roadmap

### Phase 1: Institutional Privacy ✅ Complete
- [x] Arcium v0.5.2 Integration
- [x] Custom MXE Account PDA support
- [x] Tier-0 encrypted invoice lifecycle
- [x] **Perfection Phase Hardening** (Atomic Integrity, Replay Protection, XSS Guard)
- [x] **Midnight Prism 3.0** UI/UX Overhaul

### Phase 2: Recurring Economy ✅ Complete
- [x] **Subscription Management**: Full recurring billing with automated invoicing
- [x] **Subscription Plans**: Create/manage billing cycles with on-chain tracking
- [x] **LazorKit Integration**: Passkey authentication by default
- [x] **Webhook Integration**: Enterprise ERP/Oracle connectivity

### Phase 3: Capital Markets ✅ Complete
- [x] **Invoice Marketplace**: Buy/sell invoices with transparent pricing
- [x] **Credit Scoring**: On-chain payment history reputation system
- [x] **Marketplace SDK**: Full client-side integration library
- [x] **Escrow Program**: Smart contract for secure invoice trading (Anchor)

### Phase 4: Enterprise Expansion 🟡 In Progress
- [ ] **Multi-Signature Approvals**: Corporate invoice workflows
- [ ] **Batch Processing**: Bulk invoice creation and payment
- [ ] **White-Label**: Custom branding for enterprise clients
- [ ] **Liquidity Pools**: DeFi integration for invoice financing

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Test Suites | 31+ Passed |
| Build Status | ✅ Verified |
| TypeScript Errors | 0 |
| API Endpoints | 50+ |
| Supported Currencies | USDC, EURC, SOL |

---

## 📄 License
Distributed under the MIT License. See `LICENSE.md` for more information.

## 🤝 Community
- **X (Twitter)**: [@Invoix_solana]
- **Community**: [Join the Invoix Community](https://x.com/i/communities/1998417251041718386)

---
*Built with ❤️ for the decentralized economy by the Invoix Team.*
