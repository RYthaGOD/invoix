# 💼 Invoix: The Hybrid B2B Settlement Layer

> **Hardened Confidential B2B Invoicing on Solana powered by Arcium v0.5.2 & Midnight Prism 3.0**

**Invoix** is an enterprise-grade settlement platform that bridges traditional business accounting with instantaneous, trustless value transfer. Featuring **industrial hardening**, military-grade privacy via Arcium, and the high-fidelity **Midnight Prism 3.0** design system.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://explorer.solana.com)
[![Arcium](https://img.shields.io/badge/Arcium-v0.5.2-green)](https://docs.arcium.com)

---

## 🌟 Key Features

### 🔐 **Tier-0 Confidentiality (Arcium v0.5.2)**
- **End-to-End Encryption**: Sensitive invoice data (amounts, line items, parties) is encrypted using `x25519` and `RescueCipher` before leaving the client.
- **On-Chain MXE**: Integrated with a custom Arcium MXE (Multi-Party Execution) program for verifiable confidential computing.
- **Access Control**: Only the Invoicer and Invoicee hold the keys to decrypt their transaction details.

### 💎 **Pearlescent Design System**
- **Mother of Pearl (Dark)**: Deep gunmetal surfaces with nacreous pink/cyan iridescence.
- **White Pearlescent (Light)**: Shimmering ice white with subtle rainbow prism effects.
- **Hardened System HUD**: Real-time transparency widget tracking Arcium MXE status, Anti-Replay Guard, and Atomic Ledger health.

### 🌟 **Interactive Onboarding**
- **Guided Tour**: Integrated `driver.js` tour to welcome users and explain key confidentiality features.
- **Devnet Ready**: Pre-configured for risk-free demonstration on Solana Devnet.

### 🛡️ **Industrial Hardening**
- **Atomic Sequential Numbering**: Prevents race conditions in invoice generation via Postgres row-level locking.
- **Global Signature Ledger**: Replay attack protection across standard payments and x402 service fees.
- **Industrial Logging**: Structured JSON logging for high-fidelity production auditability.
- **XSS Guard**: Whitelist-oriented sanitization middleware for all shared invoice views.

### 💳 **Instant Web3 Settlement**
- **Multi-Currency Support**: Settle in **USDC**, **EURC**, or **SOL**.
- **Proof-of-Payment NFTs**: Successful payments automatically mint a **Compressed NFT (cNFT)** receipt, providing an immutable on-chain record for accounting.
- **Atomic Fees**: Platform fees (1%) are settled atomically during the payment transaction, ensuring trustless revenue sharing.

### ⚡ **x402 Anti-Spam Protocol**
- Implements a mandatory micropayment (0.0001 SOL) for invoice creation.
- Protects the database from spam and DOS attacks while maintaining a low barrier to entry for businesses.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v20+)
- **Solana CLI** (v1.18+)
- **PostgreSQL** (Local or Cloud)
- **Arcium Program ID**: Deployed on Devnet.

### Installation

```bash
# Clone the repository
git clone https://github.com/RYthaGOD/invoix.git
cd invoix

# Install dependencies
npm install

# Initialize environment
cp .env.example .env
# Fill in your DATABASE_URL, ARCIUM_PROGRAM_ID, and SESSION_SECRET

# Run migrations
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
| `X402_PAYMENT_REQUIRED` | Set `true` to enable anti-spam micropayments. |

---

## 🧪 Testing & Verification

Invoix maintains a rigorous test suite (79+ tests) covering safe math, security sanitization, and lifecycle transitions.

```bash
# Run full suite
npm run test

# Verify Arcium Integration
npx ts-node scripts/verify-arcium.ts
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
- [x] **Customer Portal**: View subscriptions, billing dates, payment history
- [x] **Webhook Integration**: Enterprise ERP/Oracle connectivity
- [x] **Tax Data Export**: Annual CSV reports for 1099-K compliance

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
| Test Coverage | 98% (208/210 tests) |
| TypeScript Errors | 0 |
| API Endpoints | 45+ |
| Supported Currencies | USDC, EURC, SOL |

---

## 📄 License
Distributed under the MIT License. See `LICENSE.md` for more information.

## 🤝 Community
- **X (Twitter)**: [@InvoixSola24238](https://x.com/InvoixSola24238)
- **Community**: [Join the Invoix Community](https://x.com/i/communities/1998417251041718386)

---
*Built with ❤️ for the decentralized economy by the Invoix Team.*
