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

    #[msg("Pyth oracle quote is older than 60s maximum allowed age")]
    StaleOraclePrice,

    #[msg("Pyth oracle confidence interval is wider than allowable threshold")]
    WideConfidenceInterval,

    #[msg("Pyth price feed ID does not match the target asset mint feed")]
    MismatchedFeedId,

    #[msg("Pyth price feed ID does not match the stored feed ID for this asset")]
    FeedMismatch,

    #[msg("Pyth oracle price is stale (> 60 seconds)")]
    StaleOracle,

    #[msg("Pyth oracle confidence interval is wider than policy tolerance")]
    ConfidenceTooWide,

    #[msg("Price account is not verified by Pyth or has invalid verification level/owner")]
    UnverifiedPrice,

    #[msg("Vault is not in active state")]
    VaultNotActive,

    #[msg("Vault is not in quarantined state")]
    VaultNotQuarantined,

    #[msg("No policy violation detected for vault")]
    NoViolation,

    #[msg("Violation has not persisted across confirmation slots")]
    ViolationNotConfirmed,

    #[msg("Recovery window has not expired yet")]
    RecoveryNotExpired,

    #[msg("Recovery window has expired or is not open")]
    RecoveryWindowClosed,

    #[msg("Provided recovery nonce does not match current vault recovery nonce")]
    StaleRecoveryNonce,

    #[msg("Recovery violates portfolio value conservation bounds")]
    ValueConservationBreached,

    #[msg("Recovery failed to restore compliant portfolio policy invariants")]
    PostconditionFailed,

    #[msg("Recovery sold beyond allowed oversell band")]
    OversellGuard,

    #[msg("Recovery sell amount is zero or exceeds position holdings")]
    InvalidAmount,

    #[msg("Policy version does not match policy version at quarantine or policy mutated during recovery")]
    PolicyFrozenDuringRecovery,

    #[msg("Vault must be configured with exactly one volatile asset position")]
    InvalidVolatileAssetConfiguration,
}
