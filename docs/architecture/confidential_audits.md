# Selective Disclosure & Confidential Compliance Architecture

## The Challenge

In traditional finance (TradFi), compliance and auditing rely on **Trusted Intermediaries** (Banks, Auditors, Swift) who must have full access to raw data. In decentralized finance (DeFi), compliance often requires **Public Disclosure**, which is unacceptable for industrial B2B commerce (e.g., protecting supplier pricing).

Invoix solves the **Privacy-Audit Paradox**: *How to prove compliance without revealing trade secrets, and without trusting a central authority?*

## The Solution: Cryptographic Truth vs. Institutional Trust

Invoix leverages a hybrid architecture combining **Arcium Confidential Computing (MXE)** and **Solana State Compression**.

### 1. Trusted Execution Environments (TEEs) as the "Intermediary"

Instead of trusting a *firm* (human intermediary), Invoix trusts a *network of secure processors* (Computational Intermediary).

*   **Hardware Root of Trust**: Arcium nodes use TEEs (like SGX/SEV) which guarantee that the code running inside cannot be tampered with or inspected, even by the node operator.
*   **Remote Attestation**: Before sending data, Invoix clients verify the TEE's cryptographic signature, proving it is running the exact, open-source Invoix privacy logic.

### 2. Programmable Selective Disclosure

Privacy in Invoix is not binary (Open vs. Encrypted). It is **Programmable**.

The Arcium MXE environment acts as a "Gatekeeper Program" that enforces access logic *inside* the secure enclave:

*   **Raw Data**: Fully encrypted (e.g., `Line Items`, `Unit Price`).
*   **Authorized Viewers (Owner/Payer)**: The TEE decrypts full data and re-encrypts it for the viewer's session key.
*   **Auditor View (Selective)**: Code inside the TEE can generate specific "Limited Views" without exposing the underlying raw data.
    *   *Example*: An auditor asks "Is this invoice valid tax-wise?"
    *   *TEE Logic*: Decrypts `Tax Amount`, verifies `Rate`, sums `Totals`.
    *   *Output*: Returns `Verified: True` or `Total VAT: $500.00` signed by the TEE.
    *   *Outcome*: The auditor trusts the *result* because they trust the *attested code*, but they never see the `Unit Price` or `Supplier SKU`.

### 3. Immutable Audit Trails (cNFTs)

Solana provides the immutable "Time & Existence" proof via **Compressed NFTs**.

*   **Payment Receipts**: Every settlement mints a cNFT.
*   **Cryptographic Link**: The cNFT contains a hash of the Invoice ID and Payment Signature.
*   **Zero-Knowledge Property**: The cNFT proves *payment happened* at a specific time and amount, without revealing *what was bought*. This creates a perfect public chain of custody for dispute resolution that is mathematically linked to the private data in the TEE.

## Comparison

| Feature | TradFi | Standard DeFi | Invoix (Confidential Compute) |
| :--- | :--- | :--- | :--- |
| **Data Privacy** | Trust the Bank | None (Public) | **Hardware-Encrypted** |
| **Auditing** | Manual Review | Chain Analysis | **Programmatic/Zero-Knowledge** |
| **Trust Model** | Institutional Reputation | Code is Law (Public) | **Code is Law (Confidential)** |
| **Selective Disclosure** | Manual Redaction | Impossible | **Cryptographically Enforced** |

## Implementation Implementation

In `arcium-mxe/src/lib.rs`, we define the `InvoiceAccount` which holds the `encrypted_fields` blob.
The *decryption and view logic* resides in the off-chain Arcium Computation Definitions (defined in the `MXEAccount` configuration), which dictates who can generate which "View" of that blob.
