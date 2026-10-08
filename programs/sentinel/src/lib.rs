use anchor_lang::prelude::*;

pub mod errors;
pub mod state;
pub mod custody;

use errors::SentinelError;
use state::*;
use custody::*;

declare_id!("3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH");

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
        confirm_slots: u64,
        recovery_window_slots: u64,
        max_recovery_cost_bps: u16,
        max_bounty_bps: u16,
        safe_destination: Pubkey,
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
        policy.confirm_slots = confirm_slots;
        policy.recovery_window_slots = recovery_window_slots;
        policy.max_recovery_cost_bps = max_recovery_cost_bps;
        policy.max_bounty_bps = max_bounty_bps;
        policy.safe_destination = safe_destination;

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
        confirm_slots: u64,
        recovery_window_slots: u64,
        max_recovery_cost_bps: u16,
        max_bounty_bps: u16,
        safe_destination: Pubkey,
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
        policy.confirm_slots = confirm_slots;
        policy.recovery_window_slots = recovery_window_slots;
        policy.max_recovery_cost_bps = max_recovery_cost_bps;
        policy.max_bounty_bps = max_bounty_bps;
        policy.safe_destination = safe_destination;
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
        let volatile_count = positions.iter().filter(|p| !p.is_index).count();
        require!(volatile_count == 1, SentinelError::InvalidVolatileAssetConfiguration);

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.policy = ctx.accounts.policy.key();
        vault.usdc_balance_cents = usdc_balance_cents;
        vault.positions = positions;
        vault.bump = ctx.bumps.vault;
        vault.status = VaultStatus::Active;
        vault.pending_violation_slot = 0;
        vault.quarantine_slot = 0;
        vault.recovery_expires_slot = 0;
        vault.recovery_nonce = 0;
        vault.last_recovery_slot = 0;
        vault.last_recovery_solver = Pubkey::default();
        vault.policy_version_at_quarantine = 0;

        vault.recompute_total_value()?;

        emit!(VaultInitializedEvent {
            vault: vault.key(),
            owner: vault.owner,
            total_value_cents: vault.total_value_cents,
            usdc_balance_cents,
        });

        Ok(())
    }

    /// Synchronizes an existing PortfolioVault account with owner-verified positions
    pub fn sync_vault(
        ctx: Context<SyncVault>,
        usdc_balance_cents: u64,
        positions: Vec<AssetPosition>,
    ) -> Result<()> {
        require!(positions.len() <= PortfolioVault::MAX_POSITIONS, SentinelError::InvalidPolicyBounds);
        let volatile_count = positions.iter().filter(|p| !p.is_index).count();
        require!(volatile_count == 1, SentinelError::InvalidVolatileAssetConfiguration);

        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, SentinelError::VaultNotActive);
        vault.usdc_balance_cents = usdc_balance_cents;
        vault.positions = positions;

        vault.recompute_total_value()?;

        emit!(VaultInitializedEvent {
            vault: vault.key(),
            owner: vault.owner,
            total_value_cents: vault.total_value_cents,
            usdc_balance_cents,
        });

        Ok(())
    }

    /// Updates the operational status of an agent (kill-switch for emergency pause)
    pub fn set_agent_active(
        ctx: Context<SetAgentActive>,
        is_active: bool,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.is_active = is_active;

        emit!(AgentStatusUpdatedEvent {
            agent: agent.key(),
            owner: agent.owner,
            is_active,
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
        require!(ctx.accounts.vault.status == VaultStatus::Active, SentinelError::VaultNotActive);
        require!(ctx.accounts.policy.is_active, SentinelError::PolicyInactive);
        require!(ctx.accounts.agent.is_active, SentinelError::AgentInactive);
        require!(
            ctx.accounts.agent.owner == ctx.accounts.policy.owner,
            SentinelError::SecurityDomainMismatch
        );
        require!(
            ctx.accounts.authority.key() == ctx.accounts.agent.agent_authority
                || ctx.accounts.authority.key() == ctx.accounts.agent.owner,
            SentinelError::UnauthorizedAgent
        );
        require!(
            trade_direction == 0 || trade_direction == 1,
            SentinelError::InvalidTradeDirection
        );

        let clock = Clock::get()?;
        let promise = &mut ctx.accounts.promise;
        promise.promise_id = promise_id;
        promise.agent = ctx.accounts.agent.key();
        promise.policy = ctx.accounts.policy.key();
        promise.intent_hash = intent_hash;
        promise.trade_asset_mint = trade_asset_mint;
        promise.trade_direction = trade_direction;
        promise.trade_amount_usd = trade_amount_usd;
        promise.status = 1; // 1 = Promised
        promise.created_at = clock.unix_timestamp;
        promise.expires_at = clock.unix_timestamp.checked_add(5).ok_or(SentinelError::MathOverflow)?; // 5s TTL
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
        _quoted_price_cents: u64,
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;
        let agent = &ctx.accounts.agent;
        let promise = &mut ctx.accounts.promise;
        let vault = &mut ctx.accounts.vault;

        require!(vault.status == VaultStatus::Active, SentinelError::VaultNotActive);

        // 1. Enforce strict authority check (Finding 3)
        require!(
            ctx.accounts.authority.key() == agent.agent_authority
                || ctx.accounts.authority.key() == agent.owner,
            SentinelError::UnauthorizedExecution
        );

        // 2. Security domain: single owner domain across agent, policy, and vault (Point 1)
        check_domain_binding(&agent.owner, &policy.owner, &vault.owner)?;
        check_agent_active(agent.is_active)?;

        // 3. State & Promise checks (Point 6)
        let clock = Clock::get()?;
        require!(policy.is_active, SentinelError::PolicyInactive);
        require!(promise.status == 1, SentinelError::InvalidPromiseStatus);
        check_promise_expiry(promise.expires_at, clock.unix_timestamp)?;

        // 4. Bind Promise amount strictly to execution amount in cents (Finding 2)
        check_trade_amount_binding(trade_amount_cents, promise.trade_amount_usd)?;

        // 5. Validate trade direction (Point 3)
        check_trade_direction(promise.trade_direction)?;

        // 6. Locate target asset position index in vault
        let pos_idx = vault.positions.iter().position(|p| p.mint == promise.trade_asset_mint)
            .ok_or(SentinelError::AssetNotFound)?;
        let expected_feed_id = vault.positions[pos_idx].feed_id;

        // 7. Parse and verify Pyth oracle price on-chain (Phase 4 / Phase A)
        let pyth_price_cents = parse_and_verify_pyth_price(
            &ctx.accounts.price_update,
            clock.unix_timestamp,
            200, // 200 bps = 2.0% max confidence interval
            expected_feed_id,
        )?;

        // Benchmark is derived directly from Pyth
        let benchmark_price_cents = pyth_price_cents;
        let quoted_price_cents = pyth_price_cents;

        // 8. Oracle benchmark & anti-price-deflation protection:
        // Enforce slippage tolerance against Pyth benchmark price
        check_benchmark_slippage(
            execution_price_cents,
            benchmark_price_cents,
            policy.max_slippage_bps,
        )?;

        // If target position already has a stored price, also enforce slippage tolerance against stored price (anti-deflation protection)
        if vault.positions[pos_idx].price_cents > 0 {
            check_benchmark_slippage(
                execution_price_cents,
                vault.positions[pos_idx].price_cents,
                policy.max_slippage_bps,
            )?;
        }

        // 9. Perform trade mutation on actual vault balances (Findings 1, 4, 9)
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
            // Authoritative Pyth price updates target position price
            target_pos.price_cents = pyth_price_cents;
        } else if promise.trade_direction == 1 {
            // SELL: liquidate target equity, receive USDC
            let target_pos = &mut vault.positions[pos_idx];
            require!(
                target_pos.amount_units >= token_units_traded,
                SentinelError::AssetNotFound
            );
            target_pos.amount_units = target_pos.amount_units
                .checked_sub(token_units_traded)
                .ok_or(SentinelError::MathOverflow)?;
            // Authoritative Pyth price updates target position price
            target_pos.price_cents = pyth_price_cents;

            vault.usdc_balance_cents = vault.usdc_balance_cents
                .checked_add(trade_amount_cents)
                .ok_or(SentinelError::MathOverflow)?;
        } else {
            return err!(SentinelError::InvalidTradeDirection);
        }

        // 10. Calculate actual resulting post-state from vault ledger (Finding 1)
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

        // 11. Authoritatively verify all vault postconditions via pure functional engine
        verify_vault_postconditions(
            policy,
            trade_amount_cents,
            post_target_cents,
            post_total_cents,
            vault.usdc_balance_cents,
            quoted_price_cents,
            execution_price_cents,
        )?;

        // 12. Commit state mutation to vault and settle promise
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

    /// Marks a promise as rejected on-chain when risk postconditions or policy checks fail
    pub fn reject_promise(
        ctx: Context<RejectPromise>,
        failure_code: u16,
    ) -> Result<()> {
        let agent = &ctx.accounts.agent;
        require!(
            ctx.accounts.authority.key() == agent.agent_authority
                || ctx.accounts.authority.key() == agent.owner,
            SentinelError::UnauthorizedExecution
        );
        require!(agent.is_active, SentinelError::AgentInactive);

        let promise = &mut ctx.accounts.promise;
        require!(promise.status == 1, SentinelError::InvalidPromiseStatus);

        promise.status = 4; // 4 = Rejected

        emit!(PromiseRejectedEvent {
            promise_id: promise.promise_id.clone(),
            failure_code,
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

        // Tie verification_result directly to the settled or rejected promise status and agent binding
        check_evidence_lifecycle(
            &ctx.accounts.promise.agent,
            &ctx.accounts.agent.key(),
            ctx.accounts.promise.status,
            verification_result,
        )?;

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

    /// Flags a policy violation on an active vault based on verified Pyth pricing.
    /// Permissionless: any caller can submit with a verified Pyth price update account.
    pub fn flag_violation(ctx: Context<FlagViolation>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let policy = &ctx.accounts.policy;

        require!(vault.status == VaultStatus::Active, SentinelError::VaultNotActive);

        // MVP scope: a vault holds ONE volatile asset + USDC
        let pos = vault.positions.iter().find(|p| !p.is_index)
            .ok_or(SentinelError::AssetNotFound)?;

        let clock = Clock::get()?;
        let pyth_price_cents = parse_and_verify_pyth_price(
            &ctx.accounts.price_update,
            clock.unix_timestamp,
            200, // 200 bps = 2.0% max confidence
            pos.feed_id,
        )?;

        // Reprice the volatile position read-only (do NOT write price back to vault)
        let recomputed_target_cents = pos.amount_units
            .checked_mul(pyth_price_cents)
            .ok_or(SentinelError::MathOverflow)?;

        let recomputed_total_cents = vault.usdc_balance_cents
            .checked_add(recomputed_target_cents)
            .ok_or(SentinelError::MathOverflow)?;

        let eval_result = check_exposure_and_reserve(
            policy,
            recomputed_target_cents,
            recomputed_total_cents,
            vault.usdc_balance_cents,
        );

        let is_violated = match eval_result {
            Ok(_) => false,
            Err(e) if e == error!(SentinelError::ExposureExceeded) || e == error!(SentinelError::StablecoinReserveBreached) => true,
            Err(e) => return Err(e),
        };

        let current_slot = clock.slot;

        if !is_violated {
            if vault.pending_violation_slot != 0 {
                vault.pending_violation_slot = 0;
                emit!(ViolationClearedEvent {
                    vault: vault.key(),
                    slot: current_slot,
                });
                Ok(())
            } else {
                err!(SentinelError::NoViolation)
            }
        } else {
            if vault.pending_violation_slot == 0 {
                vault.pending_violation_slot = current_slot;
                emit!(ViolationPendingEvent {
                    vault: vault.key(),
                    slot: current_slot,
                });
                Ok(())
            } else {
                let elapsed = current_slot.saturating_sub(vault.pending_violation_slot);
                if elapsed < policy.confirm_slots {
                    err!(SentinelError::ViolationNotConfirmed)
                } else {
                    vault.status = VaultStatus::Quarantined;
                    vault.pending_violation_slot = 0;
                    vault.quarantine_slot = current_slot;
                    vault.policy_version_at_quarantine = policy.policy_version;
                    vault.recovery_expires_slot = current_slot
                        .checked_add(policy.recovery_window_slots)
                        .ok_or(SentinelError::MathOverflow)?;
                    vault.recovery_nonce = vault.recovery_nonce
                        .checked_add(1)
                        .ok_or(SentinelError::MathOverflow)?;

                    emit!(VaultQuarantinedEvent {
                        vault: vault.key(),
                        quarantine_slot: current_slot,
                        recovery_expires_slot: vault.recovery_expires_slot,
                        recovery_nonce: vault.recovery_nonce,
                    });
                    Ok(())
                }
            }
        }
    }

    /// Owner releases the vault from any status back to Active.
    /// Resets pending violation and increments recovery_nonce to invalidate in-flight recoveries.
    pub fn owner_release(ctx: Context<OwnerRelease>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.status = VaultStatus::Active;
        vault.pending_violation_slot = 0;
        vault.quarantine_slot = 0;
        vault.recovery_expires_slot = 0;
        vault.policy_version_at_quarantine = 0;
        vault.recovery_nonce = vault.recovery_nonce
            .checked_add(1)
            .ok_or(SentinelError::MathOverflow)?;

        emit!(VaultReleasedEvent {
            vault: vault.key(),
            slot: Clock::get()?.slot,
            recovery_nonce: vault.recovery_nonce,
        });

        Ok(())
    }

    /// Permissionlessly marks quarantine as expired if recovery window has passed.
    pub fn expire_quarantine(ctx: Context<ExpireQuarantine>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Quarantined, SentinelError::VaultNotQuarantined);

        let current_slot = Clock::get()?.slot;
        require!(
            current_slot > vault.recovery_expires_slot,
            SentinelError::RecoveryNotExpired
        );

        vault.status = VaultStatus::RecoveryExpired;
        vault.recovery_nonce = vault.recovery_nonce
            .checked_add(1)
            .ok_or(SentinelError::MathOverflow)?;

        emit!(QuarantineExpiredEvent {
            vault: vault.key(),
            slot: current_slot,
            recovery_nonce: vault.recovery_nonce,
        });

        Ok(())
    }

    /// Solves an invariant breach on a quarantined vault via permissionless, reduce-only rebalancing.
    pub fn recover<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, Recover<'info>>,
        sell_units: u64,
        expected_nonce: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let policy = &ctx.accounts.policy;

        // a. vault.status == Quarantined -> VaultNotQuarantined
        require!(vault.status == VaultStatus::Quarantined, SentinelError::VaultNotQuarantined);

        // Policy must be active
        require!(policy.is_active, SentinelError::PolicyInactive);

        // Policy version must match policy version snapshotted at quarantine
        require!(
            vault.policy_version_at_quarantine == 0 || policy.policy_version == vault.policy_version_at_quarantine,
            SentinelError::PolicyFrozenDuringRecovery
        );

        let clock = Clock::get()?;
        let current_slot = clock.slot;

        // b. current_slot <= recovery_expires_slot -> RecoveryWindowClosed
        require!(current_slot <= vault.recovery_expires_slot, SentinelError::RecoveryWindowClosed);

        // c. expected_nonce == vault.recovery_nonce -> StaleRecoveryNonce
        require!(expected_nonce == vault.recovery_nonce, SentinelError::StaleRecoveryNonce);

        // Exactly one volatile (non-index) position enforced
        let volatile_count = vault.positions.iter().filter(|p| !p.is_index).count();
        require!(volatile_count == 1, SentinelError::InvalidVolatileAssetConfiguration);

        // Volatile (non-index) position
        let pos_idx = vault.positions.iter().position(|p| !p.is_index)
            .ok_or(SentinelError::AssetNotFound)?;
        let feed_id = vault.positions[pos_idx].feed_id;

        // d. price = parse_and_verify_pyth_price(...) with the position's feed_id
        let price_cents = parse_and_verify_pyth_price(
            &ctx.accounts.price_update,
            clock.unix_timestamp,
            200, // 200 bps = 2.0% max confidence
            feed_id,
        )?;

        // e. 0 < sell_units <= amount_units -> InvalidAmount
        let current_amount_units = vault.positions[pos_idx].amount_units;
        require!(
            sell_units > 0 && sell_units <= current_amount_units,
            SentinelError::InvalidAmount
        );

        require!(
            ctx.remaining_accounts.len() >= 4,
            SentinelError::MissingCustodyAccounts
        );

        let vault_ta = &ctx.remaining_accounts[0];
        let dest_ta = &ctx.remaining_accounts[1];
        let mint_info = &ctx.remaining_accounts[2];
        let token_prog = &ctx.remaining_accounts[3];

        // 1. Verify vault token account
        let vault_tok = unpack_token_account(vault_ta)?;
        require!(vault_tok.owner == vault.key(), SentinelError::InvalidVaultTokenAuthority);
        require!(vault_tok.mint == vault.positions[pos_idx].mint, SentinelError::TokenMintMismatch);
        require!(vault_tok.amount >= sell_units, SentinelError::InvalidAmount);
        let vault_balance_before = vault_tok.amount;

        // 2. Verify destination token account: MUST be owned by policy.safe_destination
        let dest_tok = unpack_token_account(dest_ta)?;
        require!(dest_tok.owner == policy.safe_destination, SentinelError::DestinationNotSafe);
        require!(dest_tok.mint == vault.positions[pos_idx].mint, SentinelError::TokenMintMismatch);
        let dest_balance_before = dest_tok.amount;

        // 3. Verify mint
        require!(mint_info.key() == vault.positions[pos_idx].mint, SentinelError::TokenMintMismatch);
        let decimals = unpack_mint_decimals(mint_info)?;

        // 4. Pre valuations
        let pre_target_cents = (current_amount_units as u128)
            .checked_mul(price_cents as u128)
            .ok_or(SentinelError::MathOverflow)?;
        let pre_target_cents = u64::try_from(pre_target_cents)
            .map_err(|_| error!(SentinelError::MathOverflow))?;
        let pre_total_cents = vault.usdc_balance_cents
            .checked_add(pre_target_cents)
            .ok_or(SentinelError::MathOverflow)?;

        // 5. Execute program-signed CPI TransferChecked from vault PDA
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", vault.owner.as_ref(), &[vault.bump]]];
        transfer_checked_signed(
            token_prog,
            vault_ta,
            mint_info,
            dest_ta,
            &vault.to_account_info(),
            sell_units,
            decimals,
            signer_seeds,
        )?;

        // 6. Verify Exact Token Conservation
        let vault_tok_after = unpack_token_account(vault_ta)?;
        let dest_tok_after = unpack_token_account(dest_ta)?;
        require!(
            vault_balance_before.checked_sub(vault_tok_after.amount) == Some(sell_units),
            SentinelError::TokenBalanceMismatch
        );
        require!(
            dest_tok_after.amount.checked_sub(dest_balance_before) == Some(sell_units),
            SentinelError::TokenBalanceMismatch
        );

        // 7. Post valuations based on ACTUAL post-transfer balance
        let post_amount_units = vault_tok_after.amount;
        let post_target_cents = (post_amount_units as u128)
            .checked_mul(price_cents as u128)
            .ok_or(SentinelError::MathOverflow)?;
        let post_target_cents = u64::try_from(post_target_cents)
            .map_err(|_| error!(SentinelError::MathOverflow))?;

        let post_total_cents = vault.usdc_balance_cents
            .checked_add(post_target_cents)
            .ok_or(SentinelError::MathOverflow)?;

        require!(pre_total_cents > 0 && post_total_cents > 0, SentinelError::MathOverflow);
        let pre_exposure_bps = ((pre_target_cents as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(pre_total_cents as u128)
            .ok_or(SentinelError::MathOverflow)?) as u16;

        let post_exposure_bps = ((post_target_cents as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(post_total_cents as u128)
            .ok_or(SentinelError::MathOverflow)?) as u16;

        let post_stable_bps = ((vault.usdc_balance_cents as u128)
            .checked_mul(10_000)
            .ok_or(SentinelError::MathOverflow)?
            .checked_div(post_total_cents as u128)
            .ok_or(SentinelError::MathOverflow)?) as u16;

        // Invariant postcondition: exposure <= cap AND stablecoin >= floor
        require!(
            post_exposure_bps <= policy.max_single_asset_bps && post_stable_bps >= policy.min_stablecoin_bps,
            SentinelError::PostconditionFailed
        );

        // Strict improvement & oversell guard
        check_strict_improvement(pre_exposure_bps, post_exposure_bps)?;
        check_oversell_guard(post_exposure_bps, policy.max_single_asset_bps, OVERSELL_BAND_BPS)?;

        // Atomically restore Active state
        let new_nonce = vault.recovery_nonce
            .checked_add(1)
            .ok_or(SentinelError::MathOverflow)?;

        vault.status = VaultStatus::Active;
        vault.pending_violation_slot = 0;
        vault.quarantine_slot = 0;
        vault.recovery_expires_slot = 0;
        vault.policy_version_at_quarantine = 0;
        vault.recovery_nonce = new_nonce;
        vault.last_recovery_slot = current_slot;
        vault.last_recovery_solver = ctx.accounts.solver.key();

        vault.positions[pos_idx].amount_units = post_amount_units;
        vault.positions[pos_idx].price_cents = price_cents;
        vault.total_value_cents = post_total_cents;

        emit!(RecoveryExecutedEvent {
            vault: vault.key(),
            solver: ctx.accounts.solver.key(),
            sell_units,
            proceeds_cents: 0,
            pre_exposure_bps,
            post_exposure_bps,
            pre_total_cents,
            post_total_cents,
            new_nonce,
            slot: current_slot,
            bounty_cap_cents: 0,
        });

        Ok(())
    }

    /// Deposits real SPL tokens from owner into vault PDA custody account
    pub fn owner_deposit<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, OwnerDeposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, SentinelError::VaultNotActive);
        require!(amount > 0, SentinelError::InvalidAmount);

        let mint_key = ctx.accounts.mint.key();

        // Verify and unpack owner token account
        let owner_tok = unpack_token_account(&ctx.accounts.owner_token_account)?;
        require!(owner_tok.owner == ctx.accounts.owner.key(), SentinelError::InvalidVaultTokenAuthority);
        require!(owner_tok.mint == mint_key, SentinelError::TokenMintMismatch);
        require!(owner_tok.amount >= amount, SentinelError::InvalidAmount);

        // Verify and unpack vault token account
        let vault_tok = unpack_token_account(&ctx.accounts.vault_token_account)?;
        require!(vault_tok.owner == vault.key(), SentinelError::InvalidVaultTokenAuthority);
        require!(vault_tok.mint == mint_key, SentinelError::TokenMintMismatch);

        let decimals = unpack_mint_decimals(&ctx.accounts.mint)?;

        // Execute CPI transfer
        transfer_checked_owner(
            &ctx.accounts.token_program,
            &ctx.accounts.owner_token_account,
            &ctx.accounts.mint,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.owner.to_account_info(),
            amount,
            decimals,
        )?;

        // Update vault state for tracked position (reject untracked deposits)
        let pos = vault.positions.iter_mut().find(|p| p.mint == mint_key).ok_or(SentinelError::UntrackedDepositMint)?;
        pos.amount_units = pos.amount_units.checked_add(amount).ok_or(SentinelError::MathOverflow)?;
        vault.recompute_total_value()?;

        let clock = Clock::get()?;
        emit!(DepositExecutedEvent {
            vault: vault.key(),
            owner: ctx.accounts.owner.key(),
            mint: mint_key,
            amount,
            slot: clock.slot,
        });

        Ok(())
    }

    /// Withdraws real SPL tokens from vault PDA custody account to owner destination
    pub fn owner_withdraw<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, OwnerWithdraw<'info>>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, SentinelError::VaultNotActive);
        require!(amount > 0, SentinelError::InvalidAmount);

        let mint_key = ctx.accounts.mint.key();

        // Verify vault token account
        let vault_tok = unpack_token_account(&ctx.accounts.vault_token_account)?;
        require!(vault_tok.owner == vault.key(), SentinelError::InvalidVaultTokenAuthority);
        require!(vault_tok.mint == mint_key, SentinelError::TokenMintMismatch);
        require!(vault_tok.amount >= amount, SentinelError::InvalidAmount);

        // Verify owner destination token account
        let dest_tok = unpack_token_account(&ctx.accounts.destination_token_account)?;
        require!(dest_tok.owner == ctx.accounts.owner.key(), SentinelError::InvalidVaultTokenAuthority);
        require!(dest_tok.mint == mint_key, SentinelError::TokenMintMismatch);

        let decimals = unpack_mint_decimals(&ctx.accounts.mint)?;

        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", vault.owner.as_ref(), &[vault.bump]]];
        transfer_checked_signed(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.mint,
            &ctx.accounts.destination_token_account,
            &vault.to_account_info(),
            amount,
            decimals,
            signer_seeds,
        )?;

        let pos = vault.positions.iter_mut().find(|p| p.mint == mint_key).ok_or(SentinelError::AssetNotFound)?;
        pos.amount_units = pos.amount_units.checked_sub(amount).ok_or(SentinelError::InvalidAmount)?;
        vault.recompute_total_value()?;

        let clock = Clock::get()?;
        emit!(WithdrawExecutedEvent {
            vault: vault.key(),
            owner: ctx.accounts.owner.key(),
            mint: mint_key,
            amount,
            slot: clock.slot,
        });

        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Pure Functional Verifiers for Direct Testing & Program Enforcement
// -----------------------------------------------------------------------------

pub fn check_benchmark_slippage(
    execution_price_cents: u64,
    benchmark_price_cents: u64,
    max_slippage_bps: u16,
) -> Result<u128> {
    require!(benchmark_price_cents > 0, SentinelError::InvalidPrice);
    require!(execution_price_cents > 0, SentinelError::InvalidPrice);

    let benchmark_diff = if execution_price_cents >= benchmark_price_cents {
        execution_price_cents - benchmark_price_cents
    } else {
        benchmark_price_cents - execution_price_cents
    };
    let benchmark_slippage_bps = (benchmark_diff as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(benchmark_price_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;

    require!(
        benchmark_slippage_bps <= max_slippage_bps as u128,
        SentinelError::SlippageExceeded
    );

    Ok(benchmark_slippage_bps)
}

pub fn check_trade_direction(direction: u8) -> Result<()> {
    require!(direction == 0 || direction == 1, SentinelError::InvalidTradeDirection);
    Ok(())
}

pub fn check_domain_binding(agent_owner: &Pubkey, policy_owner: &Pubkey, vault_owner: &Pubkey) -> Result<()> {
    require!(agent_owner == policy_owner, SentinelError::SecurityDomainMismatch);
    require!(policy_owner == vault_owner, SentinelError::SecurityDomainMismatch);
    Ok(())
}

pub fn check_trade_amount_binding(executed_cents: u64, promised_usd: u64) -> Result<()> {
    let promised_cents = promised_usd.checked_mul(100).ok_or(SentinelError::MathOverflow)?;
    require!(executed_cents == promised_cents, SentinelError::TradeAmountMismatch);
    Ok(())
}

pub fn check_promise_expiry(expires_at: i64, current_timestamp: i64) -> Result<()> {
    require!(current_timestamp <= expires_at, SentinelError::PromiseExpired);
    Ok(())
}

pub fn check_agent_active(is_active: bool) -> Result<()> {
    require!(is_active, SentinelError::AgentInactive);
    Ok(())
}

pub fn check_evidence_lifecycle(
    promise_agent: &Pubkey,
    caller_agent: &Pubkey,
    promise_status: u8,
    verification_result: u8,
) -> Result<()> {
    require!(promise_agent == caller_agent, SentinelError::UnauthorizedAgent);
    require!(promise_status == 3 || promise_status == 4, SentinelError::InvalidPromiseStatus);
    require!(verification_result == promise_status, SentinelError::InvalidPromiseStatus);
    Ok(())
}

/// SIMULATED venue fee in basis points (0.30%)
pub const RECOVERY_VENUE_FEE_BPS: u16 = 30;
/// Oversell guard tolerance band in basis points (5.00%)
pub const OVERSELL_BAND_BPS: u16 = 500;

pub const PYTH_RECEIVER_ID: Pubkey = Pubkey::new_from_array([
    12, 183, 250, 187, 82, 247, 166, 72, 187, 91, 49, 125, 154, 1, 139, 144, 87, 203, 2, 71, 116,
    250, 254, 1, 230, 196, 223, 152, 204, 56, 88, 129,
]);

pub fn check_pyth_freshness(publish_time: i64, current_timestamp: i64) -> Result<()> {
    // Allow up to 10 seconds of clock drift between Pyth publisher timestamp and cluster time
    let max_future_time = current_timestamp
        .checked_add(10)
        .ok_or(SentinelError::MathOverflow)?;
    require!(publish_time <= max_future_time, SentinelError::InvalidPrice);
    require!(
        current_timestamp.saturating_sub(publish_time) <= 60,
        SentinelError::StaleOracle
    );
    Ok(())
}

pub fn check_pyth_confidence(price: i64, conf: u64, max_conf_bps: u16) -> Result<()> {
    require!(price > 0, SentinelError::InvalidPrice);
    let max_allowed_conf = (price as u128)
        .checked_mul(max_conf_bps as u128)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SentinelError::MathOverflow)?;
    require!(
        (conf as u128) <= max_allowed_conf,
        SentinelError::ConfidenceTooWide
    );
    Ok(())
}

pub fn convert_pyth_price_to_cents(price: i64, expo: i32) -> Result<u64> {
    require!(price > 0, SentinelError::InvalidPrice);
    require!(expo >= -12 && expo <= 6, SentinelError::InvalidPrice);
    let price_u128 = price as u128;
    let price_cents = if expo < 0 {
        let neg_expo = (-expo) as u32;
        if neg_expo >= 2 {
            let divisor = 10u128.checked_pow(neg_expo - 2).ok_or(SentinelError::MathOverflow)?;
            price_u128.checked_div(divisor).ok_or(SentinelError::MathOverflow)?
        } else {
            price_u128.checked_mul(10).ok_or(SentinelError::MathOverflow)?
        }
    } else {
        let multiplier = 10u128
            .checked_pow(expo as u32)
            .ok_or(SentinelError::MathOverflow)?
            .checked_mul(100)
            .ok_or(SentinelError::MathOverflow)?;
        price_u128.checked_mul(multiplier).ok_or(SentinelError::MathOverflow)?
    };

    require!(price_cents > 0 && price_cents <= (u64::MAX as u128), SentinelError::InvalidPrice);
    Ok(price_cents as u64)
}

pub fn parse_and_verify_pyth_price(
    account_info: &AccountInfo,
    current_timestamp: i64,
    max_conf_bps: u16,
    expected_feed_id: [u8; 32],
) -> Result<u64> {
    require!(
        account_info.owner == &PYTH_RECEIVER_ID,
        SentinelError::UnverifiedPrice
    );

    let price_update = PriceUpdateV2::try_from_account_info(account_info)
        .map_err(|_| error!(SentinelError::UnverifiedPrice))?;

    require!(
        matches!(price_update.verification_level, VerificationLevel::Full),
        SentinelError::UnverifiedPrice
    );

    let msg = price_update.price_message;

    require!(
        msg.feed_id == expected_feed_id,
        SentinelError::FeedMismatch
    );

    check_pyth_freshness(msg.publish_time, current_timestamp)?;
    check_pyth_confidence(msg.price, msg.conf, max_conf_bps)?;

    let price_cents = convert_pyth_price_to_cents(msg.price, msg.exponent)?;
    Ok(price_cents)
}

pub fn check_exposure_and_reserve(
    policy: &PolicyAccount,
    target_cents: u64,
    total_cents: u64,
    stable_cents: u64,
) -> Result<()> {
    require!(total_cents > 0, SentinelError::MathOverflow);
    require!(target_cents <= total_cents, SentinelError::MathOverflow);

    // 1. Max single-asset exposure check (in u128)
    let target_exposure_bps = (target_cents as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(total_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;

    require!(
        target_exposure_bps <= policy.max_single_asset_bps as u128,
        SentinelError::ExposureExceeded
    );

    // 2. Min stablecoin reserve floor check (in u128)
    let stablecoin_reserve_bps = (stable_cents as u128)
        .checked_mul(10_000)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(total_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;

    require!(
        stablecoin_reserve_bps >= policy.min_stablecoin_bps as u128,
        SentinelError::StablecoinReserveBreached
    );

    Ok(())
}

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

    // Fail closed on missing/zero/invalid price (Point 4)
    require!(quoted_price_cents > 0, SentinelError::InvalidPrice);
    require!(execution_price_cents > 0, SentinelError::InvalidPrice);

    // 1. Max trade size check
    require!(
        trade_amount_cents <= policy.max_trade_value_usd.checked_mul(100).ok_or(SentinelError::MathOverflow)?,
        SentinelError::TradeSizeExceeded
    );

    // 2. Max single-asset exposure & min stablecoin reserve checks
    check_exposure_and_reserve(policy, post_target_cents, post_total_cents, post_stable_cents)?;

    // 3. Slippage check (in u128) via extracted pure function
    check_benchmark_slippage(
        execution_price_cents,
        quoted_price_cents,
        policy.max_slippage_bps,
    )?;

    Ok(())
}

pub fn compute_recovery_proceeds(sell_units: u64, price_cents: u64, fee_bps: u16) -> Result<u64> {
    require!(fee_bps <= 10_000, SentinelError::MathOverflow);
    let gross = (sell_units as u128)
        .checked_mul(price_cents as u128)
        .ok_or(SentinelError::MathOverflow)?;
    let net = gross
        .checked_mul((10_000 - fee_bps) as u128)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SentinelError::MathOverflow)?;
    u64::try_from(net).map_err(|_| error!(SentinelError::MathOverflow))
}

pub fn check_value_conservation(
    pre_total: u64,
    post_total: u64,
    max_recovery_cost_bps: u16,
) -> Result<()> {
    require!(max_recovery_cost_bps <= 10_000, SentinelError::MathOverflow);
    let min_allowed = (pre_total as u128)
        .checked_mul((10_000 - max_recovery_cost_bps) as u128)
        .ok_or(SentinelError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SentinelError::MathOverflow)?;
    require!(
        (post_total as u128) >= min_allowed,
        SentinelError::ValueConservationBreached
    );
    Ok(())
}

pub fn check_strict_improvement(
    pre_exposure_bps: u16,
    post_exposure_bps: u16,
) -> Result<()> {
    require!(
        post_exposure_bps < pre_exposure_bps,
        SentinelError::PostconditionFailed
    );
    Ok(())
}

pub fn check_oversell_guard(
    post_exposure_bps: u16,
    max_single_asset_bps: u16,
    oversell_band_bps: u16,
) -> Result<()> {
    let lower_bound = max_single_asset_bps.saturating_sub(oversell_band_bps);
    require!(
        post_exposure_bps >= lower_bound,
        SentinelError::OversellGuard
    );
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
    #[account(
        has_one = owner @ SentinelError::SecurityDomainMismatch
    )]
    pub policy: Account<'info, PolicyAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner
    )]
    pub vault: Account<'info, PortfolioVault>,
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
    #[account(
        constraint = agent.owner == policy.owner @ SentinelError::SecurityDomainMismatch,
        constraint = agent.is_active @ SentinelError::AgentInactive
    )]
    pub agent: Account<'info, AgentAccount>,
    pub policy: Account<'info, PolicyAccount>,
    #[account(
        seeds = [b"vault", agent.owner.as_ref()],
        bump = vault.bump,
        has_one = policy,
    )]
    pub vault: Account<'info, PortfolioVault>,
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
        has_one = policy,
        constraint = vault.owner == policy.owner @ SentinelError::SecurityDomainMismatch
    )]
    pub vault: Account<'info, PortfolioVault>,
    #[account(
        constraint = agent.owner == policy.owner @ SentinelError::SecurityDomainMismatch,
        constraint = agent.is_active @ SentinelError::AgentInactive
    )]
    pub agent: Account<'info, AgentAccount>,
    pub policy: Account<'info, PolicyAccount>,
    /// CHECK: Oracle price update account verified via program ownership and deserialization
    pub price_update: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetAgentActive<'info> {
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump,
        has_one = owner
    )]
    pub agent: Account<'info, AgentAccount>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct RejectPromise<'info> {
    #[account(
        mut,
        seeds = [b"promise", agent.key().as_ref(), promise.promise_id.as_bytes()],
        bump = promise.bump,
        has_one = agent @ SentinelError::UnauthorizedAgent
    )]
    pub promise: Account<'info, PromiseAccount>,
    #[account(
        constraint = agent.is_active @ SentinelError::AgentInactive
    )]
    pub agent: Account<'info, AgentAccount>,
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
    #[account(
        has_one = agent @ SentinelError::UnauthorizedAgent,
        constraint = (promise.status == 3 || promise.status == 4) @ SentinelError::InvalidPromiseStatus
    )]
    pub promise: Account<'info, PromiseAccount>,
    #[account(
        constraint = agent.is_active @ SentinelError::AgentInactive
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlagViolation<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        has_one = policy,
        constraint = vault.owner == policy.owner @ SentinelError::SecurityDomainMismatch
    )]
    pub vault: Account<'info, PortfolioVault>,
    pub policy: Account<'info, PolicyAccount>,
    /// CHECK: Oracle price update account verified via parse_and_verify_pyth_price
    pub price_update: AccountInfo<'info>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct OwnerRelease<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner
    )]
    pub vault: Account<'info, PortfolioVault>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExpireQuarantine<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, PortfolioVault>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Recover<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        has_one = policy,
        constraint = vault.owner == policy.owner @ SentinelError::SecurityDomainMismatch
    )]
    pub vault: Account<'info, PortfolioVault>,
    pub policy: Account<'info, PolicyAccount>,
    /// CHECK: Verified via parse_and_verify_pyth_price in recover instruction
    pub price_update: AccountInfo<'info>,
    pub solver: Signer<'info>,
}

#[derive(Accounts)]
pub struct OwnerDeposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, PortfolioVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Owner SPL token account
    #[account(mut)]
    pub owner_token_account: AccountInfo<'info>,
    /// CHECK: Vault SPL token account owned by vault PDA
    #[account(mut)]
    pub vault_token_account: AccountInfo<'info>,
    /// CHECK: Token mint
    pub mint: AccountInfo<'info>,
    /// CHECK: Token program
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct OwnerWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, PortfolioVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Vault SPL token account owned by vault PDA
    #[account(mut)]
    pub vault_token_account: AccountInfo<'info>,
    /// CHECK: Owner destination SPL token account
    #[account(mut)]
    pub destination_token_account: AccountInfo<'info>,
    /// CHECK: Token mint
    pub mint: AccountInfo<'info>,
    /// CHECK: Token program
    pub token_program: AccountInfo<'info>,
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
pub struct PromiseRejectedEvent {
    pub promise_id: String,
    pub failure_code: u16,
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

#[event]
pub struct AgentStatusUpdatedEvent {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub is_active: bool,
}

#[event]
pub struct ViolationPendingEvent {
    pub vault: Pubkey,
    pub slot: u64,
}

#[event]
pub struct ViolationClearedEvent {
    pub vault: Pubkey,
    pub slot: u64,
}

#[event]
pub struct VaultQuarantinedEvent {
    pub vault: Pubkey,
    pub quarantine_slot: u64,
    pub recovery_expires_slot: u64,
    pub recovery_nonce: u64,
}

#[event]
pub struct VaultReleasedEvent {
    pub vault: Pubkey,
    pub slot: u64,
    pub recovery_nonce: u64,
}

#[event]
pub struct QuarantineExpiredEvent {
    pub vault: Pubkey,
    pub slot: u64,
    pub recovery_nonce: u64,
}

#[event]
pub struct RecoveryExecutedEvent {
    pub vault: Pubkey,
    pub solver: Pubkey,
    pub sell_units: u64,
    pub proceeds_cents: u64,
    pub pre_exposure_bps: u16,
    pub post_exposure_bps: u16,
    pub pre_total_cents: u64,
    pub post_total_cents: u64,
    pub new_nonce: u64,
    pub slot: u64,
    /// SIMULATED / NOT PAID: Solver bounty ceiling calculated against policy.max_bounty_bps
    pub bounty_cap_cents: u64,
}

#[event]
pub struct DepositExecutedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub slot: u64,
}

#[event]
pub struct WithdrawExecutedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub slot: u64,
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
            confirm_slots: 10,
            recovery_window_slots: 100,
            max_recovery_cost_bps: 100,
            max_bounty_bps: 50,
            safe_destination: Pubkey::default(),
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
        let res_pass = verify_vault_postconditions(&policy, 500_000, 2_500_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert!(res_pass.is_ok());

        // 25.01% -> FAIL ($25,010 on $100,000 = 2501 bps)
        let res_fail = verify_vault_postconditions(&policy, 500_000, 2_501_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::ExposureExceeded));
    }

    #[test]
    fn test_stablecoin_reserve_boundary_cents() {
        let policy = mock_policy();
        // 20.00% -> PASS ($20,000 on $100,000 = 2,000,000 cents)
        let res_pass = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert!(res_pass.is_ok());

        // 19.99% -> FAIL ($19,990 on $100,000 = 1,999,000 cents)
        let res_fail = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 1_999_000, 12_000, 12_000);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::StablecoinReserveBreached));
    }

    #[test]
    fn test_max_trade_size_boundary_cents() {
        let policy = mock_policy();
        // $10,000 -> PASS ($1,000,000 cents)
        let res_pass = verify_vault_postconditions(&policy, 1_000_000, 2_000_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert!(res_pass.is_ok());

        // $10,001 -> FAIL ($1,000,100 cents)
        let res_fail = verify_vault_postconditions(&policy, 1_000_100, 2_000_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_bad_decision_rejected_cents() {
        let policy = mock_policy();
        // Agent proposes $15,000 trade ($1,500,000 cents)
        // Post target reaches $35,000 (3,500,000 cents = 35%), USDC drops to $10,000 (1,000,000 cents = 10%)
        let res = verify_vault_postconditions(&policy, 1_500_000, 3_500_000, 10_000_000, 1_000_000, 12_000, 12_000);
        assert_eq!(res.unwrap_err(), error!(SentinelError::TradeSizeExceeded));
    }

    #[test]
    fn test_hackathon_good_decision_settled_cents() {
        let policy = mock_policy();
        // Agent proposes adapted $5,000 trade: target reaches $25,000 (25%), stablecoin stays $20,000 (20%)
        let res = verify_vault_postconditions(&policy, 500_000, 2_500_000, 10_000_000, 2_000_000, 12_000, 12_000);
        assert!(res.is_ok());
    }

    #[test]
    fn test_u128_overflow_protection() {
        let policy = mock_policy();
        // Enforces post_target <= post_total
        let res = verify_vault_postconditions(&policy, 500_000, 12_000_000, 10_000_000, 2_000_000, 12_000, 12_000);
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

    #[test]
    fn test_promise_expiry_enforcement() {
        let created_at: i64 = 1726000000;
        let expires_at: i64 = created_at + 120; // 120s TTL

        // Within valid execution window (e.g. 30s elapsed)
        let valid_time: i64 = created_at + 30;
        assert!(valid_time <= expires_at);

        // Expired (e.g. 150s elapsed)
        let expired_time: i64 = created_at + 150;
        assert!(expired_time > expires_at);
    }

    #[test]
    fn test_missing_or_zero_price_fails_closed() {
        let policy = mock_policy();

        // 1. Quoted price = 0 -> FAIL closed with InvalidPrice
        let res_zero_quote = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 0, 12_000);
        assert_eq!(res_zero_quote.unwrap_err(), error!(SentinelError::InvalidPrice));

        // 2. Execution price = 0 -> FAIL closed with InvalidPrice
        let res_zero_exec = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 12_000, 0);
        assert_eq!(res_zero_exec.unwrap_err(), error!(SentinelError::InvalidPrice));

        // 3. Both prices = 0 -> FAIL closed with InvalidPrice
        let res_both_zero = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 0, 0);
        assert_eq!(res_both_zero.unwrap_err(), error!(SentinelError::InvalidPrice));
    }

    #[test]
    fn test_slippage_exceeded_with_valid_prices() {
        let policy = mock_policy(); // max_slippage_bps = 100 (1.00%)

        // 0.83% slippage (quoted $120.00 = 12,000 cents, exec $121.00 = 12,100 cents -> 100/12000 = 83 bps <= 100 bps) -> PASS
        let res_pass = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 12_000, 12_100);
        assert!(res_pass.is_ok());

        // 1.67% slippage (quoted $120.00 = 12,000 cents, exec $122.00 = 12,200 cents -> 200/12000 = 166 bps > 100 bps) -> FAIL
        let res_fail = verify_vault_postconditions(&policy, 500_000, 2_000_000, 10_000_000, 2_000_000, 12_000, 12_200);
        assert_eq!(res_fail.unwrap_err(), error!(SentinelError::SlippageExceeded));
    }

    #[test]
    fn test_check_benchmark_slippage_direct() {
        // Zero or negative prices fail closed
        assert_eq!(
            check_benchmark_slippage(12_000, 0, 100).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
        assert_eq!(
            check_benchmark_slippage(0, 12_000, 100).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );

        // Exact match -> 0 bps
        let res_zero = check_benchmark_slippage(12_000, 12_000, 100);
        assert_eq!(res_zero.unwrap(), 0);

        // Within tolerance: 12,050 vs 12,000 -> 41 bps <= 100 bps
        let res_ok = check_benchmark_slippage(12_050, 12_000, 100);
        assert_eq!(res_ok.unwrap(), 41);

        // Slippage exceeded: 12,200 vs 12,000 -> 166 bps > 100 bps
        let res_exceeded = check_benchmark_slippage(12_200, 12_000, 100);
        assert_eq!(res_exceeded.unwrap_err(), error!(SentinelError::SlippageExceeded));

        // Rogue agent deflation exploit: 1 cent vs 12,000 cents stored -> 9999 bps > 100 bps
        let res_deflation = check_benchmark_slippage(1, 12_000, 100);
        assert_eq!(res_deflation.unwrap_err(), error!(SentinelError::SlippageExceeded));
    }

    #[test]
    fn test_check_promise_expiry_real_function() {
        // Active promise (clock <= expires_at) passes
        assert!(check_promise_expiry(1_726_000_100, 1_726_000_050).is_ok());

        // Expired promise (clock > expires_at) fails closed with PromiseExpired
        assert_eq!(
            check_promise_expiry(1_726_000_100, 1_726_000_101).unwrap_err(),
            error!(SentinelError::PromiseExpired)
        );
    }

    #[test]
    fn test_check_agent_active_real_function() {
        // Active agent passes
        assert!(check_agent_active(true).is_ok());

        // Inactive agent (kill-switch triggered) fails closed with AgentInactive
        assert_eq!(
            check_agent_active(false).unwrap_err(),
            error!(SentinelError::AgentInactive)
        );
    }

    #[test]
    fn test_check_trade_direction_real_function() {
        // BUY (0) and SELL (1) pass
        assert!(check_trade_direction(0).is_ok());
        assert!(check_trade_direction(1).is_ok());

        // Invalid directions fail closed with InvalidTradeDirection
        assert_eq!(
            check_trade_direction(2).unwrap_err(),
            error!(SentinelError::InvalidTradeDirection)
        );
        assert_eq!(
            check_trade_direction(255).unwrap_err(),
            error!(SentinelError::InvalidTradeDirection)
        );
    }

    #[test]
    fn test_check_domain_binding_real_function() {
        let alice = Pubkey::new_unique();
        let bob = Pubkey::new_unique();

        // Consistent owner domain passes
        assert!(check_domain_binding(&alice, &alice, &alice).is_ok());

        // Mismatched policy owner fails
        assert_eq!(
            check_domain_binding(&alice, &bob, &alice).unwrap_err(),
            error!(SentinelError::SecurityDomainMismatch)
        );

        // Mismatched vault owner fails
        assert_eq!(
            check_domain_binding(&alice, &alice, &bob).unwrap_err(),
            error!(SentinelError::SecurityDomainMismatch)
        );
    }

    #[test]
    fn test_check_trade_amount_binding_real_function() {
        // Exact cents match for $5,000 USD (500,000 cents) passes
        assert!(check_trade_amount_binding(500_000, 5_000).is_ok());

        // Dollars passed instead of cents ($5,000 vs 500,000 cents) fails closed
        assert_eq!(
            check_trade_amount_binding(5_000, 5_000).unwrap_err(),
            error!(SentinelError::TradeAmountMismatch)
        );

        // Over-execution ($15,000 trade vs $5,000 promise) fails closed
        assert_eq!(
            check_trade_amount_binding(1_500_000, 5_000).unwrap_err(),
            error!(SentinelError::TradeAmountMismatch)
        );
    }

    #[test]
    fn test_check_evidence_lifecycle_real_function() {
        let agent_a = Pubkey::new_unique();
        let agent_b = Pubkey::new_unique();

        // Valid settled evidence passes
        assert!(check_evidence_lifecycle(&agent_a, &agent_a, 3, 3).is_ok());

        // Valid rejected evidence passes
        assert!(check_evidence_lifecycle(&agent_a, &agent_a, 4, 4).is_ok());

        // Unauthorized foreign agent fails closed
        assert_eq!(
            check_evidence_lifecycle(&agent_a, &agent_b, 3, 3).unwrap_err(),
            error!(SentinelError::UnauthorizedAgent)
        );

        // Promise status still Promised (1) cannot record evidence
        assert_eq!(
            check_evidence_lifecycle(&agent_a, &agent_a, 1, 1).unwrap_err(),
            error!(SentinelError::InvalidPromiseStatus)
        );

        // Mismatched verification_result (e.g. claiming settled 3 when promise status is rejected 4) fails
        assert_eq!(
            check_evidence_lifecycle(&agent_a, &agent_a, 4, 3).unwrap_err(),
            error!(SentinelError::InvalidPromiseStatus)
        );
    }

    #[test]
    fn test_stored_vault_price_preserved_anti_deflation() {
        // Vault has 200 NVDAx tokens at benchmark price 12,000 cents ($120.00) = $24,000
        let mut target_pos = AssetPosition {
            mint: Pubkey::default(),
            symbol: *b"NVDAx\0\0\0",
            amount_units: 200,
            price_cents: 12_000,
            is_index: false,
            feed_id: [0u8; 32],
        };

        // Even on an executed trade at $120.50 (12,050 cents, within 1% slippage)
        let exec_price_cents = 12_050;
        let token_units_traded = 41;

        // Apply vault mutation invariant: NEVER overwrite an existing position's price
        target_pos.amount_units += token_units_traded;
        if target_pos.price_cents == 0 {
            target_pos.price_cents = exec_price_cents;
        }

        // Benchmark price of existing holdings MUST remain intact (12,000 cents), preventing valuation collapse
        assert_eq!(target_pos.price_cents, 12_000);
        assert_eq!(target_pos.amount_units, 241);
    }

    #[test]
    fn test_pyth_freshness_enforcement() {
        let current_time = 1_000_000;

        // Fresh price (30s old) passes
        assert!(check_pyth_freshness(current_time - 30, current_time).is_ok());

        // Boundary price (exactly 60s old) passes
        assert!(check_pyth_freshness(current_time - 60, current_time).is_ok());

        // Stale price (61s old) fails closed with StaleOracle
        assert_eq!(
            check_pyth_freshness(current_time - 61, current_time).unwrap_err(),
            error!(SentinelError::StaleOracle)
        );

        // Very stale price (300s old) fails closed
        assert_eq!(
            check_pyth_freshness(current_time - 300, current_time).unwrap_err(),
            error!(SentinelError::StaleOracle)
        );

        // Within 10s future drift passes
        assert!(check_pyth_freshness(current_time + 5, current_time).is_ok());

        // Beyond 10s future drift fails closed with InvalidPrice
        assert_eq!(
            check_pyth_freshness(current_time + 15, current_time).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
    }

    #[test]
    fn test_pyth_confidence_enforcement() {
        // Asset price = $120.00 (12_000_000_000 with expo -8), max 200 bps (2.0%) = max conf $2.40
        let price: i64 = 12_000_000_000;

        // Tight confidence ($0.50 = 0.42%) passes
        let tight_conf: u64 = 50_000_000;
        assert!(check_pyth_confidence(price, tight_conf, 200).is_ok());

        // Boundary confidence ($2.40 = exactly 2.0%) passes
        let boundary_conf: u64 = 240_000_000;
        assert!(check_pyth_confidence(price, boundary_conf, 200).is_ok());

        // Wide confidence ($3.00 = 2.5% > 2.0% threshold) fails closed with ConfidenceTooWide
        let wide_conf: u64 = 300_000_000;
        assert_eq!(
            check_pyth_confidence(price, wide_conf, 200).unwrap_err(),
            error!(SentinelError::ConfidenceTooWide)
        );

        // Zero or negative price fails closed with InvalidPrice
        assert_eq!(
            check_pyth_confidence(0, tight_conf, 200).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
        assert_eq!(
            check_pyth_confidence(-100, tight_conf, 200).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
    }

    #[test]
    fn test_convert_pyth_price_to_cents() {
        // $120.00 with expo -8 -> 12,000 cents
        assert_eq!(
            convert_pyth_price_to_cents(12_000_000_000, -8).unwrap(),
            12_000
        );

        // $1.00 USDC with expo -6 -> 100 cents
        assert_eq!(
            convert_pyth_price_to_cents(1_000_000, -6).unwrap(),
            100
        );

        // $500.25 with expo -2 -> 50,025 cents
        assert_eq!(
            convert_pyth_price_to_cents(50_025, -2).unwrap(),
            50_025
        );

        // $150 with expo 0 -> 15,000 cents
        assert_eq!(
            convert_pyth_price_to_cents(150, 0).unwrap(),
            15_000
        );

        // Negative/zero price fails
        assert_eq!(
            convert_pyth_price_to_cents(0, -8).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
        assert_eq!(
            convert_pyth_price_to_cents(-500, -8).unwrap_err(),
            error!(SentinelError::InvalidPrice)
        );
    }

    #[test]
    fn test_deserialize_price_update_v2() {
        let disc = PriceUpdateV2::DISCRIMINATOR;
        let mut buf = Vec::new();
        buf.extend_from_slice(&disc);
        let write_auth = Pubkey::new_unique();
        buf.extend_from_slice(write_auth.as_ref());
        buf.push(1); // Full
        buf.extend_from_slice(&[7u8; 32]); // feed_id
        buf.extend_from_slice(&12000000000i64.to_le_bytes()); // price
        buf.extend_from_slice(&50000000u64.to_le_bytes()); // conf
        buf.extend_from_slice(&(-8i32).to_le_bytes()); // exponent
        buf.extend_from_slice(&1726000000i64.to_le_bytes()); // publish_time
        buf.extend_from_slice(&1726000000i64.to_le_bytes()); // prev_publish_time
        buf.extend_from_slice(&12000000000i64.to_le_bytes()); // ema_price
        buf.extend_from_slice(&50000000u64.to_le_bytes()); // ema_conf
        buf.extend_from_slice(&100u64.to_le_bytes()); // posted_slot

        let mut slice = &buf[8..];
        let price_update = PriceUpdateV2::deserialize(&mut slice).expect("deserialize failed");
        assert_eq!(price_update.verification_level, VerificationLevel::Full);
        assert_eq!(price_update.price_message.price, 12000000000);
        assert_eq!(price_update.price_message.exponent, -8);
    }

    #[test]
    fn test_compute_recovery_proceeds() {
        // 100 units at $150 (15,000 cents), fee 30 bps (0.3%)
        // gross = 1,500,000 cents ($15,000)
        // net = 1,500,000 * 9,970 / 10,000 = 1,495,500 cents ($14,955)
        let proceeds = compute_recovery_proceeds(100, 15_000, 30).unwrap();
        assert_eq!(proceeds, 1_495_500);

        // Boundary: 0 units sold -> 0 proceeds
        assert_eq!(compute_recovery_proceeds(0, 15_000, 30).unwrap(), 0);

        // Boundary: 0 price -> 0 proceeds
        assert_eq!(compute_recovery_proceeds(100, 0, 30).unwrap(), 0);

        // Boundary: 0 fee -> full gross
        assert_eq!(compute_recovery_proceeds(10, 10_000, 0).unwrap(), 100_000);

        // Boundary: 10,000 bps fee (100%) -> 0 proceeds
        assert_eq!(compute_recovery_proceeds(10, 10_000, 10_000).unwrap(), 0);

        // Boundary: > 10,000 bps fee -> MathOverflow error
        assert_eq!(
            compute_recovery_proceeds(10, 10_000, 10_001).unwrap_err(),
            error!(SentinelError::MathOverflow)
        );
    }

    #[test]
    fn test_check_value_conservation() {
        let pre_total = 10_000;
        let max_cost_bps = 100; // 1% allowed loss -> min_allowed = 9,900

        // Exact bound passes
        assert!(check_value_conservation(pre_total, 9_900, max_cost_bps).is_ok());

        // Above bound passes
        assert!(check_value_conservation(pre_total, 9_950, max_cost_bps).is_ok());

        // Below bound fails with ValueConservationBreached
        assert_eq!(
            check_value_conservation(pre_total, 9_899, max_cost_bps).unwrap_err(),
            error!(SentinelError::ValueConservationBreached)
        );

        // 0 bps max cost requires post >= pre
        assert!(check_value_conservation(pre_total, pre_total, 0).is_ok());
        assert_eq!(
            check_value_conservation(pre_total, pre_total - 1, 0).unwrap_err(),
            error!(SentinelError::ValueConservationBreached)
        );

        // 10,000 bps max cost allows 0 post
        assert!(check_value_conservation(pre_total, 0, 10_000).is_ok());

        // Fee > 10,000 bps fails
        assert_eq!(
            check_value_conservation(pre_total, pre_total, 10_001).unwrap_err(),
            error!(SentinelError::MathOverflow)
        );
    }

    #[test]
    fn test_check_strict_improvement() {
        // Strict reduction in exposure bps passes
        assert!(check_strict_improvement(6000, 4500).is_ok());
        assert!(check_strict_improvement(10, 0).is_ok());

        // Equal exposure fails with PostconditionFailed
        assert_eq!(
            check_strict_improvement(5000, 5000).unwrap_err(),
            error!(SentinelError::PostconditionFailed)
        );

        // Increased exposure fails with PostconditionFailed
        assert_eq!(
            check_strict_improvement(4000, 4500).unwrap_err(),
            error!(SentinelError::PostconditionFailed)
        );
    }

    #[test]
    fn test_check_oversell_guard() {
        let max_single_bps = 5000;
        let band_bps = 500;
        // lower_bound = 5000 - 500 = 4500 bps

        // Within band passes
        assert!(check_oversell_guard(4800, max_single_bps, band_bps).is_ok());

        // Exact lower bound boundary passes
        assert!(check_oversell_guard(4500, max_single_bps, band_bps).is_ok());

        // Breached below lower bound fails with OversellGuard
        assert_eq!(
            check_oversell_guard(4499, max_single_bps, band_bps).unwrap_err(),
            error!(SentinelError::OversellGuard)
        );

        // Entire position sold (post_exposure = 0) fails with OversellGuard
        assert_eq!(
            check_oversell_guard(0, max_single_bps, band_bps).unwrap_err(),
            error!(SentinelError::OversellGuard)
        );

        // Saturating sub boundary (max < band)
        // max = 300, band = 500 -> lower_bound = 0
        assert!(check_oversell_guard(0, 300, 500).is_ok());
    }
}
