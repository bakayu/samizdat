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

#[allow(clippy::too_many_arguments)]
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
    ctx.accounts.node_account.set_inner(NodeAccount {
        authority: ctx.accounts.authority.key(),
        node_id,
        location,
        screen_size,
        resolution,
        landmarks,
        blocked_tag_mask,
        estimated_footfall,
        establishment_type,
        total_plays: 0,
        total_earnings: 0,
        registered_at: Clock::get()?.unix_timestamp,
        status: NodeStatus::Active,
        bump: ctx.bumps.node_account,
    });
    Ok(())
}
