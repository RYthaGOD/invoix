use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use anchor_spl::token::{self};
use crate::state::*;
use crate::errors::MarketplaceError;
use crate::instructions::{build_bubblegum_transfer_ix, get_sighash};

#[derive(Accounts)]
pub struct ListInvoice<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        init,
        payer = seller,
        space = 8 + 32 + 8 + 32 + 32 + 8 + 4 + 32 + 1, // Size calc
        seeds = [b"listing", merkle_tree.key().as_ref()], // Use Asset ID for unique listing (One listing per asset)
        bump
    )]
    pub listing_state: Account<'info, ListingState>,

    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// CHECK: Merkle tree
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    pub currency_mint: Box<Account<'info, token::Mint>>,

    /// CHECK: SPL Noop Program (raw CPI)
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: SPL Account Compression Program (raw CPI)
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: Bubblegum Program (raw CPI)
    pub bubblegum_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: Arcium Program
    pub arcium_program: UncheckedAccount<'info>,

    /// CHECK: Invoice Account (Manual CPI)
    #[account(mut)]
    pub invoice_account: UncheckedAccount<'info>,
}

pub fn list_invoice<'info>(
    ctx: Context<'_, '_, '_, 'info, ListInvoice<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    price: u64,
) -> Result<()> {
    {
        let listing = &mut ctx.accounts.listing_state;
        listing.seller = ctx.accounts.seller.key();
        listing.price = price;
        listing.currency_mint = ctx.accounts.currency_mint.key();
        listing.asset_id = ctx.accounts.merkle_tree.key();
        listing.nonce = nonce;
        listing.index = index;
        listing.root = root;
        listing.bump = ctx.bumps.listing_state;
    } // Drop mutable borrow

    // ---------------------------------------------------------
    // SECURITY CHECK: Asset Mismatch Verification
    // ---------------------------------------------------------
    let data = ctx.accounts.invoice_account.data.borrow();
    if data.len() < 8 {
        return Err(ProgramError::InvalidAccountData.into());
    }
    let mut ref_data = &data[8..]; // Skip 8-byte discriminator
    let invoice_data = InvoiceAccountMirror::deserialize(&mut ref_data)
        .map_err(|_| ProgramError::InvalidAccountData)?;

    let leaf_index_u64 = index as u64;
    let (expected_asset_id, _) = Pubkey::find_program_address(
        &[
            b"asset",
            ctx.accounts.merkle_tree.key().as_ref(),
            &leaf_index_u64.to_le_bytes(),
        ],
        &BUBBLEGUM_PROGRAM_ID,
    );

    let invoice_asset_pubkey = Pubkey::new_from_array(invoice_data.asset_id);

    require!(invoice_asset_pubkey == expected_asset_id, MarketplaceError::AssetMismatch);
    
    msg!("Verified Invoice Asset: {:?} matches Derived Bubblegum Asset: {:?}", invoice_asset_pubkey, expected_asset_id);

    let remaining_account_metas: Vec<AccountMeta> = ctx.remaining_accounts.iter()
        .map(|acc| AccountMeta::new_readonly(*acc.key, false))
        .collect();
    
    let transfer_ix = build_bubblegum_transfer_ix(
        ctx.accounts.tree_authority.key(),
        ctx.accounts.seller.key(),
        ctx.accounts.seller.key(), // Seller is delegate (signs)
        ctx.accounts.listing_state.key(), // PDA becomes owner
        ctx.accounts.merkle_tree.key(),
        ctx.accounts.log_wrapper.key(),
        ctx.accounts.compression_program.key(),
        ctx.accounts.system_program.key(),
        root,
        data_hash,
        creator_hash,
        nonce,
        index,
        remaining_account_metas,
    );
    
    let mut account_infos = vec![
        ctx.accounts.tree_authority.to_account_info(),
        ctx.accounts.seller.to_account_info(),
        ctx.accounts.seller.to_account_info(),
        ctx.accounts.listing_state.to_account_info(),
        ctx.accounts.merkle_tree.to_account_info(),
        ctx.accounts.log_wrapper.to_account_info(),
        ctx.accounts.compression_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];
    account_infos.extend(ctx.remaining_accounts.iter().map(|a| a.to_account_info()));
    
    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &account_infos,
    )?;

    // CPI to Arcium MXE: Lock Invoice
    let discriminator = get_sighash("lock_invoice");
    let delegate_pubkey = ctx.accounts.listing_state.key(); // The Listing PDA is the delegate
    
    let mut data = Vec::with_capacity(8 + 32);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(delegate_pubkey.as_ref());

    let ix = Instruction {
        program_id: ARCIUM_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.invoice_account.key(), false), // invoice
            AccountMeta::new_readonly(ctx.accounts.seller.key(), true), // authority (signer)
        ],
        data,
    };

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.invoice_account.to_account_info(),
            ctx.accounts.seller.to_account_info(),
        ],
    )?;

    msg!("Invoice listed: {:?}", ctx.accounts.listing_state.key());
    Ok(())
}
