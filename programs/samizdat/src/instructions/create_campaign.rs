use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, PublisherAccount, PublisherStatus, TargetFilters,
    CAMPAIGN_SEED, MAX_CIDS, MAX_CID_LENGTH, PUBLISHER_SEED,
};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

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

#[allow(clippy::too_many_arguments)]
pub fn process_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    cids: Vec<String>,
    bounty_per_play: u64,
    total_plays: u64,
    tag_mask: u64,
    target_filters: TargetFilters,
    claim_cooldown: i64,
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
    for cid in &cids {
        require!(
            !cid.is_empty() && cid.len() <= MAX_CID_LENGTH,
            SamizdatError::InvalidCid
        );
    }
    require!(bounty_per_play > 0, SamizdatError::InvalidBounty);
    require!(total_plays > 0, SamizdatError::InvalidPlays);
    require!(claim_cooldown >= 0, SamizdatError::InvalidAmount);

    // Publisher must fund the full budget at creation
    let required_funding = bounty_per_play
        .checked_mul(total_plays)
        .ok_or(SamizdatError::ArithmeticOverflow)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.campaign_account.to_account_info(),
            },
        ),
        required_funding,
    )?;

    let clock = Clock::get()?;
    let publisher_key = ctx.accounts.publisher_account.key();

    ctx.accounts.campaign_account.set_inner(CampaignAccount {
        publisher_account: publisher_key,
        campaign_id,
        cids,
        bounty_per_play,
        plays_remaining: total_plays,
        plays_completed: 0,
        tag_mask,
        target_filters,
        status: CampaignStatus::Active,
        claim_cooldown,
        created_at: clock.unix_timestamp,
        bump: ctx.bumps.campaign_account,
    });

    let publisher = &mut ctx.accounts.publisher_account;
    publisher.total_campaigns = publisher.total_campaigns.checked_add(1).unwrap();

    Ok(())
}
