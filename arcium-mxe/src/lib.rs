use anchor_lang::prelude::*;

declare_id!("GSu3xPJNeyG2sVbn9GbZg4CHfzzUwLbYLaxzN7cbS3x");

#[program]
pub mod arcium_mxe {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let mxe_account = &mut ctx.accounts.mxe_account;
        
        mxe_account.cluster = Some(1);
        mxe_account.mxe_program_id = *ctx.program_id;
        mxe_account.authority = Some(ctx.accounts.authority.key());
        
        let mock_x25519 = [
            181, 219, 237, 246, 226, 219, 140, 19, 222, 189, 23, 14, 218, 116, 241, 19, 
            201, 240, 169, 141, 38, 77, 197, 161, 14, 232, 155, 141, 163, 204, 18, 148
        ];

        let pubkeys = UtilityPubkeys {
            x25519_pubkey: mock_x25519,
            ed25519_verifying_key: [0u8; 32],
            elgamal_pubkey: [0u8; 32],
            pubkey_validity_proof: [0u8; 64],
        };

        mxe_account.utility_pubkeys = SetUnset::Set(pubkeys);
        mxe_account.fallback_clusters = vec![];
        mxe_account.rejected_clusters = vec![];
        mxe_account.computation_definitions = vec![];
        mxe_account.bump = bump;

        msg!("MXE V2.0 INITIALIZED");
        Ok(())
    }

    pub fn execute_confidential_transfer(_ctx: Context<ExecuteTransfer>, encrypted_payload: Vec<u8>) -> Result<()> {
        msg!("Arcium MXE: Deep Privacy Transfer Requested");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"MXEAccount", crate::ID.as_ref()],
        bump,
        payer = authority,
        space = 8 + 1000
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTransfer<'info> {
    /// CHECK: This is safe
    #[account(signer)]
    pub authority: AccountInfo<'info>,
}

// --------------------------------------------------------
// Data Structures matching Arcium SDK Expectation Exactly
// --------------------------------------------------------

#[account]
pub struct MXEAccount {
    pub cluster: Option<u32>,
    pub mxe_program_id: Pubkey,
    pub authority: Option<Pubkey>,
    pub utility_pubkeys: SetUnset<UtilityPubkeys>,
    pub fallback_clusters: Vec<u32>,
    pub rejected_clusters: Vec<u32>,
    pub computation_definitions: Vec<u32>, // Added to match IDL
    pub bump: u8, 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct UtilityPubkeys {
    pub x25519_pubkey: [u8; 32],
    pub ed25519_verifying_key: [u8; 32],
    pub elgamal_pubkey: [u8; 32],
    pub pubkey_validity_proof: [u8; 64],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum SetUnset<T> {
    Set(T),
    Unset(T, Vec<bool>),
}
