use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, PublisherAccount, TargetFilters, CAMPAIGN_SEED, PUBLISHER_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateCampaign<'info> {
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

    pub authority: Signer<'info>,
}

pub fn process_update_campaign(
    ctx: Context<UpdateCampaign>,
    tag_mask: Option<u64>,
    target_filters: Option<TargetFilters>,
    status: Option<CampaignStatus>,
) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign_account;

    // Closed campaigns are immutable
    require!(
        campaign.status != CampaignStatus::Closed,
        SamizdatError::CampaignNotActive
    );

    if let Some(mask) = tag_mask {
        campaign.tag_mask = mask;
    }
    if let Some(filters) = target_filters {
        campaign.target_filters = filters;
    }
    if let Some(s) = status {
        // Closed is only set via close_campaign instruction
        require!(
            !matches!(s, CampaignStatus::Closed),
            SamizdatError::InvalidStatusTransition
        );
        campaign.status = s;
    }

    Ok(())
}
