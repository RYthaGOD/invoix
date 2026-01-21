use anchor_lang::prelude::*;
use instructions::*;

pub mod state;
pub mod instructions;
pub mod errors;

declare_id!("F8XqbBJaKzpF5CWqmXR6uqutZ9HcNuiQAo7o5XgSYXrE");

#[program]
pub mod marketplace_program {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// List an Invoice (cNFT) for sale
    pub fn list_invoice<'info>(
        ctx: Context<'_, '_, '_, 'info, ListInvoice<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        price: u64,
    ) -> Result<()> {
        instructions::list::list_invoice(ctx, root, data_hash, creator_hash, nonce, index, price)
    }

    /// Buy an Invoice
    pub fn buy_invoice<'info>(
        ctx: Context<'_, '_, '_, 'info, BuyInvoice<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        instructions::buy::buy_invoice(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Cancel Listing
    pub fn cancel_listing<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelListing<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        instructions::cancel::cancel_listing(ctx, root, data_hash, creator_hash, nonce, index)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
