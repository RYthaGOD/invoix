use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Funds insufficient for purchase")]
    InsufficientFunds,
    #[msg("Currency mint mismatch")]
    WrongCurrency,
    #[msg("Invalid Treasury Account")]
    InvalidTreasury,
    #[msg("Asset ID in Invoice does not match the provided Merkle Tree/Asset")]
    AssetMismatch,
}
