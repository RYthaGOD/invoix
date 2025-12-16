# 📄 SolanaInvoice Protocol: Whitepaper

> **Version**: 1.0.0 (Mainnet Beta) · **Date**: December 2025

---

## 1. Executive Summary

Global B2B payments face a critical efficiency gap. Traditional invoice settlement relies on legacy banking rails (SWIFT/ACH) characterized by **3-5 day settlement times**, **high fees (1-3%)**, and opaque tracking. Conversely, while public blockchains offer speed, they default to radical transparency—unacceptable for businesses requiring confidentiality for pricing agreements and client lists.

**SolanaInvoice** bridges this gap. It is a crypto-native invoicing protocol built on Solana that delivers **instant settlement (<400ms)** with **enterprise-grade privacy**. By leveraging a hybrid encryption architecture (AES-256 today, transitioning to Arcium Confidential Computing tomorrow), it allows businesses to transact on-chain without exposing their trade secrets.

### Key Value Propositions
| Feature | Traditional Invoicing | Public Blockchains (Raw) | SolanaInvoice Protocol |
| :--- | :--- | :--- | :--- |
| **Settlement Speed** | 3-5 Business Days | 400ms | **400ms** |
| **Transaction Cost** | $15-$50 (Wire Fees) | ~$0.00025 (Network Fee) | **1% (Platform Fee)** |
| **Data Privacy** | High (Siloed) | None (Public Ledger) | **Hybrid Encrypted** |
| **Auditability** | Manual / Difficult | Perfect | **Perfect** |

---

## 2. Technical Architecture

### 2.1 The Privacy Layer (Hybrid Model)
The protocol utilizes a dual-state storage architecture to balance performance, privacy, and decentralization.

#### Current State: Server-Side Encryption (v1)
*   **Method**: AES-256-GCM (Galois/Counter Mode).
*   **Key Management**: Keys are derived from a master secret and managed server-side.
*   **Access**: Decryption occurs only upon cryptographic signature verification from an authorized wallet (the Issuer or the Recipient).
*   **Data Partitioning**: 
    *   *Public*: Invoice Metadata (ID, Status, Dates) → Indexed SQL.
    *   *Private*: Line Items, Unit Prices, Notes → Encrypted Blobs.

#### Future State: Arcium Network Integration (v2)
*   **Goal**: Remove the central server as a trusted party.
*   **Technology**: Arcium Multi-Party eXecution (MXE).
*   **Mechanism**: Encryption keys are sharded across a decentralized network of nodes. Computation (decryption for viewing) happens inside a Trusted Execution Environment (TEE), ensuring even node operators cannot view raw data.

### 2.2 The Settlement Layer
*   **Network**: Solana Mainnet.
*   **Assets**: USDC (SPL), EURC (SPL), SOL.
*   **Payment Verification**: The protocol utilizes an "Optimistic Listener" model. It monitors the blockchain for transactions matching the invoice criteria (Sender, Receiver, Amount, Mint) and automatically reconciles the state to `PAID`.

---

## 3. The x402 Protocol (Anti-Spam & Revenue)

To prevent resource exhaustion attacks (invoice spamming) and sustain the platform, the protocol implements the **x402 Standard** (Payment Required).

1.  **Gating**: Creating an invoice requires a nominal micropayment token.
2.  **Cost**: Fixed at **$0.01 USD** (payable in USDC/SOL).
3.  **Mechanism**: This anti-spam fee is separate from the **1% Settlement Fee** charged upon successful payment.
4.  **Effect**: Ensures all data settled on the platform has economic value, preventing database bloat while keeping individual costs negligible compared to Web2 alternatives.

---

## 4. Roadmap

Our development trajectory is divided into three strategic phases: **Hardening**, **Expansion**, and **Decentralization**.

### Phase 1: Hardening (Q4 2025 - Current)
*Target: Stability & Security*
*   [x] **Signature Replay Protection**: Preventing authentication attacks.
*   [x] **Rate Limiting**: 3-tier defense against DDoS.
*   [ ] **Infrastructure Upgrade**: Migration from in-memory sessions to Redis/PostgreSQL.
*   [ ] **Security Audit**: Third-party review of API endpoints.

### Phase 2: Expansion (Q1-Q2 2026)
*Target: Feature Parity with Web2 SaaS*
*   **Mobile Experience**: Native iOS/Android apps for invoices on-the-fly.
*   **Recurring Billing**: Smart Contracts for subscription management (SaaS billing).
*   **Accounting Integrations**: One-click sync to QuickBooks/Xero.
*   **Invoice Factoring**: A DeFi marketplace allowing businesses to borrow against unpaid invoices (e.g., "Get 95% now, we collect later").

### Phase 3: Decentralization (Q3 2026+)
*Target: Unstoppable Protocol*
*   **Arcium Migration**: Full TEE-based privacy.
*   **Protocol DAO**: Transitioning treasury management to community governance.
*   **Smart Invoices**: Moving business logic from REST API to On-Chain Programs.

---

## 5. Tokenomics

The protocol is supported by a native utility token that aligns incentives between the platform and its users.

*   **Revenue Allocation**: **50% of all Protocol Treasury revenue** (derived from the 1% transaction fee) is automatically allocated to the **Rewards Pool**.
*   **Buy-Back & Distribute**: The protocol uses these funds to buy back the native token from the open market.
*   **User Rewards**: These bought-back tokens are distributed as rewards to active platform users (Invoicers and Payers) based on their transaction volume, effectively rebating a portion of their costs and granting governance rights.
*   **Staking**: Nodes providing Arcium computation resources (Phase 3) stake tokens to ensure honest behavior.
