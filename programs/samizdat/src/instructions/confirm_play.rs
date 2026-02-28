use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, NodeAccount, PlayRecord, PlayStatus, PublisherAccount, CAMPAIGN_SEED,
    NODE_ACCOUNT_SEED, PLAY_RECORD_SEED, PLAY_TIMEOUT_SECONDS, PUBLISHER_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ConfirmPlay<'info> {
    #[account(
        mut,
        seeds = [
            PLAY_RECORD_SEED,
            campaign_account.key().as_ref(),
            node_account.key().as_ref(),
            &play_record.nonce.to_le_bytes(),
        ],
        bump = play_record.bump,
        has_one = campaign_account,
        has_one = node_account,
    )]
    pub play_record: Account<'info, PlayRecord>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign_account.publisher_account.as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
        has_one = publisher_account @ SamizdatError::PublisherMismatch,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,

    #[account(
        mut,
        seeds = [PUBLISHER_SEED, publisher_account.authority.as_ref()],
        bump = publisher_account.bump,
    )]
    pub publisher_account: Account<'info, PublisherAccount>,

    #[account(
        mut,
        seeds = [NODE_ACCOUNT_SEED, authority.key().as_ref(), &node_account.node_id.to_le_bytes()],
        bump = node_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub node_account: Account<'info, NodeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn process_confirm_play(ctx: Context<ConfirmPlay>) -> Result<()> {
    let play_record = &ctx.accounts.play_record;

    // Validate play status
    require!(
        play_record.status == PlayStatus::Claimed,
        SamizdatError::InvalidPlayStatus
    );

    // Validate within timeout window
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp <= play_record.claimed_at + PLAY_TIMEOUT_SECONDS,
        SamizdatError::TimeoutExpired
    );

    let bounty = ctx.accounts.campaign_account.bounty_per_play;

    // Transfer lamports from campaign PDA to operator wallet
    let campaign_info = ctx.accounts.campaign_account.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();
    **campaign_info.try_borrow_mut_lamports()? -= bounty;
    **authority_info.try_borrow_mut_lamports()? += bounty;

    // Update PlayRecord
    let play_record = &mut ctx.accounts.play_record;
    play_record.status = PlayStatus::Paid;
    play_record.confirmed_at = clock.unix_timestamp;
    play_record.payment_amount = bounty;

    // Update CampaignAccount
    let campaign = &mut ctx.accounts.campaign_account;
    campaign.plays_completed = campaign
        .plays_completed
        .checked_add(1)
        .ok_or(SamizdatError::ArithmeticOverflow)?;

    // Update NodeAccount
    let node = &mut ctx.accounts.node_account;
    node.total_plays = node
        .total_plays
        .checked_add(1)
        .ok_or(SamizdatError::ArithmeticOverflow)?;
    node.total_earnings = node
        .total_earnings
        .checked_add(bounty)
        .ok_or(SamizdatError::ArithmeticOverflow)?;

    // Update PublisherAccount
    let publisher = &mut ctx.accounts.publisher_account;
    publisher.total_spent = publisher
        .total_spent
        .checked_add(bounty)
        .ok_or(SamizdatError::ArithmeticOverflow)?;

    Ok(())
}
