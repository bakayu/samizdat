use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, ClaimCooldown, NodeAccount, NodeStatus, PlayRecord,
    PlayStatus, CAMPAIGN_SEED, COOLDOWN_SEED, NODE_ACCOUNT_SEED, PLAY_RECORD_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(cid_index: u8, claim_nonce: i64)]
pub struct ClaimCampaign<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlayRecord::INIT_SPACE,
        seeds = [
            PLAY_RECORD_SEED,
            campaign_account.key().as_ref(),
            node_account.key().as_ref(),
            &claim_nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub play_record: Account<'info, PlayRecord>,

    /// Tracks cooldown per (campaign, node) pair.
    /// Created on first claim, updated on subsequent claims.
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ClaimCooldown::INIT_SPACE,
        seeds = [
            COOLDOWN_SEED,
            campaign_account.key().as_ref(),
            node_account.key().as_ref(),
        ],
        bump,
    )]
    pub claim_cooldown: Account<'info, ClaimCooldown>,

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
    claim_nonce: i64,
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
        SamizdatError::InvalidCidIndex
    );

    // Validate content does not violate node's blocked tag policy
    require!(
        campaign.tag_mask & node.blocked_tag_mask == 0,
        SamizdatError::ContentFilterViolation
    );

    // Validate campaign target filters match this node
    let filters = &campaign.target_filters;
    if let Some(min) = filters.min_footfall {
        require!(
            node.estimated_footfall >= min,
            SamizdatError::TargetMismatch
        );
    }
    if let Some(max) = filters.max_footfall {
        require!(
            node.estimated_footfall <= max,
            SamizdatError::TargetMismatch
        );
    }
    if !filters.screen_sizes.is_empty() {
        require!(
            filters.screen_sizes.contains(&node.screen_size),
            SamizdatError::TargetMismatch
        );
    }
    if let Some(bounds) = filters.geo_bounds {
        require!(
            node.location.latitude >= bounds.min_lat
                && node.location.latitude <= bounds.max_lat
                && node.location.longitude >= bounds.min_lon
                && node.location.longitude <= bounds.max_lon,
            SamizdatError::TargetMismatch
        );
    }
    if !filters.establishment_types.is_empty() {
        require!(
            filters
                .establishment_types
                .contains(&node.establishment_type),
            SamizdatError::TargetMismatch
        );
    }
    if !filters.required_landmarks.is_empty() {
        for required in &filters.required_landmarks {
            require!(
                node.landmarks.contains(required),
                SamizdatError::TargetMismatch
            );
        }
    }

    // Validate vault has enough funds (excess lamports beyond rent-exempt minimum)
    let rent = Rent::get()?;
    let campaign_info = ctx.accounts.campaign_account.to_account_info();
    let rent_exempt_min = rent.minimum_balance(campaign_info.data_len());
    let vault_balance = campaign_info.lamports().saturating_sub(rent_exempt_min);
    require!(
        vault_balance >= campaign.bounty_per_play,
        SamizdatError::InsufficientFunds
    );

    // Enforce per-node cooldown
    let clock = Clock::get()?;
    let cooldown = &ctx.accounts.claim_cooldown;
    if cooldown.last_claimed_at > 0 {
        require!(
            clock.unix_timestamp >= cooldown.last_claimed_at + campaign.claim_cooldown,
            SamizdatError::CooldownNotExpired
        );
    }

    let campaign_key = ctx.accounts.campaign_account.key();
    let node_key = ctx.accounts.node_account.key();

    // Decrement plays_remaining
    let campaign = &mut ctx.accounts.campaign_account;
    campaign.plays_remaining = campaign.plays_remaining.checked_sub(1).unwrap();

    // Update cooldown tracker
    ctx.accounts.claim_cooldown.set_inner(ClaimCooldown {
        campaign: campaign_key,
        node: node_key,
        last_claimed_at: clock.unix_timestamp,
        bump: ctx.bumps.claim_cooldown,
    });

    // Initialize PlayRecord
    ctx.accounts.play_record.set_inner(PlayRecord {
        campaign_account: campaign_key,
        node_account: node_key,
        nonce: claim_nonce,
        claimed_at: clock.unix_timestamp,
        confirmed_at: 0,
        cid_index,
        payment_amount: 0,
        status: PlayStatus::Claimed,
        bump: ctx.bumps.play_record,
    });

    Ok(())
}
