use super::shared::{CampaignStatus, TargetFilters, MAX_CIDS, MAX_CID_LENGTH};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CampaignAccount {
    pub publisher_account: Pubkey,
    pub campaign_id: u64,
    #[max_len(MAX_CIDS, MAX_CID_LENGTH)]
    pub cids: Vec<String>,
    pub bounty_per_play: u64,
    pub plays_remaining: u64,
    pub plays_completed: u64,
    pub tag_mask: u64,
    pub target_filters: TargetFilters,
    pub status: CampaignStatus,
    /// Minimum seconds between consecutive claims by the same node
    pub claim_cooldown: i64,
    pub created_at: i64,
    pub bump: u8,
}
