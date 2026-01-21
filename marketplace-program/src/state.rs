use anchor_lang::prelude::*;

// Security: Protocol Treasury Wallet
// "B4ReZfuB8WSJMepHAu9WnV6sHPChJsD9BtwbMwSuLzkS"
pub const TREASURY_WALLET: Pubkey = pubkey!("B4ReZfuB8WSJMepHAu9WnV6sHPChJsD9BtwbMwSuLzkS");

pub const ARCIUM_PROGRAM_ID: Pubkey = pubkey!("5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe");
pub const BUBBLEGUM_PROGRAM_ID: Pubkey = pubkey!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

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

// Mirrors the layout of the InvoiceAccount in arcium-mxe for validation
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InvoiceAccountMirror {
    pub authority: Pubkey,
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub due_date: i64,
    pub status: u8, // Enum is serialized as u8
    pub content_hash: [u8; 32],
    pub asset_id: [u8; 32],
    pub delegate: Pubkey,
    pub encrypted_fields: Vec<u8>,
    pub subscription_id: Option<Pubkey>,
    pub bump: u8,
}
