use super::shared::{
    GeoLocation, NodeStatus, Resolution, ScreenSize, MAX_ESTABLISHMENT_TYPE_LENGTH, MAX_LANDMARKS,
    MAX_LANDMARK_LENGTH,
};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NodeAccount {
    pub authority: Pubkey,
    pub node_id: u64,
    pub location: GeoLocation,
    pub screen_size: ScreenSize,
    pub resolution: Resolution,
    #[max_len(MAX_LANDMARKS, MAX_LANDMARK_LENGTH)]
    pub landmarks: Vec<String>,
    pub blocked_tag_mask: u64,
    pub estimated_footfall: u32,
    #[max_len(MAX_ESTABLISHMENT_TYPE_LENGTH)]
    pub establishment_type: String,
    pub total_plays: u64,
    pub total_earnings: u64,
    pub registered_at: i64,
    pub status: NodeStatus,
    pub bump: u8,
}
