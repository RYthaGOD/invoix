use anchor_lang::prelude::*;

declare_id!("5qs2TBEvAUEJiUVj7XupdjVxz9UyAxSy6mEkRSGyDbqe");

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

    pub fn create_invoice(
        ctx: Context<CreateInvoice>,
        invoice_id: Vec<u8>,
        amount: u64,
        due_date: i64,
        content_hash: [u8; 32],
        asset_id: [u8; 32],
    ) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        invoice.authority = ctx.accounts.authority.key();
        invoice.payer = ctx.accounts.payer.key();
        invoice.mint = ctx.accounts.mint.key();
        invoice.amount = amount;
        invoice.due_date = due_date;
        invoice.status = InvoiceStatus::Draft;
        invoice.content_hash = content_hash;
        invoice.asset_id = asset_id; // Store link to cNFT

        invoice.delegate = Pubkey::default(); // Initialize empty delegate
        invoice.bump = ctx.bumps.invoice;
        // encrypted_fields initialized as empty for now
        invoice.encrypted_fields = vec![];
        
        emit!(InvoiceCreated {
            invoice: invoice.key(),
            authority: invoice.authority,
            amount,
            invoice_id: invoice_id.clone(),
            asset_id,
        });

        msg!("Invoice Created on-chain: Amount {}, Asset Linked", amount);
        Ok(())
    }

    pub fn lock_invoice(ctx: Context<LockInvoice>, delegate: Pubkey) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        // Strict state check
        require!(
            invoice.status == InvoiceStatus::Draft || 
            invoice.status == InvoiceStatus::Sent || 
            invoice.status == InvoiceStatus::Unpaid,
            MxeError::InvalidStateTransition
        );
        invoice.status = InvoiceStatus::Locked;
        invoice.delegate = delegate; // Set the Marketplace PDA as delegate
        msg!("Invoice Locked (Listed) with Delegate: {}", delegate);
        Ok(())
    }

    pub fn unlock_invoice(ctx: Context<LockInvoice>) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        require!(invoice.status == InvoiceStatus::Locked, MxeError::InvalidStateTransition);
        
        invoice.status = InvoiceStatus::Unpaid;
        invoice.delegate = Pubkey::default(); // Clear delegate
        msg!("Invoice Unlocked (Delisted)");
        Ok(())
    }

    pub fn complete_transfer(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        let authority_key = ctx.accounts.authority.key();
        
        // Security Check: Who is authorizing this transfer?
        // 1. If Active/Draft/etc: The Owner (Authority) must sign.
        // 2. If Locked: The Delegate (Marketplace) must sign.
        
        if invoice.status == InvoiceStatus::Locked {
            // Case: Marketplace Trade
            require!(
                invoice.delegate == authority_key,
                MxeError::Unauthorized // Only Delegate can transfer a Locked invoice
            );
            // Note: We don't need to check is_signer because 'authority' is defined as Signer<'info> in struct
        } else {
            // Case: Standard Transfer
            require!(
                invoice.authority == authority_key,
                MxeError::Unauthorized // Only Owner can transfer a non-locked invoice
            );
        }

        invoice.authority = new_authority;
        invoice.status = InvoiceStatus::Unpaid; // Default to Unpaid after transfer (Factoring success)
        invoice.delegate = Pubkey::default(); // Clear delegate upon transfer
        // Note: We keep status as Unpaid? Or Factored? 
        // Logic: "Factoring" usually means selling the unpaid invoice.
        // So the new owner holds an "Unpaid" invoice they hope to collect on.
        
        emit!(InvoiceTransferred {
            invoice: invoice.key(),
            old_authority: authority_key,
            new_authority: new_authority,
        });
        
        msg!("Invoice Transferred to {:?}", new_authority);
        Ok(())
    }

    pub fn mark_invoice_paid(ctx: Context<MarkPaid>) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        // Only Unpaid or Factored invoices can be paid
        require!(
            invoice.status == InvoiceStatus::Unpaid || 
            invoice.status == InvoiceStatus::Factored ||
            invoice.status == InvoiceStatus::Sent,
            MxeError::InvalidStateTransition
        );
        
        invoice.status = InvoiceStatus::Paid;
        msg!("Invoice Marked as PAID");
        Ok(())
    }

    pub fn create_subscription(
        ctx: Context<CreateSubscription>,
        subscription_id: Vec<u8>, // Seed for uniqueness
        amount_per_period: u64,
        frequency_seconds: i64,
        start_date: i64,
        asset_id: [u8; 32],
        total_periods: Option<u32>,
    ) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        sub.authority = ctx.accounts.authority.key();
        sub.payer = ctx.accounts.payer.key();
        sub.mint = ctx.accounts.mint.key();
        sub.amount_per_period = amount_per_period;
        sub.frequency_seconds = frequency_seconds;
        sub.start_date = start_date;
        sub.next_due_date = start_date + frequency_seconds;
        sub.total_periods = total_periods;
        sub.asset_id = asset_id;
        sub.status = SubscriptionStatus::Active;
        sub.delegate = Pubkey::default();
        sub.bump = ctx.bumps.subscription;
        
        msg!("Subscription Created: Frequency {}s, Amount {}", frequency_seconds, amount_per_period);
        Ok(())
    }

    pub fn lock_subscription(ctx: Context<LockSubscription>, delegate: Pubkey) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        require!(
            sub.status == SubscriptionStatus::Active,
            MxeError::InvalidStateTransition
        );
        sub.status = SubscriptionStatus::Locked;
        sub.delegate = delegate;
        msg!("Subscription Locked (Listed) with Delegate: {}", delegate);
        Ok(())
    }

    pub fn unlock_subscription(ctx: Context<LockSubscription>) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        require!(sub.status == SubscriptionStatus::Locked, MxeError::InvalidStateTransition);
        
        sub.status = SubscriptionStatus::Active;
        sub.delegate = Pubkey::default();
        msg!("Subscription Unlocked (Delisted)");
        Ok(())
    }

    pub fn transfer_subscription(ctx: Context<TransferSubscription>, new_authority: Pubkey) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        let signer = ctx.accounts.authority.key();
        
        // Auth Check: Signer must be Owner OR Delegate
        require!(
            signer == sub.authority || signer == sub.delegate,
            MxeError::Unauthorized
        );

        // State Check: If using Delegate, state MUST be Locked
        if signer == sub.delegate {
            require!(sub.status == SubscriptionStatus::Locked, MxeError::InvalidStateTransition);
        } else {
            // If Authority is signing, state MUST NOT be Locked (Prevent Rug Pull)
            require!(sub.status != SubscriptionStatus::Locked, MxeError::InvalidStateTransition);
        }

        let old_authority = sub.authority;
        sub.authority = new_authority;
        sub.status = SubscriptionStatus::Active;
        sub.delegate = Pubkey::default();

        emit!(SubscriptionTransferred {
            subscription: sub.key(),
            old_authority,
            new_authority,
        });
        
        msg!("Subscription Authority Transferred: {} -> {}", old_authority, new_authority);
        Ok(())
    }

    pub fn cancel_subscription(ctx: Context<CancelSubscription>) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        
        // Only Active or Locked (Listed) subscriptions can be cancelled? 
        // Logic: You can cancel whenever you are the authority. 
        // If Locked, you are the authority, so you can pull it effectively.
        // But if it's locked, maybe you should unlock first?
        // Let's allow cancelling from any state except already Cancelled.
        // Allow EITHER Authority OR Payer to cancel.
        let signer = ctx.accounts.authority.key();
        require!(
            signer == sub.authority || signer == sub.payer,
            MxeError::Unauthorized
        );

        // Prevent cancelling if already cancelled
        require!(sub.status != SubscriptionStatus::Cancelled, MxeError::InvalidStateTransition);

        sub.status = SubscriptionStatus::Cancelled;
        sub.delegate = Pubkey::default(); // Clear delegate if any

        emit!(SubscriptionCancelled {
            subscription: sub.key(),
            authority: ctx.accounts.authority.key(),
        });

        msg!("Subscription Cancelled");
        Ok(())
    }

    pub fn mint_invoice_from_subscription(
        ctx: Context<MintInvoiceFromSubscription>,
        invoice_id: Vec<u8>, // Unique ID for this specific invoice
        content_hash: [u8; 32],
        asset_id: [u8; 32], // The new cNFT for this specific invoice
    ) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        let invoice = &mut ctx.accounts.invoice;
        let clock = Clock::get()?;

        // Logic: Verify ownership or delegation logic? 
        // For now, only Authority (Service Provider) can mint the next invoice.
        // Future: Maybe the Marketplace (rights holder) can mint?
        
        invoice.authority = sub.authority; // Owner of subscription owns the invoice
        invoice.payer = sub.payer;
        invoice.mint = sub.mint;
        invoice.amount = sub.amount_per_period;
        invoice.due_date = sub.next_due_date;
        invoice.status = InvoiceStatus::Unpaid; // Created ready to send
        invoice.content_hash = content_hash;
        invoice.asset_id = asset_id;
        invoice.delegate = Pubkey::default();
        invoice.subscription_id = Some(sub.key()); // Link back!
        invoice.encrypted_fields = vec![];
        invoice.bump = ctx.bumps.invoice;

        // Security Check 1: Strip-Mining Prevention
        // Must be Active to mint. Cannot mint while Locked (Listed).
        require!(sub.status == SubscriptionStatus::Active, MxeError::InvalidStateTransition);

        // Security Check 2: Time-Travel Prevention
        // Current time must be past the due date
        // Use a small buffer (e.g. 60s) or strict equality? Strict >= is fine.
        require!(clock.unix_timestamp >= sub.next_due_date, MxeError::InvoiceNotDue);

        // Advance        // Update next due date (with overflow protection)
        sub.next_due_date = sub.next_due_date
            .checked_add(sub.frequency_seconds)
            .ok_or(MxeError::ArithmeticOverflow)?;

        // Decrement periods if applicable
        if let Some(periods) = sub.total_periods {
            if periods > 0 {
                sub.total_periods = Some(periods - 1);
            } else {
                return err!(MxeError::SubscriptionComplete);
            }
        }

        emit!(InvoiceCreated {
            invoice: invoice.key(),
            authority: invoice.authority,
            amount: invoice.amount,
            invoice_id: invoice_id,
            asset_id,
        });

        msg!("Recurring Invoice Minted from Subscription");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct LockInvoice<'info> {
    #[account(mut, has_one = authority)]
    pub invoice: Account<'info, InvoiceAccount>,
    pub authority: Signer<'info>,
}


#[error_code]
pub enum MxeError {
    #[msg("Invalid Invoice State Transition")]
    InvalidStateTransition,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Subscription periods completed")]
    SubscriptionComplete,
    #[msg("Invoice is not yet due")]
    InvoiceNotDue,
    #[msg("Arithmetic overflow detected")]
    ArithmeticOverflow,
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

#[derive(Accounts)]
#[instruction(invoice_id: Vec<u8>)]
pub struct CreateInvoice<'info> {
    #[account(
        init,
        seeds = [b"invoice", authority.key().as_ref(), invoice_id.as_slice()],
        bump,
        payer = authority,
        space = 300 // Safe buffer for InvoiceAccount (requires ~255 bytes)
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The customer wallet (payer of the invoice)
    pub payer: AccountInfo<'info>,

    /// CHECK: The currency mint
    pub mint: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub invoice: Account<'info, InvoiceAccount>,
    pub authority: Signer<'info>, // Can be Authority OR Delegate (if Locked)
}

#[derive(Accounts)]
pub struct MarkPaid<'info> {
    #[account(mut, has_one = authority)]
    pub invoice: Account<'info, InvoiceAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct LockSubscription<'info> {
    #[account(mut, has_one = authority)]
    pub subscription: Account<'info, SubscriptionAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferSubscription<'info> {
    #[account(mut)] // No has_one to allow delegate signing
    pub subscription: Account<'info, SubscriptionAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(subscription_id: Vec<u8>)]
pub struct CreateSubscription<'info> {
    #[account(
        init,
        seeds = [b"subscription", authority.key().as_ref(), subscription_id.as_slice()],
        bump,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 5 + 32 + 1 + 32 + 1 // +1 status +32 delegate
    )]
    pub subscription: Account<'info, SubscriptionAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Customer
    pub payer: AccountInfo<'info>,
    /// CHECK: Mint
    pub mint: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelSubscription<'info> {
    #[account(mut)] // Removed has_one = authority to allow Payer to sign
    pub subscription: Account<'info, SubscriptionAccount>,
    pub authority: Signer<'info>, // Can be Authority OR Payer
}

#[derive(Accounts)]
#[instruction(invoice_id: Vec<u8>)]
pub struct MintInvoiceFromSubscription<'info> {
    #[account(mut, has_one = authority)]
    pub subscription: Account<'info, SubscriptionAccount>,

    #[account(
        init,
        seeds = [b"invoice", authority.key().as_ref(), invoice_id.as_slice()],
        bump,
        payer = authority,
        space = 300 // Safe buffer for InvoiceAccount (requires ~255 bytes)
    )]
    pub invoice: Account<'info, InvoiceAccount>,

    #[account(mut)]
    pub authority: Signer<'info>, // Must be subscription owner

    pub system_program: Program<'info, System>,
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

// --------------------------------------------------------
// Invoice Marketplace
// --------------------------------------------------------

#[account]
pub struct InvoiceAccount {
    pub authority: Pubkey,  // Business Issuer
    pub payer: Pubkey,      // Customer
    pub mint: Pubkey,       // Currency (e.g. USDC)
    pub amount: u64,
    pub due_date: i64,
    pub status: InvoiceStatus,
    pub content_hash: [u8; 32], // Integrity check
    pub asset_id: [u8; 32], // Link to cNFT (Marketplace)
    pub delegate: Pubkey, // Marketplace PDA
    pub encrypted_fields: Vec<u8>, // Future Arcium Integration
    pub subscription_id: Option<Pubkey>, // Link to Parent Subscription (Recurring Economy)
    pub bump: u8,
}

#[account]
pub struct SubscriptionAccount {
    pub authority: Pubkey,      // Service Provider (Seller)
    pub payer: Pubkey,          // Customer (Buyer)
    pub mint: Pubkey,           // Currency Mint
    pub amount_per_period: u64, // Cost per invoice
    pub frequency_seconds: i64, // e.g. 2592000 for 30 days
    pub start_date: i64,        // Subscription start
    pub next_due_date: i64,     // Next invoice target
    pub total_periods: Option<u32>, // Max periods (if fixed term)
    pub asset_id: [u8; 32],     // Master NFT for this Subscription
    pub status: SubscriptionStatus, // Tradability state
    pub delegate: Pubkey,       // Marketplace PDA (when listed)
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum SubscriptionStatus {
    Active,     // Normal state, owner can mint invoices
    Paused,     // Temporarily halted
    Cancelled,  // Permanently ended
    Locked,     // Listed on marketplace (tradable)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Unpaid,
    Paid,
    Cancelled,
    Factored, 
    Locked,
}

// --------------------------------------------------------
// Events
// --------------------------------------------------------

#[event]
pub struct InvoiceCreated {
    pub invoice: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub invoice_id: Vec<u8>,
    pub asset_id: [u8; 32],
}

#[event]
pub struct InvoiceTransferred {
    pub invoice: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct SubscriptionTransferred {
    pub subscription: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct SubscriptionCancelled {
    pub subscription: Pubkey,
    pub authority: Pubkey,
}
