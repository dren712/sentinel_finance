# Sentinel Finance — Security Model & Invariant Guarantees

## 1. Threat Model & Trust Boundaries

### Delegation Without Loss of Control
Traditional bot and agent delegation gives an agent custody of funds or unrestricted instruction access. If an autonomous model malfunctions, drifts, or suffers prompt injection, it can drain liquidity or over-concentrate into a single volatile stock.

**Sentinel's Guarantee**:
Even if an autonomous model attempts an extreme, non-compliant, or malicious action, **the Solana transaction boundary enforces postconditions authoritatively**. The state transition fails to commit.

---

## 2. Invariant Math & Precision Rules

1. **Integer Arithmetic**: All calculations in the Anchor program and TypeScript engine operate in basis points (`1 bp = 0.01%`, `10,000 bps = 100%`).
2. **Overflow Safety**: All arithmetic operations in Rust use `checked_mul`, `checked_div`, and `checked_add`, returning `SentinelError::MathOverflow` upon any invalid mathematical state.
3. **No Frontend-Only Checks**: While the UI renders preflight feedback for user experience, the Anchor program independently computes:
   - `target_exposure_bps = (post_target_usd * 10,000) / post_total_usd`
   - `reserve_exposure_bps = (post_stable_usd * 10,000) / post_total_usd`
   - `size_check = trade_amount_usd <= policy.max_trade_value_usd`
4. **Atomic Transaction Reversal**: Rejection terminates the instruction before any token CPI or balance mutation commits.

---

## 3. Account Validation & Authority Constraints

- **Owner-Bound PDAs**: `PolicyAccount` is seeded by `[b"policy", owner.key()]`, ensuring only the owner can modify policy parameters.
- **Version Tracking**: `policy_version` increments on updates, invalidating any in-flight promises targeting an older policy version.
- **Explicit Failure Codes**: Rejection reasons are machine-readable and anchored in the PROVN record:
  - `ERR_EXPOSURE_EXCEEDED`
  - `ERR_STABLECOIN_RESERVE_BREACHED`
  - `ERR_TRADE_SIZE_EXCEEDED`
  - `ERR_SLIPPAGE_EXCEEDED`
  - `ERR_INSUFFICIENT_FUNDS`
  - `ERR_STALE_POLICY`
  - `ERR_UNAUTHORIZED`
