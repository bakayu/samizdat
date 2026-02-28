use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, PlayRecord, PlayStatus, CAMPAIGN_SEED, PLAY_RECORD_SEED, PLAY_TIMEOUT_SECONDS,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct TimeoutPlay<'info> {
    #[account(
        mut,
        seeds = [
            PLAY_RECORD_SEED,
            campaign_account.key().as_ref(),
            play_record.node_account.as_ref(),
            &play_record.nonce.to_le_bytes(),
        ],
        bump = play_record.bump,
        has_one = campaign_account,
    )]
    pub play_record: Account<'info, PlayRecord>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign_account.publisher_account.as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,
}

pub fn process_timeout_play(ctx: Context<TimeoutPlay>) -> Result<()> {
    let play_record = &ctx.accounts.play_record;

    // Validate play status
    require!(
        play_record.status == PlayStatus::Claimed,
        SamizdatError::InvalidPlayStatus
    );

    // Validate timeout has expired
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp > play_record.claimed_at + PLAY_TIMEOUT_SECONDS,
        SamizdatError::TimeoutNotExpired
    );

    // Restore plays_remaining
    let campaign = &mut ctx.accounts.campaign_account;
    campaign.plays_remaining = campaign.plays_remaining.checked_add(1).unwrap();

    // Update PlayRecord
    let play_record = &mut ctx.accounts.play_record;
    play_record.status = PlayStatus::TimedOut;

    Ok(())
}
