use anchor_lang::prelude::*;

#[error_code]
pub enum SamizdatError {
    #[msg("Invalid campaign ID")]
    InvalidCampaignId,

    #[msg("Too many CIDs (max 10)")]
    TooManyCids,

    #[msg("Bounty per play must be > 0")]
    InvalidBounty,

    #[msg("Total plays must be > 0")]
    InvalidPlays,

    #[msg("Campaign has no plays remaining")]
    NoPlaysRemaining,

    #[msg("Insufficient vault balance")]
    InsufficientFunds,

    #[msg("Node does not match target filters")]
    TargetMismatch,

    #[msg("Content violates node filters")]
    ContentFilterViolation,

    #[msg("Existing unclaimed play record")]
    ExistingClaim,

    #[msg("Play record not in claimed status")]
    InvalidPlayStatus,

    #[msg("Confirmation timeout not yet expired")]
    TimeoutNotExpired,

    #[msg("Confirmation timeout has expired")]
    TimeoutExpired,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Campaign is not active")]
    CampaignNotActive,

    #[msg("Node is not active")]
    NodeNotActive,

    #[msg("Publisher is not active")]
    PublisherNotActive,

    #[msg("Publisher account does not match")]
    PublisherMismatch,

    #[msg("Invalid CID: empty or exceeds max length")]
    InvalidCid,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Invalid CID index")]
    InvalidCidIndex,

    #[msg("Invalid status transition")]
    InvalidStatusTransition,

    #[msg("Node must wait for cooldown before claiming this campaign again")]
    CooldownNotExpired,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
