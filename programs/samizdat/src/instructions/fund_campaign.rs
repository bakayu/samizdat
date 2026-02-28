use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, PublisherAccount, CAMPAIGN_SEED, PUBLISHER_SEED,
};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
pub struct FundCampaign<'info> {
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, publisher_account.key().as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
        has_one = publisher_account @ SamizdatError::PublisherMismatch,
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

    pub system_program: Program<'info, System>,
}

pub fn process_fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
    let campaign = &ctx.accounts.campaign_account;
    require!(
        campaign.status != CampaignStatus::Closed,
        SamizdatError::CampaignNotActive
    );
    require!(amount > 0, SamizdatError::InvalidAmount);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.campaign_account.to_account_info(),
            },
        ),
        amount,
    )?;

    // If the campaign was depleted, move it to Paused so the
    // publisher can review before manually reactivating.
    let campaign = &mut ctx.accounts.campaign_account;
    if campaign.status == CampaignStatus::Depleted {
        campaign.status = CampaignStatus::Paused;
    }

    Ok(())
}
