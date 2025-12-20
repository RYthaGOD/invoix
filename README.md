# 💼 Invoix: The Hybrid B2B Settlement Layer

> **Confidential B2B Invoicing on Solana powered by Arcium v0.5.2**

**Invoix** is a next-generation invoicing and settlement platform that bridges traditional business accounting with instantaneous, trustless value transfer. By treating **Invoices as Smart Assets**, Invoix enables instant cash flow, automated reconciliation, and military-grade privacy.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://explorer.solana.com)
[![Arcium](https://img.shields.io/badge/Arcium-v0.5.2-green)](https://docs.arcium.com)

---

## 🌟 Key Features

### 🔐 **Tier-0 Confidentiality (Arcium v0.5.2)**
- **End-to-End Encryption**: Sensitive invoice data (amounts, line items, parties) is encrypted using `x25519` and `RescueCipher` before leaving the client.
- **On-Chain MXE**: Integrated with a custom Arcium MXE (Multi-Party Execution) program for verifiable confidential computing.
- **Access Control**: Only the Invoicer and Invoicee hold the keys to decrypt their transaction details.

### 💳 **Instant Web3 Settlement**
- **Multi-Currency Support**: Settle in **USDC**, **EURC**, or **SOL**.
- **Proof-of-Payment NFTs**: Successful payments automatically mint a **Compressed NFT (cNFT)** receipt, providing an immutable on-chain record for accounting.
- **Atomic Fees**: Platform fees (1%) are settled atomically during the payment transaction, ensuring trustless revenue sharing.

### ⚡ **x402 Anti-Spam Protocol**
- Implements a mandatory micropayment (0.0001 SOL) for invoice creation.
- Protects the database from spam and DOS attacks while maintaining a low barrier to entry for businesses.

### 📊 **Enterprise-Grade Tooling**
- **Business Profiles**: Establish on-chain identity and verified business credentials.
- **Flexible Templates**: Automate professional invoicing with customizable prefixes and tax rules.
- **Real-Time Dashboards**: Powered by WebSockets for instant global trade statistics and payment status updates.

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

## 🗺️ Future Roadmap

### Phase 1: Institutional Privacy 🟢
- [x] Arcium v0.5.2 Integration
- [x] Custom MXE Account PDA support
- [x] Tier-0 encrypted invoice lifecycle

### Phase 2: Recurring Economy 🟡
- [ ] **Subscription Streams**: Automated recurring billing using Solana Token Extensions.
- [ ] **Conditional Invoices**: Payments unlocked only upon verifiable delivery milestones.

### Phase 3: Tradeable Debt 🔴
- [ ] **Invoice Financing (Factoring)**: Tokenize unpaid invoices as tradeable RWA (Real World Asset) NFTs.
- [ ] **Liquidity Pools**: Businesses can borrow against their accounts receivable in a decentralized marketplace.

---

## 📄 License
Distributed under the MIT License. See `LICENSE.md` for more information.

## 🤝 Support
- **X Community**: [Join our community](https://x.com/i/communities/1998417251041718386)
- **X**: [@InvoixApp](https://x.com/InvoixSola24238)

---
*Built with ❤️ for the decentralized economy by the Invoix Team.*
