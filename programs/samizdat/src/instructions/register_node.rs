use crate::state::{
    GeoLocation, NodeAccount, NodeStatus, Resolution, ScreenSize, NODE_ACCOUNT_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(node_id: u64)]
pub struct RegisterNode<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + NodeAccount::INIT_SPACE,
        seeds = [NODE_ACCOUNT_SEED, authority.key().as_ref(), &node_id.to_le_bytes()],
        bump,
    )]
    pub node_account: Account<'info, NodeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_register_node(
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
    let node = &mut ctx.accounts.node_account;
    node.authority = ctx.accounts.authority.key();
    node.node_id = node_id;
    node.location = location;
    node.screen_size = screen_size;
    node.resolution = resolution;
    node.landmarks = landmarks;
    node.blocked_tag_mask = blocked_tag_mask;
    node.estimated_footfall = estimated_footfall;
    node.establishment_type = establishment_type;
    node.total_plays = 0;
    node.total_earnings = 0;
    node.registered_at = Clock::get()?.unix_timestamp;
    node.status = NodeStatus::Active;
    node.bump = ctx.bumps.node_account;
    Ok(())
}
