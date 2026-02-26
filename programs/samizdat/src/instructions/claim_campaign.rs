use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, NodeAccount, NodeStatus, PlayRecord, PlayStatus,
    CAMPAIGN_SEED, NODE_ACCOUNT_SEED, PLAY_RECORD_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(cid_index: u8, claim_timestamp: i64)]
pub struct ClaimCampaign<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlayRecord::INIT_SPACE,
        seeds = [
            PLAY_RECORD_SEED,
            campaign_account.key().as_ref(),
            node_account.key().as_ref(),
            &claim_timestamp.to_le_bytes(),
        ],
        bump,
    )]
    pub play_record: Account<'info, PlayRecord>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign_account.publisher_account.as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,

    #[account(
        mut,
        seeds = [NODE_ACCOUNT_SEED, authority.key().as_ref(), &node_account.node_id.to_le_bytes()],
        bump = node_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub node_account: Account<'info, NodeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_claim_campaign(
    ctx: Context<ClaimCampaign>,
    cid_index: u8,
    claim_timestamp: i64,
) -> Result<()> {
    let campaign = &ctx.accounts.campaign_account;
    let node = &ctx.accounts.node_account;

    // Validate states
    require!(
        campaign.status == CampaignStatus::Active,
        SamizdatError::CampaignNotActive
    );
    require!(
        node.status == NodeStatus::Active,
        SamizdatError::NodeNotActive
    );
    require!(
        campaign.plays_remaining > 0,
        SamizdatError::NoPlaysRemaining
    );

    // Validate CID index
    require!(
        (cid_index as usize) < campaign.cids.len(),
        SamizdatError::InvalidCampaignId
    );

    // Validate vault has enough funds (excess lamports beyond rent-exempt minimum)
    let rent = Rent::get()?;
    let campaign_info = ctx.accounts.campaign_account.to_account_info();
    let rent_exempt_min = rent.minimum_balance(campaign_info.data_len());
    let vault_balance = campaign_info
        .lamports()
        .checked_sub(rent_exempt_min)
        .unwrap_or(0);
    require!(
        vault_balance >= campaign.bounty_per_play,
        SamizdatError::InsufficientFunds
    );

    // Decrement plays_remaining
    let campaign = &mut ctx.accounts.campaign_account;
    campaign.plays_remaining = campaign.plays_remaining.checked_sub(1).unwrap();

    // Initialize PlayRecord
    let play_record = &mut ctx.accounts.play_record;
    play_record.campaign_account = ctx.accounts.campaign_account.key();
    play_record.node_account = ctx.accounts.node_account.key();
    play_record.claimed_at = claim_timestamp;
    play_record.confirmed_at = 0;
    play_record.cid_index = cid_index;
    play_record.payment_amount = 0;
    play_record.status = PlayStatus::Claimed;
    play_record.bump = ctx.bumps.play_record;

    Ok(())
}
