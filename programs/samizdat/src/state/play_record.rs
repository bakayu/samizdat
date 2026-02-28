use super::shared::PlayStatus;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PlayRecord {
    pub campaign_account: Pubkey,
    pub node_account: Pubkey,
    pub nonce: i64,
    pub claimed_at: i64,
    pub confirmed_at: i64,
    pub cid_index: u8,
    pub payment_amount: u64,
    pub status: PlayStatus,
    pub bump: u8,
}
