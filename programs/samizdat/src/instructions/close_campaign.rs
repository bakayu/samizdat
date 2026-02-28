use crate::errors::SamizdatError;
use crate::state::{CampaignAccount, PublisherAccount, CAMPAIGN_SEED, PUBLISHER_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, publisher_account.key().as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
        has_one = publisher_account @ SamizdatError::PublisherMismatch,
        close = authority,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,

    #[account(
        seeds = [PUBLISHER_SEED, authority.key().as_ref()],
        bump = publisher_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub publisher_account: Account<'info, PublisherAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn process_close_campaign(_ctx: Context<CloseCampaign>) -> Result<()> {
    // MVP: No unclaimed PlayRecord check - just closes and returns funds
    // The `close = authority` constraint handles lamport transfer and account zeroing
    Ok(())
}
