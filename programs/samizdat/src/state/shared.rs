use anchor_lang::prelude::*;

// PDA Seeds
pub const PUBLISHER_SEED: &[u8] = b"publisher";
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const NODE_ACCOUNT_SEED: &[u8] = b"node_account";
pub const PLAY_RECORD_SEED: &[u8] = b"play_record";
pub const COOLDOWN_SEED: &[u8] = b"cooldown";

// Content Tag Bitmask
// Protocol-level content categories.
// Advertisers SET these on AdAccount.tag_mask.
// Renderers use self defined policy to BLOCK matching bits.
//
// To check overlap:  ad.tag_mask & policy_blocked_mask != 0  → skip
// To check match:    ad.tag_mask & policy_required_mask == policy_required_mask → show
//
// Reserve bit 0–15 for PoC categories.
// Bits 16–63 reserved for future protocol upgrades.
pub const TAG_NONE: u64 = 0;
pub const TAG_CRYPTO: u64 = 1 << 0;
pub const TAG_BETTING: u64 = 1 << 1;
pub const TAG_NSFW: u64 = 1 << 2;
pub const TAG_POLITICAL: u64 = 1 << 3;
pub const TAG_ALCOHOL: u64 = 1 << 4;

// Play Confirmation Timeout (seconds)
pub const PLAY_TIMEOUT_SECONDS: i64 = 300;

// Size Limits
pub const MAX_CIDS: usize = 10;
pub const MAX_CID_LENGTH: usize = 200;
pub const MAX_LANDMARKS: usize = 5;
pub const MAX_LANDMARK_LENGTH: usize = 32;
pub const MAX_SCREEN_SIZES: usize = 4;
pub const MAX_ESTABLISHMENT_TYPES: usize = 5;
pub const MAX_ESTABLISHMENT_TYPE_LENGTH: usize = 32;
pub const MAX_REQUIRED_LANDMARKS: usize = 5;
pub const MAX_REQUIRED_LANDMARK_LENGTH: usize = 32;

// Enums

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PublisherStatus {
    Active,
    Suspended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    Active,
    Paused,
    Depleted,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum NodeStatus {
    Active,
    Offline,
    Suspended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PlayStatus {
    Claimed,
    Paid,
    TimedOut,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ScreenSize {
    Small,
    Medium,
    Large,
    XLarge,
}

// Structs

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct GeoLocation {
    pub latitude: i64,  // degrees x 1e7 (e.g., 40.7128 -> 407128000)
    pub longitude: i64, // degrees x 1e7 (e.g., -74.0060 -> -740060000)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct GeoBounds {
    // x 1e7 fixed-points
    pub min_lat: i64,
    pub max_lat: i64,
    pub min_lon: i64,
    pub max_lon: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub struct TargetFilters {
    pub min_footfall: Option<u32>,
    pub max_footfall: Option<u32>,
    #[max_len(MAX_SCREEN_SIZES)]
    pub screen_sizes: Vec<ScreenSize>,
    pub geo_bounds: Option<GeoBounds>,
    #[max_len(MAX_ESTABLISHMENT_TYPES, MAX_ESTABLISHMENT_TYPE_LENGTH)]
    pub establishment_types: Vec<String>,
    #[max_len(MAX_REQUIRED_LANDMARKS, MAX_REQUIRED_LANDMARK_LENGTH)]
    pub required_landmarks: Vec<String>,
}
