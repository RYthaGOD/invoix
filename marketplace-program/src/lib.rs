use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer},
};
use mpl_bubblegum::program::MplBubblegum;
use spl_account_compression::program::SplAccountCompression;
use spl_account_compression::Noop;

declare_id!("InvxMkt111111111111111111111111111111111111");

#[program]
pub mod marketplace_program {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// List an Invoice (cNFT) for sale
    /// Transfers cNFT from Seller to PDA Vault
    pub fn list_invoice<'info>(
        ctx: Context<'_, '_, '_, 'info, ListInvoice<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        price: u64,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing_state;
        listing.seller = ctx.accounts.seller.key();
        listing.price = price;
        listing.currency_mint = ctx.accounts.currency_mint.key();
        listing.asset_id = ctx.accounts.merkle_tree.key(); // simplified, actually needs real assert ID logic if needed
        listing.nonce = nonce;
        listing.index = index;
        listing.root = root;
        listing.bump = *ctx.bumps.get("listing_state").unwrap();

        // Transfer cNFT from Seller to Listing PDA
        // We act as a delegate or direct transfer if we are the delegate
        let cpi_program = ctx.accounts.bubblegum_program.to_account_info();
        
        // Manual CPI to Bubblegum Transfer
        // Note: In production, we'd use mpl_bubblegum::cpi::transfer, but for brevity/robustness 
        // with custom remaining_accounts (proofs), we show the structure.
        
        let transfer_accounts = mpl_bubblegum::cpi::accounts::Transfer {
            tree_authority: ctx.accounts.tree_authority.to_account_info(),
            leaf_owner: ctx.accounts.seller.to_account_info(),
            leaf_delegate: ctx.accounts.seller.to_account_info(), // Seller must approve or sign
            new_leaf_owner: ctx.accounts.listing_state.to_account_info(), // PDA becomes owner
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
            compression_program: ctx.accounts.compression_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, transfer_accounts)
            .with_remaining_accounts(ctx.remaining_accounts.to_vec());

        mpl_bubblegum::cpi::transfer(
            cpi_ctx,
            root,
            data_hash,
            creator_hash,
            nonce,
            index,
        )?;

        msg!("Invoice listed: {:?}", listing.key());
        Ok(())
    }

    /// Buy an Invoice
    /// Atomic Swap: Funds to Seller/Treasury -> cNFT to Buyer
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

        // 3. Transfer cNFT (PDA -> Buyer)
        // PDA signs for the transfer
        let seeds = &[
            b"listing",
            listing.seller.as_ref(), // We used seller + nonce as seed potentially, or just unique ID
            &[listing.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.bubblegum_program.to_account_info();
        let transfer_accounts = mpl_bubblegum::cpi::accounts::Transfer {
            tree_authority: ctx.accounts.tree_authority.to_account_info(),
            leaf_owner: ctx.accounts.listing_state.to_account_info(), // Current Owner is PDA
            leaf_delegate: ctx.accounts.listing_state.to_account_info(),
            new_leaf_owner: ctx.accounts.buyer.to_account_info(), // New Owner is Buyer
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
            compression_program: ctx.accounts.compression_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer)
            .with_remaining_accounts(ctx.remaining_accounts.to_vec());

        mpl_bubblegum::cpi::transfer(
            cpi_ctx,
            root,
            data_hash,
            creator_hash,
            nonce,
            index,
        )?;

        msg!("Invoice bought: {:?}", listing.key());
        Ok(())
    }

    /// Cancel Listing
    /// Transfers cNFT from PDA back to Seller
    pub fn cancel_listing<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelListing<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing_state;
        
        // PDA signs for the transfer back
        let seeds = &[
            b"listing",
            listing.seller.as_ref(),
            &[listing.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.bubblegum_program.to_account_info();
        let transfer_accounts = mpl_bubblegum::cpi::accounts::Transfer {
            tree_authority: ctx.accounts.tree_authority.to_account_info(),
            leaf_owner: ctx.accounts.listing_state.to_account_info(), // PDA
            leaf_delegate: ctx.accounts.listing_state.to_account_info(),
            new_leaf_owner: ctx.accounts.seller.to_account_info(), // Back to Seller
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
            compression_program: ctx.accounts.compression_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer)
            .with_remaining_accounts(ctx.remaining_accounts.to_vec());

        mpl_bubblegum::cpi::transfer(
            cpi_ctx,
            root,
            data_hash,
            creator_hash,
            nonce,
            index,
        )?;

        msg!("Listing cancelled");
        Ok(())
    }
}

// ============================================
// ACCOUNTS & ERRORS
// ============================================

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct ListInvoice<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        init,
        payer = seller,
        space = 8 + 32 + 8 + 32 + 32 + 8 + 4 + 32 + 1, // Size calc
        seeds = [b"listing", seller.key().as_ref()], // Simplified seed for demo
        bump
    )]
    pub listing_state: Account<'info, ListingState>,

    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// CHECK: Merkle tree
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    pub currency_mint: Box<Account<'info, r#token::Mint>>,

    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub bubblegum_program: Program<'info, MplBubblegum>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyInvoice<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut, 
        seeds = [b"listing", listing_state.seller.key().as_ref()], 
        bump = listing_state.bump,
        close = seller // Close account/rent to seller? Or buyer? usually seller gets rent back or platform
    )]
    pub listing_state: Account<'info, ListingState>,

    /// CHECK: Seller address matched in state
    #[account(mut, address = listing_state.seller)]
    pub seller: SystemAccount<'info>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub currency_mint: Account<'info, r#token::Mint>,
    
    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_authority: UncheckedAccount<'info>,
    
    /// CHECK: Merkle tree
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub bubblegum_program: Program<'info, MplBubblegum>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", seller.key().as_ref()],
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

    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub bubblegum_program: Program<'info, MplBubblegum>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ListingState {
    pub seller: Pubkey,
    pub price: u64,
    pub currency_mint: Pubkey,
    pub asset_id: Pubkey, // Merkle Tree
    pub nonce: u64,
    pub index: u32,
    pub root: [u8; 32],
    pub bump: u8,
}

#[error_code]
pub enum MarketplaceError {
    #[msg("Funds insufficient for purchase")]
    InsufficientFunds,
    #[msg("Currency mint mismatch")]
    WrongCurrency,
}
