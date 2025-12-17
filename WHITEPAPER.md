# INVOIX: The Hybrid B2B Settlement Layer

**Version:** 1.0  
**Date:** December 2025  
**Status:** Live Beta

---

## 1. Executive Summary

**Invoix** is a next-generation B2B invoicing and settlement platform built on Solana. It bridges the gap between traditional business accounting (Web2) and instantaneous, trustless value transfer (Web3).

Current B2B payments are slow, expensive (credit card fees ~2.9%), and opaque. Crypto payments are fast but often lack the professional tooling (invoices, receipts, privacy, recurring billing) businesses require.

Invoix solves this by treating **Invoices as Smart Assets** while maintaining a familiar Web2 user experience.

---

## 2. The Problem

### 1. The "Net 30" Friction
Traditional B2B transactions rely on Net 30/60/90 terms because money moves slowly. Wire transfers take days; checks take weeks. This creates cash flow gaps.

### 2. Reconciliation Hell
Sending crypto is easy; knowing *what* a transaction was for is hard. A wallet transaction hash (`8x...abc`) has no semantic context. Accounting teams spend hours matching blockchain hashes to PDF invoices.

### 3. Privacy vs. Transparency
Public blockchains reveal too much (who paid whom). Traditional systems reveal too little (is the invoice actually valid?). Businesses need a middle ground.

---

## 3. The Solution: Hybrid Architecture

Invoix uses a **Hybrid Infrastructure**:

1.  **Web2 Frontend & Database**: A familiar dashboard for creating invoices, managing customers, and tracking status. This ensures a smooth User Experience (UX) without requiring deep crypto knowledge.
2.  **Web3 Settlement Layer**:
    *   **Payments**: Instant settlement in USDC, EURC, or SOL.
    *   **Receipts**: Every payment automatically mints a **Compressed NFT (cNFT)** receipt. This acts as an immutable, on-chain proof of payment linked to the specific invoice ID.
    *   **Identity**: "Verified Business" Soulbound Tokens (SBTs) allow merchants to build on-chain reputation.

### Key Value Props
*   **Instant Cash Flow**: Funds arrive in seconds, not days.
*   **1% Flat Fee**: Significantly cheaper than Stripe/PayPal (2.9% + $0.30).
*   **Automated Reconciliation**: The payment transaction *is* the receipt.
*   **Trustless**: The platform cannot freeze funds; settlement is peer-to-peer.

---

## 4. Technical Architecture

### 4.1. Compressed NFTs (cNFTs) for Scalability
We utilize **Solana's State Compression** technology.
*   **Traditional NFTs**: Cost ~$0.002 to mint 1 item. Expensive at scale (millions of invoices).
*   **Compressed NFTs**: We use a **Merkle Tree** structure. We can mint **millions of receipts for fractions of a SOL**.
    *   *Current Config*: Max Depth 14 (16,384 invoices per tree).
    *   *Scalability*: Trivial upgrade to Depth 24+ allows for billions of units.

### 4.2. Arcium Tier-0 Encryption (Privacy)
To solve the privacy paradox, we integrate **Arcium Multi-Party Computation (MPC)**.
*   **Public Data**: Timestamp, Amount (optional).
*   **Private Data**: Invoice Line Items, Customer Details.
*   **How it works**: Sensitive data is encrypted before it leaves the browser. Only the authorized parties (Buyer & Seller) can decrypt the invoice details using the Arcium Network. The blockchain sees an encrypted blob, preserving business secrecy while proving existence.

### 4.3. "Gasless" Design
We use a **Relayer Pattern**.
*   Users sign a message ("I approve this invoice").
*   The Invoix Server pays the SOL gas fees for the transaction.
*   The outcome: Users don't need to manage SOL balances just to create an invoice.

---

## 5. Business Model

The protocol revenue model is simple and transparent:

1.  **Platform Fee (1%)**: Taken automatically from every invoice payment.
    *   *Example*: Invoice for $1,000 USDC.
    *   *Settlement*: $990 to Merchant, $10 to Invoix Treasury.
    *   *Mechanism*: Atomic transaction instruction ensures the fee cannot be bypassed.

2.  **Identity Verification ($5 - $20)**: One-time fee for businesses to mint their "Verified Merchant" badge.

---

## 6. Roadmap

### Phase 1: Foundation (Completed)
*   ✅ Invoicing Engine
*   ✅ Solana/USDC Payments
*   ✅ Compressed NFT Receipts
*   ✅ Basic Privacy (Private toggle)

### Phase 2: Polish (Completed)
*   ✅ Email Notifications (Resend Integration)
*   ✅ UX Improvements & Status Badges

### Phase 3: Growth (Next)
*   [ ] **Recurring Billing**: Subscription streams using Token Extensions.
*   [ ] **Mobile App**: React Native mobile experience.
*   [ ] **Factoring/Lending**: Allow businesses to borrow against unpaid invoices (DeFi integration).
