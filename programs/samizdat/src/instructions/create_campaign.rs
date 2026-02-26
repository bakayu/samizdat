use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, PublisherAccount, PublisherStatus, TargetFilters,
    CAMPAIGN_SEED, MAX_CIDS, PUBLISHER_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + CampaignAccount::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, publisher_account.key().as_ref(), &campaign_id.to_le_bytes()],
        bump,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,

    #[account(
        mut,
        seeds = [PUBLISHER_SEED, authority.key().as_ref()],
        bump = publisher_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub publisher_account: Account<'info, PublisherAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    cids: Vec<String>,
    bounty_per_play: u64,
    total_plays: u64,
    tag_mask: u64,
    target_filters: TargetFilters,
) -> Result<()> {
    let publisher = &ctx.accounts.publisher_account;
    require!(
        publisher.status == PublisherStatus::Active,
        SamizdatError::PublisherNotActive
    );
    require!(
        !cids.is_empty() && cids.len() <= MAX_CIDS,
        SamizdatError::TooManyCids
    );
    require!(bounty_per_play > 0, SamizdatError::InvalidBounty);
    require!(total_plays > 0, SamizdatError::InvalidPlays);

    let campaign = &mut ctx.accounts.campaign_account;
    campaign.publisher_account = ctx.accounts.publisher_account.key();
    campaign.campaign_id = campaign_id;
    campaign.cids = cids;
    campaign.bounty_per_play = bounty_per_play;
    campaign.plays_remaining = total_plays;
    campaign.plays_completed = 0;
    campaign.tag_mask = tag_mask;
    campaign.target_filters = target_filters;
    campaign.status = CampaignStatus::Active;
    campaign.created_at = Clock::get()?.unix_timestamp;
    campaign.bump = ctx.bumps.campaign_account;

    let publisher = &mut ctx.accounts.publisher_account;
    publisher.total_campaigns = publisher.total_campaigns.checked_add(1).unwrap();

    Ok(())
}
