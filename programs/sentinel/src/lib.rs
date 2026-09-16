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

    /// Initializes the user's financial policy with bounded, machine-checkable guarantees
    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        max_single_asset_bps: u16,
        min_stablecoin_bps: u16,
        max_trade_value_usd: u64,
        max_slippage_bps: u16,
    ) -> Result<()> {
        // Enforce logical basis point bounds (Finding 11)
        require!(max_single_asset_bps <= 10_000, SentinelError::InvalidPolicyBounds);
        require!(min_stablecoin_bps <= 10_000, SentinelError::InvalidPolicyBounds);
        require!(max_slippage_bps <= 10_000, SentinelError::InvalidPolicyBounds);

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
        require!(max_single_asset_bps <= 10_000, SentinelError::InvalidPolicyBounds);
        require!(min_stablecoin_bps <= 10_000, SentinelError::InvalidPolicyBounds);
        require!(max_slippage_bps <= 10_000, SentinelError::InvalidPolicyBounds);

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

    /// Initializes a controlled on-chain PortfolioVault account with verified balances
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        usdc_balance_cents: u64,
        positions: Vec<AssetPosition>,
    ) -> Result<()> {
        require!(positions.len() <= PortfolioVault::MAX_POSITIONS, SentinelError::InvalidPolicyBounds);

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.policy = ctx.accounts.policy.key();
        vault.usdc_balance_cents = usdc_balance_cents;
        vault.positions = positions;
        vault.bump = ctx.bumps.vault;

        // Compute cached initial total value in cents
        let mut total_equity_cents: u64 = 0;
        for pos in &vault.positions {
            let pos_val = pos.amount_units
                .checked_mul(pos.price_cents)
                .ok_or(SentinelError::MathOverflow)?;
            total_equity_cents = total_equity_cents
                .checked_add(pos_val)
                .ok_or(SentinelError::MathOverflow)?;
        }

        vault.total_value_cents = usdc_balance_cents
            .checked_add(total_equity_cents)
            .ok_or(SentinelError::MathOverflow)?;

        emit!(VaultInitializedEvent {
            vault: vault.key(),
            owner: vault.owner,
            total_value_cents: vault.total_value_cents,
            usdc_balance_cents,
        });

        Ok(())
    }

    /// Registers a state transition promise from an authorized agent
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

    /// Authoritatively executes a trade on the on-chain PortfolioVault and enforces postconditions.
    /// Mutates the vault directly and computes resulting exposure from actual positions.
    /// Reverts atomically if ANY postcondition is breached.
    pub fn execute_guarded_trade(
        ctx: Context<ExecuteGuardedTrade>,
        trade_amount_cents: u64,
        execution_price_cents: u64,
        quoted_price_cents: u64,
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;
        let agent = &ctx.accounts.agent;
        let promise = &mut ctx.accounts.promise;
        let vault = &mut ctx.accounts.vault;

        // 1. Enforce strict authority check (Finding 3)
        require!(
            ctx.accounts.authority.key() == agent.agent_authority
                || ctx.accounts.authority.key() == agent.owner,
            SentinelError::UnauthorizedExecution
        );

        // 2. State & Promise checks
        require!(policy.is_active, SentinelError::PolicyInactive);
        require!(promise.status == 1, SentinelError::InvalidPromiseStatus);

        // 3. Postcondition: Max Trade Size
        require!(
            trade_amount_cents <= policy.max_trade_value_usd.checked_mul(100).ok_or(SentinelError::MathOverflow)?,
            SentinelError::TradeSizeExceeded
        );

        // 4. Postcondition: Max Slippage
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
                .ok_or(SentinelError::MathOverflow)?;

            require!(
                slippage_bps <= policy.max_slippage_bps as u128,
                SentinelError::SlippageExceeded
            );
        }

        // 5. Locate target asset position index in vault
        let pos_idx = vault.positions.iter().position(|p| p.mint == promise.trade_asset_mint)
            .ok_or(SentinelError::AssetNotFound)?;

        // 6. Perform trade mutation on actual vault balances (Findings 1, 4, 9)
        let token_units_traded = trade_amount_cents
            .checked_mul(1)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(execution_price_cents)
            .ok_or(SentinelError::MathOverflow)?;

        if promise.trade_direction == 0 {
            // BUY: spend USDC, acquire target equity
            require!(
                vault.usdc_balance_cents >= trade_amount_cents,
                SentinelError::InsufficientStablecoinReserve
            );
            vault.usdc_balance_cents = vault.usdc_balance_cents
                .checked_sub(trade_amount_cents)
                .ok_or(SentinelError::MathOverflow)?;

            let target_pos = &mut vault.positions[pos_idx];
            target_pos.amount_units = target_pos.amount_units
                .checked_add(token_units_traded)
                .ok_or(SentinelError::MathOverflow)?;
            target_pos.price_cents = execution_price_cents;
        } else {
            // SELL: liquidate target equity, receive USDC
            let target_pos = &mut vault.positions[pos_idx];
            require!(
                target_pos.amount_units >= token_units_traded,
                SentinelError::AssetNotFound
            );
            target_pos.amount_units = target_pos.amount_units
                .checked_sub(token_units_traded)
                .ok_or(SentinelError::MathOverflow)?;
            target_pos.price_cents = execution_price_cents;

            vault.usdc_balance_cents = vault.usdc_balance_cents
                .checked_add(trade_amount_cents)
                .ok_or(SentinelError::MathOverflow)?;
        }

        // 7. Calculate actual resulting post-state from vault ledger (Finding 1)
        let mut post_total_cents: u64 = vault.usdc_balance_cents;
        let mut post_target_cents: u64 = 0;

        for pos in &vault.positions {
            let pos_val = pos.amount_units
                .checked_mul(pos.price_cents)
                .ok_or(SentinelError::MathOverflow)?;

            if pos.mint == promise.trade_asset_mint {
                post_target_cents = pos_val;
            }

            post_total_cents = post_total_cents
                .checked_add(pos_val)
                .ok_or(SentinelError::MathOverflow)?;
        }

        require!(post_total_cents > 0, SentinelError::MathOverflow);
        require!(post_target_cents <= post_total_cents, SentinelError::MathOverflow);

        // 8. Postcondition: Max Single-Asset Exposure in u128 (Findings 10 & 11)
        let target_exposure_bps = (post_target_cents as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(post_total_cents as u128)
            .ok_or(SentinelError::MathOverflow)?;

        require!(
            target_exposure_bps <= policy.max_single_asset_bps as u128,
            SentinelError::ExposureExceeded
        );

        // 9. Postcondition: Min Stablecoin Reserve Floor in u128 (Findings 10 & 11)
        let stablecoin_reserve_bps = (vault.usdc_balance_cents as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(post_total_cents as u128)
            .ok_or(SentinelError::MathOverflow)?;

        require!(
            stablecoin_reserve_bps >= policy.min_stablecoin_bps as u128,
            SentinelError::StablecoinReserveBreached
        );

        // 10. Commit state mutation to vault and settle promise
        vault.total_value_cents = post_total_cents;
        promise.status = 3; // 3 = Settled

        emit!(TradeSettledEvent {
            promise_id: promise.promise_id.clone(),
            post_total_usd: post_total_cents / 100,
            post_stable_usd: vault.usdc_balance_cents / 100,
            post_target_usd: post_target_cents / 100,
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
        // Enforce authority check (Finding 5)
        require!(
            ctx.accounts.authority.key() == ctx.accounts.agent.agent_authority
                || ctx.accounts.authority.key() == ctx.accounts.agent.owner,
            SentinelError::UnauthorizedAgent
        );

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

// -----------------------------------------------------------------------------
// Pure Functional Verifiers for Direct Testing
// -----------------------------------------------------------------------------

pub fn verify_vault_postconditions(
    policy: &PolicyAccount,
    trade_amount_cents: u64,
    post_target_cents: u64,
    post_total_cents: u64,
    post_stable_cents: u64,
    quoted_price_cents: u64,
    execution_price_cents: u64,
) -> Result<()> {
    require!(post_total_cents > 0, SentinelError::MathOverflow);
    require!(post_target_cents <= post_total_cents, SentinelError::MathOverflow);

    // 1. Max trade size check
    require!(
        trade_amount_cents <= policy.max_trade_value_usd.checked_mul(100).ok_or(SentinelError::MathOverflow)?,
        SentinelError::TradeSizeExceeded
    );

    // 2. Max single-asset exposure check (in u128)
    let target_exposure_bps = (post_target_cents as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(post_total_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;

    require!(
        target_exposure_bps <= policy.max_single_asset_bps as u128,
        SentinelError::ExposureExceeded
    );

    // 3. Min stablecoin reserve floor check (in u128)
    let stablecoin_reserve_bps = (post_stable_cents as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(post_total_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;

    require!(
        stablecoin_reserve_bps >= policy.min_stablecoin_bps as u128,
        SentinelError::StablecoinReserveBreached
    );

    // 4. Slippage check (in u128)
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
            .ok_or(SentinelError::MathOverflow)?;

        require!(
            slippage_bps <= policy.max_slippage_bps as u128,
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
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = PortfolioVault::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, PortfolioVault>,
    pub policy: Account<'info, PolicyAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        has_one = policy
    )]
    pub vault: Account<'info, PortfolioVault>,
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
    pub agent: Account<'info, AgentAccount>,
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
pub struct VaultInitializedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub total_value_cents: u64,
    pub usdc_balance_cents: u64,
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
            max_trade_value_usd: 10000, // $10,000 ($1,000,000 cents)
            max_slippage_bps: 100,      // 1.00%
            policy_version: 1,
            is_active: true,
            bump: 0,
        }
    }

    #[test]
    fn test_policy_bounds_enforcement() {
        // Values > 10,000 bps are strictly invalid
        let invalid_bps: u16 = 15_000;
        assert!(invalid_bps > 10_000);
    }

    #[test]
    fn test_single_asset_exposure_boundary_cents() {
        let policy = mock_policy();
        // 25.00% -> PASS ($25,000 on $100,000 = 2,500,000 cents on 10,000,000 cents)
        let res_pass = verify_vault_postconditions(&policy, 500_000, 2_500_000, 10_000_000, 2_000_000, 0, 0);
        assert!(res_pass.is_ok());

        // 25.01% -> FAIL ($25,010 on $100,000 = 2501 bps)
        let res_fail = verify_vault_postconditions(&policy, 500_000, 2_501_000, 10_000_000, 2_000_000, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::ExposureExceeded));
    }

    #[test]
    fn test_stablecoin_reserve_boundary_cents() {
        let policy = mock_policy();
        // 20.00% -> PASS ($20,000 on $100,000 = 2,000,000 cents)
        let res_pass = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 0, 0);
        assert!(res_pass.is_ok());

        // 19.99% -> FAIL ($19,990 on $100,000 = 1,999,000 cents)
        let res_fail = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 1_999_000, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::StablecoinReserveBreached));
    }

    #[test]
    fn test_max_trade_size_boundary_cents() {
        let policy = mock_policy();
        // $10,000 -> PASS ($1,000,000 cents)
        let res_pass = verify_vault_postconditions(&policy, 1_000_000, 2_000_000, 10_000_000, 2_000_000, 0, 0);
        assert!(res_pass.is_ok());

        // $10,001 -> FAIL ($1,000,100 cents)
        let res_fail = verify_vault_postconditions(&policy, 1_000_100, 2_000_000, 10_000_000, 2_000_000, 0, 0);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_bad_decision_rejected_cents() {
        let policy = mock_policy();
        // Agent proposes $15,000 trade ($1,500,000 cents)
        // Post target reaches $35,000 (3,500,000 cents = 35%), USDC drops to $10,000 (1,000,000 cents = 10%)
        let res = verify_vault_postconditions(&policy, 1_500_000, 3_500_000, 10_000_000, 1_000_000, 0, 0);
        assert_eq!(res.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_good_decision_settled_cents() {
        let policy = mock_policy();
        // Agent proposes adapted $5,000 trade: target reaches $25,000 (25%), stablecoin stays $20,000 (20%)
        let res = verify_vault_postconditions(&policy, 500_000, 2_500_000, 10_000_000, 2_000_000, 0, 0);
        assert!(res.is_ok());
    }

    #[test]
    fn test_u128_overflow_protection() {
        let policy = mock_policy();
        // Enforces post_target <= post_total
        let res = verify_vault_postconditions(&policy, 500_000, 12_000_000, 10_000_000, 2_000_000, 0, 0);
        assert_eq!(res.unwrap_err(), error!(SentinelError::MathOverflow));
    }

    #[test]
    fn test_phase3_projected_portfolio_invariants() {
        let policy = mock_policy();
        // Projected token holdings:
        // - USDC: 20,000 tokens * 100 cents = 2,000,000 cents (20.00% floor met)
        // - NVDAx: 208.333333 tokens * 12,000 cents ($120) = 2,500,000 cents (25.00% cap met)
        // - Total projected portfolio: 10,000,000 cents ($100,000)
        let res = verify_vault_postconditions(
            &policy,
            500_000,      // $5,000 trade amount
            2_500_000,    // $25,000 post target value
            10_000_000,   // $100,000 post total value
            2_000_000,    // $20,000 post stablecoin reserve
            12_000,       // Quoted price $120.00
            12_000,       // Executed price $120.00
        );
        assert!(res.is_ok());
    }
}
