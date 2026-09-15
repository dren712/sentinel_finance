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

    #[msg("Promise is not in a valid state for execution")]
    InvalidPromiseStatus,

    #[msg("Arithmetic overflow or division by zero in postcondition calculation")]
    MathOverflow,
}
