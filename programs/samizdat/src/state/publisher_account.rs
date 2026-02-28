use super::shared::PublisherStatus;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PublisherAccount {
    pub authority: Pubkey,
    pub total_campaigns: u64,
    pub total_spent: u64,
    pub registered_at: i64,
    pub status: PublisherStatus,
    pub bump: u8,
}
