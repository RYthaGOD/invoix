# Solana B2B Invoicing Protocol Overview (Production v1.0)

> **Current Status**: Live on Mainnet
> **Version**: 1.0.0

## 1. Core Concept
The **Solana B2B Invoicing System** is a production-ready invoicing platform that enables businesses to send and settle invoices on-chain using stablecoins (USDC/EURC) and SOL. It prioritizes **immediate utility and stability**, using proven cryptographic standards for privacy while preparing for next-gen confidential computing.

## 2. Key Technologies

### 🛡️ Privacy Layer: Hybrid Encryption (AES-256 + Arcium Ready)
- **Current Production**: Uses **AES-256-GCM** (standard military-grade encryption) to encrypt sensitive invoice details (line items, unit prices) in the database.
- **Key Management**: Keys are managed securely server-side, ensuring only authorized parties (Invoicer/Invoicee) can access decrypted data via the API.
- **Future Integration**: The system is architected to switch to **Arcium's Confidential Computing (MXE)** network when the v0.5 SDK stabilizes, without changing the frontend user experience.

### 💰 Settlement Layer: Solana & SPL Tokens
- **Role**: Handles value transfer and settlement.
- **Support**: Native SOL, USDC (SPL), and EURC.
- **Speed**: <400ms finality checks.
- **Verification**: The system performs real-time on-chain verification of transaction signatures to ensure payment finality before updating invoice status.

### 📄 Invoicing Logic: Standard REST + Web3
- **Creation**: Free invoice creation (non-gated).
- **Storage**: Hybrid storage.
    - **Metadata** (Who, When, Status): Stored in PostgreSQL for fast indexing.
    - **Sensitive Data** (What, How Much): Encrypted blobs.
- **Delivery**: Email notifications and in-app dashboard updates.

### 🖼️ Tokenization (Optional)
- **Receipts**: If a `PAYER_PRIVATE_KEY` is configured on the server, the system automatically mints a **Payment Receipt NFT** upon successful payment.
- **Purpose**: Provides an immutable on-chain record for accounting and tax auditing.

## 3. The Invoice Lifecycle (Production Flow)

1.  **Draft**: 
    - Business creates an invoice via dashboard.
    - System validates schema and business rules.
2.  **Encryption & Storage**:
    - Sensitive fields are encrypted using **AES-256-GCM**.
    - Invoice is stored with status `DRAFT` or `SENT`.
3.  **Delivery**:
    - Notification sent to customer.
4.  **Access & Decryption**:
    - Customer logs in with their wallet.
    - API verifies wallet ownership (Signature Auth).
    - If authorized, API decrypts data and returns plain-text JSON to the frontend.
5.  **Payment**:
    - Customer signs a standard SPL Token Transfer instruction using their wallet.
    - Transaction posts to Solana Mainnet.
6.  **Verification & Settlement**:
    - Client sends Transaction Signature to API.
    - API queries Solana RPC to verify:
        - Sender/Receiver match invoice.
        - Amount and Mint match invoice.
        - Block time is recent.
    - If valid, Invoice status updates to `PAID`.
7.  **Receipt Minting (Auto)**:
    - (Optional) System mints a Receipt NFT to the payer's wallet as proof of purchase.

## 4. Current Architecture Details

### Privacy Model
- **Public**: No data is exposed publicly. All endpoints require Wallet Authentication.
- **Private**: 
    - **Invoicer**: Sees all invoices they created.
    - **Invoicee**: Sees only invoices sent to them.
    - **Database Admins**: Cannot see line item details (encrypted at rest).

### Spam Prevention
- **Current**: Strictly enforced Rate Limiting (API Gateway).
- **Planned**: **x402 Protocol** (Micropayments) is designed but currently **disabled** in production to lower barrier to entry for early users.

### API Security
- **Authentication**: SIWS (Sign In With Solana) standard.
- **Session**: Secure, HTTP-only cookies.
- **Validation**: Strict Zod schema validation on all inputs.
