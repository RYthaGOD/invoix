# Smart Contract Security Audit Report

**Date:** January 19, 2026
**Target:** `marketplace-program`, `arcium-mxe`
**Version:** 1.0.0

## Executive Summary

This audit targeted the Solana smart contracts `marketplace-program` and `arcium-mxe`.
Two critical/high-severity vulnerabilities were identified that could lead to loss of funds (platform fees) or asset mismatching.
Immediate remediation is required before mainnet deployment.

## Findings

### 1. [RESOLVED] Insufficient Treasury Account Validation
**Location:** `marketplace-program/src/lib.rs` :: `buy_invoice`

**Status:** ✅ Fixed
**Fix:** Hardcoded `TREASURY_WALLET` constant (`B4ReZ...`) and implemented strict owner check in `buy_invoice`.

**Description:**
The `buy_invoice` instruction attempts to validate the treasury account to prevent the buyer or seller from receiving the fee. However, checks are insufficient:
```rust
require!(ctx.accounts.treasury_token_account.key() != ctx.accounts.buyer_token_account.key(), MarketplaceError::InvalidTreasury);
require!(ctx.accounts.treasury_token_account.key() != ctx.accounts.seller_token_account.key(), MarketplaceError::InvalidTreasury);
```
This logic allows *any* other account to be passed as the treasury. A malicious buyer could pass a secondary wallet they control as the treasury account, effectively evading the platform fee or stealing fees intended for the protocol.

### 2. [RESOLVED] Asset Mismatch Vulnerability (Spoofing)
**Location:** `marketplace-program/src/lib.rs` :: `list_invoice`

**Status:** ✅ Fixed
**Fix:** Implemented `InvoiceAccountMirror` struct and added logic to deserialize the Invoice account and verify that `invoice.asset_id` matches the derived Bubblegum Asset ID of the cNFT being listed.

**Description:**
The `list_invoice` instruction takes `invoice_account` (Arcium) and `merkle_tree` (Bubblegum) as input accounts.
It performs a CPI to `arcium-mxe::lock_invoice` to lock the invoice status.
It performs a Bubblegum transfer using `merkle_tree` to escrow the cNFT.

**Vulnerability:**
The program does **not** verify that the `invoice_account` acts as the metadata/implementation for the *specific* `merkle_tree` (asset) being transferred.
A malicious seller could:
1. Own a legitimate high-value Invoice A (Arcium Account).
2. Own a low-value or unrelated cNFT B (Merkle Tree B).
3. Call `list_invoice` passing `Invoice A` and `Merkle Tree B`.
4. The program locks `Invoice A` but transfers `cNFT B` to escrow.
5. The listing is created for `Asset ID` of `Merkle Tree B` (derived from seeds).
6. A Buyer purchasing this listing believes they are buying the underlying asset for `Invoice A` (if the UI misleads them or if they rely on the Invoice Data), but they receive `cNFT B`.
7. `Invoice A` remains locked but effectively "attached" to the sale of the wrong asset.

### 3. [RESOLVED] Token Mint Validation Bypass
**Location:** `marketplace-program/src/lib.rs` :: `buy_invoice`

**Status:** ✅ Fixed
**Fix:** Added `constraint = token_account.mint == currency_mint.key()` to `buyer_token_account`, `seller_token_account`, and `treasury_token_account` in the `BuyInvoice` struct.

**Description:**
The `buy_invoice` instruction verifies that the passed `currency_mint` matches the `listing.currency_mint`. However, it fails to enforce that the `buyer_token_account`, `seller_token_account`, and `treasury_token_account` are actually associated with that `currency_mint`.
A malicious buyer could:
1. Create a worthless "FakeToken".
2. Initialize Token Accounts for themselves, the Seller, and the Treasury for "FakeToken".
3. Call `buy_invoice` passing the real USDC Mint (to satisfy the check) but the "FakeToken" accounts for the transfer.
4. The `token::transfer` instruction succeeds (as source and dest match "FakeToken").
5. The buyer receives the Invoice, but the seller receives worthless tokens.

**Recommendation:**
Add generic constraints to the `BuyInvoice` struct to ensure all token accounts match the `currency_mint`:
```rust
#[account(constraint = buyer_token_account.mint == currency_mint.key())]
pub buyer_token_account: Account<'info, TokenAccount>,
#[account(constraint = seller_token_account.mint == currency_mint.key())]
pub seller_token_account: Account<'info, TokenAccount>,
#[account(constraint = treasury_token_account.mint == currency_mint.key())]
pub treasury_token_account: Account<'info, TokenAccount>,
```

### 4. [RESOLVED] PDA Signer Seed Mismatch (Critical Logic Bug)
**Location:** `marketplace-program/src/lib.rs` :: `buy_invoice` & `cancel_listing`

**Status:** ✅ Fixed
**Fix:** Updated the seeds used for `invoke_signed` to match the PDA initialization seeds: `[b"listing", listing.asset_id.as_ref(), &[bump]]`.

**Description:**
The `listing_state` PDA is initialized using seeds `[b"listing", merkle_tree.key()]`. However, the `buy_invoice` and `cancel_listing` instructions attempted to sign CPI calls using seeds `[b"listing", listing.seller.key()]`.
Since the seeds do not match, the derived address would not match the `listing_state` account, causing the Solana runtime to reject the signature (Signature verification failed). This would have rendered the contract unusable for buying or cancelling.

### 5. [RESOLVED] Seller Token Account Ownership Bypass
**Location:** `marketplace-program/src/lib.rs` :: `buy_invoice`

**Status:** ✅ Fixed
**Fix:** Added `constraint = seller_token_account.owner == seller.key()` to the `seller_token_account` in the `BuyInvoice` struct.

**Description:**
The `buy_invoice` instruction allows the Buyer to pass the `seller_token_account` where funds will be sent.
While the instruction verifies that the `seller` account matches the `listing.seller`, it **does not verify** that the passed `seller_token_account` is actually owned by the `seller`.
A malicious Buyer could:
1. Pass the correct `seller` account (system account).
2. Pass their *own* token account as `seller_token_account`.
3. The program transfers the listing price from the Buyer's Source to the Buyer's Destination (Self-Transfer).
4. The program transfers the Fee to the Treasury.
5. The program transfers the cNFT to the Buyer.
**Result:** The Buyer acquires the asset for free (cost of fee only), stealing from the Seller.

### 6. [LOW] Loose Access Control in `arcium-mxe`
**Location:** `arcium-mxe/src/lib.rs` :: `complete_transfer`

**Description:**
The `complete_transfer` instruction was modified to allow a delegate logic for Locked invoices.
It relies on `invoice.status == Locked` and `invoice.delegate == authority_key`.
While this logic is sound for the current Marketplace integration, it assumes the "Delegate" (Marketplace PDA) is trustworthy. If a malicious Marketplace program were authorized (or if a user manualy set a delegate to a malicious program), that delegate could transfer authority.
This is "Working as Intended" for a delegation model, but relies heavily on the security of the Delegate (the Marketplace Program).

**Recommendation:**
Ensure only verified/whitelisted programs can be set as delegates if stricter control is desired designated by a Governance process, or accept this as a trust-model implication.

## Conclusion

The smart contracts are **NOT** ready for mainnet. The **Treasury Verification** and **Asset Mismatch** issues must be fixed immediately.

## Remediations Summary
- [ ] Fix `buy_invoice` treasury check.
- [ ] Fix `list_invoice` asset_id check.
