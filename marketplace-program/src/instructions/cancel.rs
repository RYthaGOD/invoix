use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use crate::state::*;
use crate::instructions::{build_bubblegum_transfer_ix, get_sighash};

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", merkle_tree.key().as_ref()],
        bump = listing_state.bump,
        close = seller,
        has_one = seller
    )]
    pub listing_state: Account<'info, ListingState>,

    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// CHECK: Merkle tree
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

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

pub fn cancel_listing<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelListing<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
) -> Result<()> {
    let listing = &ctx.accounts.listing_state;
    
    // PDA signs for the transfer back using raw CPI
    let seeds = &[
        b"listing",
        listing.asset_id.as_ref(),
        &[listing.bump],
    ];
    let signer = &[&seeds[..]];

    let remaining_account_metas: Vec<AccountMeta> = ctx.remaining_accounts.iter()
        .map(|acc| AccountMeta::new_readonly(*acc.key, false))
        .collect();
    
    let transfer_ix = build_bubblegum_transfer_ix(
        ctx.accounts.tree_authority.key(),
        ctx.accounts.listing_state.key(), // PDA is owner
        ctx.accounts.listing_state.key(), // PDA is delegate
        ctx.accounts.seller.key(), // Back to Seller
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
        ctx.accounts.listing_state.to_account_info(),
        ctx.accounts.listing_state.to_account_info(),
        ctx.accounts.seller.to_account_info(),
        ctx.accounts.merkle_tree.to_account_info(),
        ctx.accounts.log_wrapper.to_account_info(),
        ctx.accounts.compression_program.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];
    account_infos.extend(ctx.remaining_accounts.iter().map(|a| a.to_account_info()));
    
    anchor_lang::solana_program::program::invoke_signed(
        &transfer_ix,
        &account_infos,
        signer,
    )?;

    // CPI to Arcium MXE: Unlock Invoice
    let discriminator = get_sighash("unlock_invoice");
    
    let ix = Instruction {
        program_id: ARCIUM_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.invoice_account.key(), false), // invoice
            AccountMeta::new_readonly(ctx.accounts.seller.key(), true), // authority (signer)
        ],
        data: discriminator.to_vec(),
    };

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.invoice_account.to_account_info(),
            ctx.accounts.seller.to_account_info(),
        ],
    )?;

    msg!("Listing cancelled");
    Ok(())
}
