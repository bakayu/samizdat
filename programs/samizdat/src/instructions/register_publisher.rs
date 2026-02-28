use crate::state::{PublisherAccount, PublisherStatus, PUBLISHER_SEED};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterPublisher<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PublisherAccount::INIT_SPACE,
        seeds = [PUBLISHER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub publisher_account: Account<'info, PublisherAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_register_publisher(ctx: Context<RegisterPublisher>) -> Result<()> {
    ctx.accounts.publisher_account.set_inner(PublisherAccount {
        authority: ctx.accounts.authority.key(),
        total_campaigns: 0,
        total_spent: 0,
        registered_at: Clock::get()?.unix_timestamp,
        status: PublisherStatus::Active,
        bump: ctx.bumps.publisher_account,
    });
    Ok(())
}
