use anchor_lang::prelude::*;

/// Tracks the last time a specific node claimed a specific campaign.
/// Seeded by [COOLDOWN_SEED, campaign.key(), node.key()].
#[account]
#[derive(InitSpace)]
pub struct ClaimCooldown {
    pub campaign: Pubkey,
    pub node: Pubkey,
    pub last_claimed_at: i64,
    pub bump: u8,
}
