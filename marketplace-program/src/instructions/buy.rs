use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::MarketplaceError;
use crate::instructions::{build_bubblegum_transfer_ix, get_sighash};

#[derive(Accounts)]
pub struct BuyInvoice<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut, 
        seeds = [b"listing", merkle_tree.key().as_ref()], 
        bump = listing_state.bump,
        close = seller
    )]
    pub listing_state: Account<'info, ListingState>,

    /// CHECK: Seller address matched in state
    #[account(mut, address = listing_state.seller)]
    pub seller: SystemAccount<'info>,

    #[account(mut, constraint = buyer_token_account.mint == currency_mint.key())]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut, 
        constraint = seller_token_account.mint == currency_mint.key(),
        constraint = seller_token_account.owner == seller.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(mut, constraint = treasury_token_account.mint == currency_mint.key())]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub currency_mint: Account<'info, token::Mint>,
    
    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// CHECK: Merkle tree
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
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

pub fn buy_invoice<'info>(
    ctx: Context<'_, '_, '_, 'info, BuyInvoice<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
) -> Result<()> {
    let listing = &ctx.accounts.listing_state;
    
    // 1. Verify Price & Currency matches
    require!(ctx.accounts.currency_mint.key() == listing.currency_mint, MarketplaceError::WrongCurrency);
    require!(ctx.accounts.buyer_token_account.amount >= listing.price, MarketplaceError::InsufficientFunds);
    
    // Security Patch: Validate Treasury Owner
    require!(
        ctx.accounts.treasury_token_account.owner == TREASURY_WALLET, 
        MarketplaceError::InvalidTreasury
    );

    // 2. Transfer Funds (Buyer -> Seller + Treasury)
    let total_amount = listing.price;
    let fee_amount = total_amount / 100; // 1% Fee
    let seller_amount = total_amount - fee_amount;

    // Transfer to Seller
    let transfer_to_seller = Transfer {
        from: ctx.accounts.buyer_token_account.to_account_info(),
        to: ctx.accounts.seller_token_account.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_to_seller),
        seller_amount,
    )?;

    // Transfer to Treasury
    let transfer_to_treasury = Transfer {
        from: ctx.accounts.buyer_token_account.to_account_info(),
        to: ctx.accounts.treasury_token_account.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_to_treasury),
        fee_amount,
    )?;

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
        ctx.accounts.listing_state.key(), // Current Owner is PDA
        ctx.accounts.listing_state.key(), // PDA is delegate
        ctx.accounts.buyer.key(), // New Owner is Buyer
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
        ctx.accounts.buyer.to_account_info(),
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

    // CPI to Arcium MXE: Complete Transfer
    let discriminator = get_sighash("complete_transfer");
    let new_authority = ctx.accounts.buyer.key();

    let mut data = Vec::with_capacity(8 + 32);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(new_authority.as_ref());

    let ix = Instruction {
        program_id: ARCIUM_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.invoice_account.key(), false), // invoice
            AccountMeta::new_readonly(ctx.accounts.listing_state.key(), true), // authority/delegate (signer)
        ],
        data,
    };

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.invoice_account.to_account_info(),
            ctx.accounts.listing_state.to_account_info(),
        ],
        signer
    )?;

    msg!("Invoice bought: {:?}", listing.key());
    Ok(())
}
