use anchor_lang::prelude::*;

#[error_code]
pub enum SentinelError {
    #[msg("Post-trade single-asset exposure exceeds maximum allowed by policy")]
    ExposureExceeded,

    #[msg("Post-trade stablecoin reserve breaches minimum required threshold")]
    StablecoinReserveBreached,

    #[msg("Proposed trade size exceeds policy maximum")]
    TradeSizeExceeded,

    #[msg("Execution price slippage exceeds policy tolerance")]
    SlippageExceeded,

    #[msg("The specified policy is inactive")]
    PolicyInactive,

    #[msg("The caller is not authorized as the agent authority")]
    UnauthorizedAgent,

    #[msg("The caller is not authorized to execute this promise")]
    UnauthorizedExecution,

    #[msg("Promise is not in a valid state for execution")]
    InvalidPromiseStatus,

    #[msg("Arithmetic overflow or division by zero in postcondition calculation")]
    MathOverflow,

    #[msg("Policy basis points must be between 0 and 10,000")]
    InvalidPolicyBounds,

    #[msg("Target asset mint not found in portfolio vault")]
    AssetNotFound,

    #[msg("Vault does not have sufficient stablecoin balance to fund trade")]
    InsufficientStablecoinReserve,

    #[msg("Promise has expired and can no longer be executed")]
    PromiseExpired,

    #[msg("Security domain mismatch: Agent, Policy, and Vault must share the same owner")]
    SecurityDomainMismatch,

    #[msg("The agent account is currently paused or inactive")]
    AgentInactive,

    #[msg("Executed trade amount does not match the authorized promise amount")]
    TradeAmountMismatch,

    #[msg("Invalid trade direction: only 0 (BUY) and 1 (SELL) are permitted")]
    InvalidTradeDirection,

    #[msg("Missing, zero, or invalid market price: execution fails closed")]
    InvalidPrice,
}
