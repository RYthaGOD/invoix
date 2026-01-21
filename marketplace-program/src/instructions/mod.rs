use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use crate::state::BUBBLEGUM_PROGRAM_ID;

pub mod list;
pub mod buy;
pub mod cancel;

pub use list::*;
pub use buy::*;
pub use cancel::*;

pub fn get_sighash(name: &str) -> [u8; 8] {
    let preimage = format!("global:{}", name);
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&solana_program::hash::hash(preimage.as_bytes()).to_bytes()[..8]);
    sighash
}

/// Build raw Bubblegum Transfer instruction
/// Discriminator for "transfer" in Bubblegum is [163, 52, 200, 231, 140, 3, 69, 186]
pub fn build_bubblegum_transfer_ix(
    tree_authority: Pubkey,
    leaf_owner: Pubkey,
    leaf_delegate: Pubkey,
    new_leaf_owner: Pubkey,
    merkle_tree: Pubkey,
    log_wrapper: Pubkey,
    compression_program: Pubkey,
    system_program: Pubkey,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    remaining_accounts: Vec<AccountMeta>,
) -> Instruction {
    // Bubblegum transfer discriminator (anchor sighash of "global:transfer")
    let discriminator: [u8; 8] = [163, 52, 200, 231, 140, 3, 69, 186];
    
    let mut data = Vec::with_capacity(8 + 32 + 32 + 32 + 8 + 4);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&root);
    data.extend_from_slice(&data_hash);
    data.extend_from_slice(&creator_hash);
    data.extend_from_slice(&nonce.to_le_bytes());
    data.extend_from_slice(&index.to_le_bytes());
    
    let mut accounts = vec![
        AccountMeta::new_readonly(tree_authority, false),
        AccountMeta::new_readonly(leaf_owner, false),
        AccountMeta::new_readonly(leaf_delegate, true), // Signer
        AccountMeta::new_readonly(new_leaf_owner, false),
        AccountMeta::new(merkle_tree, false),
        AccountMeta::new_readonly(log_wrapper, false),
        AccountMeta::new_readonly(compression_program, false),
        AccountMeta::new_readonly(system_program, false),
    ];
    
    // Add merkle proof accounts
    accounts.extend(remaining_accounts);
    
    Instruction {
        program_id: BUBBLEGUM_PROGRAM_ID,
        accounts,
        data,
    }
}
