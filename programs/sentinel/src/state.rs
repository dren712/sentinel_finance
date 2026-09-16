use anchor_lang::prelude::*;

#[account]
pub struct AgentAccount {
    pub owner: Pubkey,
    pub agent_authority: Pubkey,
    pub agent_id: String,
    pub portfolio_id: String,
    pub is_active: bool,
    pub bump: u8,
}

impl AgentAccount {
    pub const LEN: usize = 8 + 32 + 32 + (4 + 32) + (4 + 32) + 1 + 1;
}

#[account]
pub struct PolicyAccount {
    pub owner: Pubkey,
    pub max_single_asset_bps: u16,   // e.g. 2500 = 25.00%
    pub min_stablecoin_bps: u16,     // e.g. 2000 = 20.00%
    pub max_trade_value_usd: u64,    // e.g. 10000 = $10,000
    pub max_slippage_bps: u16,       // e.g. 100 = 1.00%
    pub policy_version: u32,
    pub is_active: bool,
    pub bump: u8,
}

impl PolicyAccount {
    pub const LEN: usize = 8 + 32 + 2 + 2 + 8 + 2 + 4 + 1 + 1;
}

#[account]
pub struct PromiseAccount {
    pub promise_id: String,
    pub agent: Pubkey,
    pub policy: Pubkey,
    pub intent_hash: [u8; 32],
    pub trade_asset_mint: Pubkey,
    pub trade_direction: u8, // 0 = BUY, 1 = SELL
    pub trade_amount_usd: u64,
    pub status: u8,          // 0 = Created, 1 = Promised, 2 = Validating, 3 = Settled, 4 = Rejected
    pub bump: u8,
}

impl PromiseAccount {
    pub const LEN: usize = 8 + (4 + 32) + 32 + 32 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, PartialEq, Eq, Debug)]
pub struct AssetPosition {
    pub mint: Pubkey,
    pub symbol: [u8; 8],        // e.g. b"NVDAx\0\0\0"
    pub amount_units: u64,      // units of equity tokens
    pub price_cents: u64,       // price in USD cents ($120.00 = 12000 cents)
    pub is_index: bool,         // broad ETF exemption
}

/// PortfolioVault:
/// The Sentinel PDA representing the on-chain Portfolio Configuration and Execution Authority.
/// Under Phase 3 (Real Portfolio State Architecture):
/// - Policy Authority: bound to `policy` account enforcing mathematical invariants
/// - Portfolio Configuration: tracks owner, tracked mints, and projected total valuation
/// - Execution Authority: governs guarded trade execution via PDA seeds [b"vault", owner.key()]
/// - Promise Registry: bound to PromiseAccount state transition locks
/// - Evidence Anchor: bound to EvidenceAccount immutable PROVN records
/// While actual assets remain native Solana SPL tokens held in user-owned ATAs.
#[account]
pub struct PortfolioVault {
    pub owner: Pubkey,
    pub policy: Pubkey,
    pub usdc_balance_cents: u64,
    pub total_value_cents: u64,
    pub positions: Vec<AssetPosition>,
    pub bump: u8,
}

impl PortfolioVault {
    pub const MAX_POSITIONS: usize = 8;
    // 8 disc + 32 owner + 32 policy + 8 usdc + 8 total + (4 len + 8 * (32 + 8 + 8 + 8 + 1)) + 1 bump
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + (4 + Self::MAX_POSITIONS * 57) + 1;
}

#[account]
pub struct EvidenceAccount {
    pub evidence_id: String,
    pub promise: Pubkey,
    pub pre_state_hash: [u8; 32],
    pub post_state_hash: [u8; 32],
    pub verification_result: u8, // 3 = Settled, 4 = Rejected
    pub failure_code: u16,
    pub timestamp: i64,
    pub bump: u8,
}

impl EvidenceAccount {
    pub const LEN: usize = 8 + (4 + 32) + 32 + 32 + 32 + 1 + 2 + 8 + 1;
}
