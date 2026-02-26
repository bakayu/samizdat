use crate::errors::SamizdatError;
use crate::state::{GeoLocation, NodeAccount, NodeStatus, NODE_ACCOUNT_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateNodeMetadata<'info> {
    #[account(
        mut,
        seeds = [NODE_ACCOUNT_SEED, authority.key().as_ref(), &node_account.node_id.to_le_bytes()],
        bump = node_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub node_account: Account<'info, NodeAccount>,

    pub authority: Signer<'info>,
}

pub fn process_update_node_metadata(
    ctx: Context<UpdateNodeMetadata>,
    location: Option<GeoLocation>,
    estimated_footfall: Option<u32>,
    blocked_tag_mask: Option<u64>,
    status: Option<NodeStatus>,
) -> Result<()> {
    let node = &mut ctx.accounts.node_account;

    if let Some(loc) = location {
        node.location = loc;
    }
    if let Some(footfall) = estimated_footfall {
        node.estimated_footfall = footfall;
    }
    if let Some(mask) = blocked_tag_mask {
        node.blocked_tag_mask = mask;
    }
    if let Some(s) = status {
        node.status = s;
    }

    Ok(())
}
