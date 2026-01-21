# Security Fixes Implementation Plan

This plan outlines the technical steps to remediate the vulnerabilities identified in the Smart Contract Audit.

## 1. Fix Treasury Validation (`marketplace-program`)
**Goal:** Ensure platform fees cannot be diverted to arbitrary accounts.
**Approach:** Hardcode the Protocol Treasury Wallet address and validate the provided Treasury Token Account is owned by it.

### Changes in `marketplace-program/src/lib.rs`
1.  Define `ADMIN_TREASURY_PUBKEY` constant.
2.  In `buy_invoice`, add check:
    ```rust
    require!(ctx.accounts.treasury_token_account.owner == ADMIN_TREASURY_PUBKEY, MarketplaceError::InvalidTreasuryOwner);
    ```

## 2. Fix Asset Mismatch Spoofing (`marketplace-program`)
**Goal:** Ensure the Invoice (Arcium) being listed is legally bound to the cNFT (Bubblegum) being transferred.
**Approach:** Verify `Invoice.asset_id` matches the derived Asset ID of the cNFT.

### Changes in `marketplace-program/src/lib.rs`
1.  Import/Define `InvoiceAccount` struct (mirroring Arcium's layout) for deserialization.
2.  Implement `get_asset_id` helper function:
    - Seeds: `["asset", tree_id, leaf_index]` (standard Bubblegum).
3.  In `list_invoice`:
    - Deserialize `ctx.accounts.invoice_account`.
    - Compute `derived_asset_id` using `merkle_tree.key` and `index`.
    - `require!(invoice.asset_id == derived_asset_id)`.
    - Also `require!(invoice.asset_id.len() > 0)` to ensure it's linked.

## 3. Improve Access Control (`arcium-mxe`)
**Goal:** Restrict `complete_transfer` to prevent unauthorized transfers even if Locked.
**Approach:** (Optional Phase 2) - For now, we will trust the "Signed by Delegate" model, but clarify the `authority` check.
*Note: The user asked for "detailed plan to improve". The current "Delegate" model is actually standard for marketplaces. The vulnerability is if a user Sets Delegate to a malicious program. But they sign `lock_invoice` so they opt-in. We will stick to fixing the CRITICAL bugs first.*

## 4. Updates & Cleanup
- Compile and run tests to verify fixes.
- Update `Security Audit Report` to "Resolved" status upon completion.

## Proposed Code Structure (Marketplace)

```rust
// In lib.rs

// 1. Define Protocol Treasury
// (For Devnet, we can use a known key or a placeholder to be replaced by env)
pub const TREASURY_WALLET: Pubkey = pubkey!("HgBr9... (Real Wallet Here) ...");

// 2. Struct Mirror for Verification
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InvoiceAccountMirror {
    pub authority: Pubkey,
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub due_date: i64,
    pub status: u8, // Enum as u8
    pub content_hash: [u8; 32],
    pub asset_id: [u8; 32],
    // ... we can stop here if we only need asset_id and know the order
    // But safely, we should match the full struct or use zero-copy logic if aligned.
    // Anchor Deserialize requires full match usually.
    pub delegate: Pubkey,
    pub encrypted_fields: Vec<u8>,
    pub subscription_id: Option<Pubkey>,
    pub bump: u8,
}

// 3. Logic in list_invoice
pub fn list_invoice(...) {
   // ...
   
   // Verify Asset Match
   let invoice_data: InvoiceAccountMirror = AccountDeserialize::try_deserialize(
       &mut ctx.accounts.invoice_account.data.borrow().as_ref()
   )?;
   
   // Derive Asset ID (Bubblegum)
   let (expected_asset_id, _) = Pubkey::find_program_address(
       &[
           b"asset", 
           ctx.accounts.merkle_tree.key().as_ref(),
           &index.to_le_bytes() // Note: u32 or u64? Bubblegum index is allowed to be u64 but usually u32 in generic arguments? 
           // Bubblegum 'leaf_index' is u32 in some places, u64 in others.
           // In build_bubblegum_transfer_ix, index is u32.
           // In standard Bubblegum, get_asset_id takes u64.
           // We need to be careful with bytes.
       ], 
       &BUBBLEGUM_PROGRAM_ID
   );
   
   // Compare
   // Invoice stores [u8; 32], expected is Pubkey
   require!(Pubkey::new_from_array(invoice_data.asset_id) == expected_asset_id, MarketplaceError::AssetMismatch);
   
   // ...
}
```

## Questions / Verification
- **Bubblegum Asset ID Seeds**: Validate if `["asset", tree, leaf_index]` is correct.
  - Source: Metaplex Bubblegum. `asset_prefix`, `tree`, `leaf_index`. yes.
- **Index Type**: Bubblegum uses `u64` for index in seeds?
  - Need to verify if `index` (u32) passed to `list_invoice` should be cast to `u64` for the seed.
  - Standard Bubblegum trees can have 2^30 leaves. `u32` fits.
  - But the seed buffer might expect 8 bytes if the standard defines it as `leaf_index: u64`.
  - Checking `mpl-bubblegum`: `leaf_index` is `u64`.
  - So `&index.to_le_bytes()` might be wrong if it only gives 4 bytes. We should cast to u64 first.

```
