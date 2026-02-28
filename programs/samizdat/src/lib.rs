use anchor_lang::prelude::*;

pub mod definitions;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{CampaignStatus, GeoLocation, NodeStatus, Resolution, ScreenSize, TargetFilters};

declare_id!("EdiAD6MqML7e4DnfR85Pdbj15m7zyQqGaM8koJhGQq1j");

#[program]
pub mod samizdat {
    use super::*;

    // Publisher Instructions
    pub fn register_publisher(ctx: Context<RegisterPublisher>) -> Result<()> {
        instructions::process_register_publisher(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        cids: Vec<String>,
        bounty_per_play: u64,
        total_plays: u64,
        tag_mask: u64,
        target_filters: TargetFilters,
        claim_cooldown: i64,
    ) -> Result<()> {
        instructions::process_create_campaign(
            ctx,
            campaign_id,
            cids,
            bounty_per_play,
            total_plays,
            tag_mask,
            target_filters,
            claim_cooldown,
        )
    }

    pub fn fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
        instructions::process_fund_campaign(ctx, amount)
    }

    pub fn update_campaign(
        ctx: Context<UpdateCampaign>,
        tag_mask: Option<u64>,
        target_filters: Option<TargetFilters>,
        status: Option<CampaignStatus>,
    ) -> Result<()> {
        instructions::process_update_campaign(ctx, tag_mask, target_filters, status)
    }

    pub fn add_cids_to_campaign(
        ctx: Context<AddCidsToCampaign>,
        new_cids: Vec<String>,
    ) -> Result<()> {
        instructions::process_add_cids_to_campaign(ctx, new_cids)
    }

    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        instructions::process_close_campaign(ctx)
    }

    // Operator Instructions
    #[allow(clippy::too_many_arguments)]
    pub fn register_node(
        ctx: Context<RegisterNode>,
        node_id: u64,
        location: GeoLocation,
        screen_size: ScreenSize,
        resolution: Resolution,
        landmarks: Vec<String>,
        blocked_tag_mask: u64,
        estimated_footfall: u32,
        establishment_type: String,
    ) -> Result<()> {
        instructions::process_register_node(
            ctx,
            node_id,
            location,
            screen_size,
            resolution,
            landmarks,
            blocked_tag_mask,
            estimated_footfall,
            establishment_type,
        )
    }

    pub fn update_node_metadata(
        ctx: Context<UpdateNodeMetadata>,
        location: Option<GeoLocation>,
        estimated_footfall: Option<u32>,
        blocked_tag_mask: Option<u64>,
        status: Option<NodeStatus>,
    ) -> Result<()> {
        instructions::process_update_node_metadata(
            ctx,
            location,
            estimated_footfall,
            blocked_tag_mask,
            status,
        )
    }

    // Play Cycle Instructions
    pub fn claim_campaign(
        ctx: Context<ClaimCampaign>,
        cid_index: u8,
        claim_nonce: i64,
    ) -> Result<()> {
        instructions::process_claim_campaign(ctx, cid_index, claim_nonce)
    }

    pub fn confirm_play(ctx: Context<ConfirmPlay>) -> Result<()> {
        instructions::process_confirm_play(ctx)
    }

    // Public Instructions
    pub fn timeout_play(ctx: Context<TimeoutPlay>) -> Result<()> {
        instructions::process_timeout_play(ctx)
    }
}
