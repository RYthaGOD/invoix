# Solana B2B Invoicing Protocol Overview (Devnet v1.0)

> **Current Status**: Active on Devnet
> **Version**: 1.0.0
> **Privacy Layer**: Arcium v0.5.2 MXE

## 1. Core Concept
The **Solana B2B Invoicing System** is a production-hardened settlement layer that enables businesses to send and settle invoices on-chain using stablecoins (USDC/EURC) and SOL. It prioritizes **industrial confidentiality** via Arcium MXE and high-velocity settlement on Solana.

## 2. Key Technologies

### 🔐 Privacy Layer: Arcium v0.5.2 (MXE)
- **Status**: Primary encryption layer.
- **Confidential Computing**: Uses Arcium's Multi-Party Execution (MXE) to process sensitive invoice details (line items, pricing) in a secure, verifiable environment.
- **Client-Side Hardening**: All data is encrypted with `x25519` and `RescueCipher` before network transmission.
- **Access Control**: TEE (Trusted Execution Environment) enforced access—only authorized wallet holders can decrypt their specific invoices.

### 💰 Settlement Layer: Solana & SPL Tokens
- **Role**: High-speed value transfer.
- **Support**: Native SOL, USDC (SPL), and EURC.
- **Verification**: Atomic on-chain verification of transaction signatures ensures 100% finality before ledger updates.

### 📄 Invoicing Logic: Atomic Ledger
- **Storage**: Hybrid, industrial-hardened storage.
    - **Public Metadata**: (Timestamps, Status) stored in indexed PostgreSQL.
    - **Confidential Data**: (Line Items, Total Value) stored as Arcium-encrypted blobs.
- **Integrity**: Anti-replay guards and sequential numbering prevent financial double-counting.

### 🖼️ Tokenization: cNFT Receipts
- **Automatic Minting**: Successful payments trigger an automatic **Compressed NFT (cNFT)** receipt.
- **Accounting**: Provides an immutable, tax-verifiable record of payment on the Solana ledger.

## 3. The Invoice Lifecycle

1.  **Draft & Encrypt**: Business creates invoice; sensitive data is encrypted using Arcium keys.
2.  **Storage**: Encrypted payload is pushed to the secure ledger.
3.  **Delivery**: Secure link or dashboard notification is sent to the customer.
4.  **Auth (SIWS)**: Customer authenticates via **Sign In With Solana**.
5.  **Decryption**: API interacts with Arcium MXE to verify authorization and decrypt data for the specific viewer.
6.  **Settlement**: Customer signs transfer; transaction is verified atomically by the Invoix backend.
7.  **Receipt**: System automatically mints a Proof-of-Payment cNFT to the customer's wallet.

## 4. Current Architecture Details

### Privacy Model (Tier-0)
- **Public**: No sensitive data is ever exposed on-chain or in public APIs.
- **Database Admins**: Cannot view details due to Arcium encryption-at-rest.

### Security Hardening
- **XSS Guard**: Whitelist sanitization for all user-generated content.
- **Atomic Locking**: Postgres row-level locking ensures no race conditions during settlement.
- **Global Signature Ledger**: Tracks all transaction signatures to prevent replay attacks across services.

### Spam Prevention
- **Current**: Strictly enforced Rate Limiting (API Gateway).
- **Planned**: **x402 Protocol** (Micropayments) is designed but currently **disabled** in production to lower barrier to entry for early users.

### API Security
- **Authentication**: SIWS (Sign In With Solana) standard.
- **Session**: Secure, HTTP-only cookies.
- **Validation**: Strict Zod schema validation on all inputs.
