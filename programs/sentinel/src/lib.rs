use anchor_lang::prelude::*;

pub mod errors;
pub mod state;

use errors::SentinelError;
use state::*;

declare_id!("3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK");

#[program]
pub mod sentinel {
    use super::*;

    /// Initializes a new autonomous portfolio agent account bound to the owner
    pub fn initialize_agent(
        ctx: Context<InitializeAgent>,
        agent_id: String,
        portfolio_id: String,
        agent_authority: Pubkey,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.owner = ctx.accounts.owner.key();
        agent.agent_authority = agent_authority;
        agent.agent_id = agent_id;
        agent.portfolio_id = portfolio_id;
        agent.is_active = true;
        agent.bump = ctx.bumps.agent;

        emit!(AgentInitializedEvent {
            owner: agent.owner,
            agent_authority: agent.agent_authority,
            agent_id: agent.agent_id.clone(),
        });
        Ok(())
    }

    /// Initializes the user's financial policy with machine-checkable guarantees
    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        max_single_asset_bps: u16,
        min_stablecoin_bps: u16,
        max_trade_value_usd: u64,
        max_slippage_bps: u16,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.owner = ctx.accounts.owner.key();
        policy.max_single_asset_bps = max_single_asset_bps;
        policy.min_stablecoin_bps = min_stablecoin_bps;
        policy.max_trade_value_usd = max_trade_value_usd;
        policy.max_slippage_bps = max_slippage_bps;
        policy.policy_version = 1;
        policy.is_active = true;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyUpdatedEvent {
            owner: policy.owner,
            version: policy.policy_version,
            max_single_asset_bps,
            min_stablecoin_bps,
            max_trade_value_usd,
            max_slippage_bps,
            is_active: true,
        });
        Ok(())
    }

    /// Updates existing policy constraints, incrementing policy version
    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        max_single_asset_bps: u16,
        min_stablecoin_bps: u16,
        max_trade_value_usd: u64,
        max_slippage_bps: u16,
        is_active: bool,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.max_single_asset_bps = max_single_asset_bps;
        policy.min_stablecoin_bps = min_stablecoin_bps;
        policy.max_trade_value_usd = max_trade_value_usd;
        policy.max_slippage_bps = max_slippage_bps;
        policy.is_active = is_active;
        policy.policy_version = policy.policy_version.checked_add(1).ok_or(SentinelError::MathOverflow)?;

        emit!(PolicyUpdatedEvent {
            owner: policy.owner,
            version: policy.policy_version,
            max_single_asset_bps,
            min_stablecoin_bps,
            max_trade_value_usd,
            max_slippage_bps,
            is_active,
        });
        Ok(())
    }

    /// Registers a state transition promise from an autonomous agent
    pub fn create_promise(
        ctx: Context<CreatePromise>,
        promise_id: String,
        intent_hash: [u8; 32],
        trade_asset_mint: Pubkey,
        trade_direction: u8,
        trade_amount_usd: u64,
    ) -> Result<()> {
        require!(ctx.accounts.policy.is_active, SentinelError::PolicyInactive);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.agent.agent_authority
                || ctx.accounts.authority.key() == ctx.accounts.agent.owner,
            SentinelError::UnauthorizedAgent
        );

        let promise = &mut ctx.accounts.promise;
        promise.promise_id = promise_id;
        promise.agent = ctx.accounts.agent.key();
        promise.policy = ctx.accounts.policy.key();
        promise.intent_hash = intent_hash;
        promise.trade_asset_mint = trade_asset_mint;
        promise.trade_direction = trade_direction;
        promise.trade_amount_usd = trade_amount_usd;
        promise.status = 1; // 1 = Promised
        promise.bump = ctx.bumps.promise;

        emit!(PromiseCreatedEvent {
            promise_id: promise.promise_id.clone(),
            agent: promise.agent,
            trade_asset_mint,
            trade_direction,
            trade_amount_usd,
        });
        Ok(())
    }

    /// Authoritatively evaluates financial postconditions at the transaction boundary.
    /// Reverts atomically if ANY postcondition is violated.
    pub fn execute_guarded_trade(
        ctx: Context<ExecuteGuardedTrade>,
        _pre_total_usd: u64,
        _pre_stable_usd: u64,
        post_target_usd: u64,
        post_total_usd: u64,
        post_stable_usd: u64,
        quoted_price_cents: u64,
        execution_price_cents: u64,
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;
        let promise = &mut ctx.accounts.promise;

        require!(policy.is_active, SentinelError::PolicyInactive);
        require!(promise.status == 1, SentinelError::InvalidPromiseStatus);

        // Core Postcondition Verification
        verify_postconditions(
            policy,
            promise.trade_amount_usd,
            post_target_usd,
            post_total_usd,
            post_stable_usd,
            quoted_price_cents,
            execution_price_cents,
        )?;

        // If postconditions satisfied, settle promise
        promise.status = 3; // 3 = Settled

        emit!(TradeSettledEvent {
            promise_id: promise.promise_id.clone(),
            post_total_usd,
            post_stable_usd,
            post_target_usd,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Anchors an immutable PROVN evidence record on-chain
    pub fn record_evidence(
        ctx: Context<RecordEvidence>,
        evidence_id: String,
        pre_state_hash: [u8; 32],
        post_state_hash: [u8; 32],
        verification_result: u8,
        failure_code: u16,
    ) -> Result<()> {
        let evidence = &mut ctx.accounts.evidence;
        evidence.evidence_id = evidence_id;
        evidence.promise = ctx.accounts.promise.key();
        evidence.pre_state_hash = pre_state_hash;
        evidence.post_state_hash = post_state_hash;
        evidence.verification_result = verification_result;
        evidence.failure_code = failure_code;
        evidence.timestamp = Clock::get()?.unix_timestamp;
        evidence.bump = ctx.bumps.evidence;

        emit!(EvidenceRecordedEvent {
            evidence_id: evidence.evidence_id.clone(),
            promise: evidence.promise,
            verification_result,
            failure_code,
            timestamp: evidence.timestamp,
        });

        Ok(())
    }
}

/// Pure deterministic postcondition verification function
pub fn verify_postconditions(
    policy: &PolicyAccount,
    trade_amount_usd: u64,
    post_target_usd: u64,
    post_total_usd: u64,
    post_stable_usd: u64,
    quoted_price_cents: u64,
    execution_price_cents: u64,
) -> Result<()> {
    require!(post_total_usd > 0, SentinelError::MathOverflow);

    // 1. Postcondition: Max trade size
    require!(
        trade_amount_usd <= policy.max_trade_value_usd,
        SentinelError::TradeSizeExceeded
    );

    // 2. Postcondition: Max single-asset exposure (in basis points)
    // post_target_usd * 10,000 / post_total_usd <= max_single_asset_bps
    let target_exposure_bps = (post_target_usd as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(post_total_usd as u128)
        .ok_or(SentinelError::MathOverflow)? as u16;

    require!(
        target_exposure_bps <= policy.max_single_asset_bps,
        SentinelError::ExposureExceeded
    );

    // 3. Postcondition: Min stablecoin reserve (in basis points)
    // post_stable_usd * 10,000 / post_total_usd >= min_stablecoin_bps
    let stablecoin_reserve_bps = (post_stable_usd as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(post_total_usd as u128)
        .ok_or(SentinelError::MathOverflow)? as u16;

    require!(
        stablecoin_reserve_bps >= policy.min_stablecoin_bps,
        SentinelError::StablecoinReserveBreached
    );

    // 4. Postcondition: Max slippage (if quoted price is specified)
    if quoted_price_cents > 0 && execution_price_cents > 0 {
        let price_diff = if execution_price_cents >= quoted_price_cents {
            execution_price_cents - quoted_price_cents
        } else {
            quoted_price_cents - execution_price_cents
        };

        let slippage_bps = (price_diff as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(quoted_price_cents as u128)
            .ok_or(SentinelError::MathOverflow)? as u16;

        require!(
            slippage_bps <= policy.max_slippage_bps,
            SentinelError::SlippageExceeded
        );
    }

    Ok(())
}

// -----------------------------------------------------------------------------
// Account Contexts
// -----------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct InitializeAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = AgentAccount::LEN,
        seeds = [b"agent", owner.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePolicy<'info> {
    #[account(
        init,
        payer = owner,
        space = PolicyAccount::LEN,
        seeds = [b"policy", owner.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, PolicyAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    #[account(
        mut,
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
        has_one = owner
    )]
    pub policy: Account<'info, PolicyAccount>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(promise_id: String)]
pub struct CreatePromise<'info> {
    #[account(
        init,
        payer = authority,
        space = PromiseAccount::LEN,
        seeds = [b"promise", agent.key().as_ref(), promise_id.as_bytes()],
        bump
    )]
    pub promise: Account<'info, PromiseAccount>,
    pub agent: Account<'info, AgentAccount>,
    pub policy: Account<'info, PolicyAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteGuardedTrade<'info> {
    #[account(
        mut,
        seeds = [b"promise", agent.key().as_ref(), promise.promise_id.as_bytes()],
        bump = promise.bump,
        has_one = agent,
        has_one = policy
    )]
    pub promise: Account<'info, PromiseAccount>,
    pub agent: Account<'info, AgentAccount>,
    pub policy: Account<'info, PolicyAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(evidence_id: String)]
pub struct RecordEvidence<'info> {
    #[account(
        init,
        payer = authority,
        space = EvidenceAccount::LEN,
        seeds = [b"evidence", promise.key().as_ref()],
        bump
    )]
    pub evidence: Account<'info, EvidenceAccount>,
    pub promise: Account<'info, PromiseAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

#[event]
pub struct AgentInitializedEvent {
    pub owner: Pubkey,
    pub agent_authority: Pubkey,
    pub agent_id: String,
}

#[event]
pub struct PolicyUpdatedEvent {
    pub owner: Pubkey,
    pub version: u32,
    pub max_single_asset_bps: u16,
    pub min_stablecoin_bps: u16,
    pub max_trade_value_usd: u64,
    pub max_slippage_bps: u16,
    pub is_active: bool,
}

#[event]
pub struct PromiseCreatedEvent {
    pub promise_id: String,
    pub agent: Pubkey,
    pub trade_asset_mint: Pubkey,
    pub trade_direction: u8,
    pub trade_amount_usd: u64,
}

#[event]
pub struct TradeSettledEvent {
    pub promise_id: String,
    pub post_total_usd: u64,
    pub post_stable_usd: u64,
    pub post_target_usd: u64,
    pub timestamp: i64,
}

#[event]
pub struct EvidenceRecordedEvent {
    pub evidence_id: String,
    pub promise: Pubkey,
    pub verification_result: u8,
    pub failure_code: u16,
    pub timestamp: i64,
}

// -----------------------------------------------------------------------------
// Rust Invariant Unit Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_policy() -> PolicyAccount {
        PolicyAccount {
            owner: Pubkey::default(),
            max_single_asset_bps: 2500, // 25.00%
            min_stablecoin_bps: 2000,   // 20.00%
            max_trade_value_usd: 10000, // $10,000
            max_slippage_bps: 100,      // 1.00%
            policy_version: 1,
            is_active: true,
            bump: 0,
        }
    }

    #[test]
    fn test_single_asset_exposure_boundary() {
        let policy = mock_policy();
        // 25.00% -> PASS ($25,000 on $100,000)
        let res_pass = verify_postconditions(&policy, 5000, 25000, 100000, 20000, 0, 0);
        assert!(res_pass.is_ok());

        // 25.01% -> FAIL ($25,010 on $100,000 = 2501 bps)
        let res_fail = verify_postconditions(&policy, 5000, 25010, 100000, 20000, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::ExposureExceeded));
    }

    #[test]
    fn test_stablecoin_reserve_boundary() {
        let policy = mock_policy();
        // 20.00% -> PASS ($20,000 on $100,000)
        let res_pass = verify_postconditions(&policy, 5000, 20000, 100000, 20000, 0, 0);
        assert!(res_pass.is_ok());

        // 19.99% -> FAIL ($19,990 on $100,000 = 1999 bps)
        let res_fail = verify_postconditions(&policy, 5000, 20000, 100000, 19990, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::StablecoinReserveBreached));
    }

    #[test]
    fn test_max_trade_size_boundary() {
        let policy = mock_policy();
        // $10,000 -> PASS
        let res_pass = verify_postconditions(&policy, 10000, 20000, 100000, 20000, 0, 0);
        assert!(res_pass.is_ok());

        // $10,001 -> FAIL
        let res_fail = verify_postconditions(&policy, 10001, 20000, 100000, 20000, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_bad_decision_rejected() {
        let policy = mock_policy();
        // Agent proposes $15,000 trade, pushing target to $35,000 (35%) and stablecoin to $10,000 (10%)
        // Should immediately fail on trade size ($15k > $10k)
        let res = verify_postconditions(&policy, 15000, 35000, 100000, 10000, 0, 0);
        assert_eq!(res.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_good_decision_settled() {
        let policy = mock_policy();
        // Agent proposes adapted $5,000 trade: target reaches $25,000 (25%), stablecoin stays $20,000 (20%)
        let res = verify_postconditions(&policy, 5000, 25000, 100000, 20000, 0, 0);
        assert!(res.is_ok());
    }
}
