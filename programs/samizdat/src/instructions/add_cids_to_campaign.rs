use crate::errors::SamizdatError;
use crate::state::{
    CampaignAccount, CampaignStatus, PublisherAccount, CAMPAIGN_SEED, MAX_CIDS, MAX_CID_LENGTH,
    PUBLISHER_SEED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AddCidsToCampaign<'info> {
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, publisher_account.key().as_ref(), &campaign_account.campaign_id.to_le_bytes()],
        bump = campaign_account.bump,
        has_one = publisher_account @ SamizdatError::PublisherMismatch,
    )]
    pub campaign_account: Account<'info, CampaignAccount>,

    #[account(
        seeds = [PUBLISHER_SEED, authority.key().as_ref()],
        bump = publisher_account.bump,
        has_one = authority @ SamizdatError::Unauthorized,
    )]
    pub publisher_account: Account<'info, PublisherAccount>,

    pub authority: Signer<'info>,
}

pub fn process_add_cids_to_campaign(
    ctx: Context<AddCidsToCampaign>,
    new_cids: Vec<String>,
) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign_account;

    require!(
        campaign.status == CampaignStatus::Active,
        SamizdatError::CampaignNotActive
    );
    require!(
        campaign.cids.len() + new_cids.len() <= MAX_CIDS,
        SamizdatError::TooManyCids
    );
    for cid in &new_cids {
        require!(
            !cid.is_empty() && cid.len() <= MAX_CID_LENGTH,
            SamizdatError::InvalidCid
        );
    }

    campaign.cids.extend(new_cids);

    Ok(())
}
