# Sentinel Finance — Crypto's World Fair (CWF) Submission

## One-Line Pitch
Sentinel is an autonomous portfolio execution engine on Solana that locks out misbehaving AI agents upon invariant breach and lets permissionless solvers safely rebalance the vault back to compliance.

## 50-Word Pitch
Autonomous trading agents frequently drift into catastrophic concentration or cash depletion during volatility. Sentinel binds agent execution to owner-defined on-chain invariants. When breaches occur, the agent is locked into quarantine, and permissionless solvers execute reduce-only rebalancing under strict value conservation and Pyth oracle verification to safely restore the vault to active status.

---

## How It Works (4 Core Steps)

1. **Guarded Trade Execution with Postcondition Invariants**:
   The owner defines portfolio risk bounds (`max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`) on-chain. The autonomous agent proposes trades that must satisfy pre- and post-state checks verified against an authenticated Pyth price feed. If a proposed trade violates policy, it is rejected deterministically.
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`execute_guarded_trade`, `check_exposure_and_reserve`)

2. **Permissionless Violation Flagging & Hysteresis Quarantine**:
   If external price moves or ledger updates cause vault holdings to violate policy invariants, any watcher or solver can call `flag_violation`. The first flag records a pending violation slot; after a configurable hysteresis window (`confirm_slots`), a second flag transitions the vault into `Quarantined`. In this state, the agent's trading authority is immediately locked out (`VaultNotActive`).
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`flag_violation`), [`packages/sdk/src/adapters/execution-adapter.ts`](../../packages/sdk/src/adapters/execution-adapter.ts) (`flagViolation`)

3. **Reduce-Only Solver Recovery under Value Conservation**:
   During the open recovery window (`recovery_window_slots`), any external solver can permissionlessly call `recover()`. The solver can only sell volatile assets into USDC (reduce-only). On-chain checks enforce value conservation (loss capped at `max_recovery_cost_bps`), strict risk improvement, and an oversell guard (`OVERSELL_BAND_BPS = 500`) to prevent over-liquidation.
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`recover`, `compute_recovery_proceeds`, `check_value_conservation`, `check_oversell_guard`)

4. **Replay Protection & Autonomous Resumption**:
   Upon successful recovery, the vault status atomically reverts to `Active`, the recovery nonce increments (protecting against replay and stale states), and audit fields (`last_recovery_slot`, `last_recovery_solver`) are recorded. Once the vault is active again, the autonomous agent regains normal trading authority within policy constraints.
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`recover`), [`apps/web/src/app/quarantine/page.tsx`](../../apps/web/src/app/quarantine/page.tsx)

---

## What is Real vs Simulated

| Component | Status | Implementation Details |
| :--- | :--- | :--- |
| **On-Chain Policy Invariants** | **REAL** | Anchor smart contract enforces concentration caps, stablecoin floors, trade caps, and slippage on Solana Devnet. |
| **Pyth Network Oracle Read** | **REAL** | `parse_and_verify_pyth_price` validates account ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`), Full verification level, 32-byte `feed_id`, max 60s freshness, and max 200 bps confidence on Devnet. |
| **Quarantine & Lockout State Machine** | **REAL** | `Active` ➔ `PendingViolation` ➔ `Quarantined` ➔ `Active` / `RecoveryExpired` transitions enforced on-chain with hysteresis slots and replay nonces. |
| **Solver Recovery Instruction** | **REAL** | On-chain `recover()` instruction with integer arithmetic, value conservation bounds, oversell guard, and postcondition verification. |
| **Bankrun & Localnet Test Coverage** | **REAL** | 17 slot-warped Bankrun recovery tests, 13 Bankrun quarantine tests, 20 Anchor localnet tests, and 28 Cargo unit tests passing (100% real assertion of error codes). |
| **Live Devnet Transactions** | **REAL** | 6 verified on-chain transactions on Solana Devnet recorded with signatures, slots, and Explorer confirmation. |
| **Vault Asset Balances** | **SIMULATED** | Balances (`usdc_balance_cents`, `amount_units`) are owner-synced ledger entries written via `sync_vault`, not live SPL token accounts. |
| **Recovery Asset Settlement** | **SIMULATED** | Asset rebalancing is simulated inside the vault ledger at the verified Pyth price minus a 30 bps venue fee. No live DEX CPI swap occurs. |
| **Solver Bounty Payout** | **SIMULATED** | Bounty calculation (`bounty_cap_cents`) is computed and emitted in `RecoveryExecutedEvent` as an informational metric; no token disbursement takes place on-chain. |

---

## Prior Art

Existing safety architectures in decentralized finance address operational failures in specific ways:
- **Drift Vaults**: Utilizes temporary reduce-only liquidators to de-risk underwater margin accounts when liquidation thresholds are crossed.
- **Morpho Vault V2**: Employs sentinel addresses with pause-only emergency authorities to freeze lending vaults during anomalous events.
- **Lighthouse**: Provides transaction-level assertions on account data balances to revert transactions that breach expected states.
- **Phylax**: Uses off-chain monitoring networks to pause protocol contracts before malicious transactions confirm.

Sentinel adapts these concepts specifically for autonomous AI agents managing discretionary portfolios:
1. **Owner-Defined Invariants**: Risk bounds are set by the portfolio owner rather than protocol liquidation parameters.
2. **Targeted Agent Lockout**: Agent signing keys are locked out while preserving owner release authority.
3. **Permissionless Solver Rebalancing**: Any third-party solver can rebalance the vault back into compliance.
4. **Value Conservation Bounds**: Proposed rebalancing must prove on-chain that portfolio value is not eroded beyond `max_recovery_cost_bps`.
5. **Recovery Expiry**: Quarantines have bounded lifespans (`recovery_window_slots`) to prevent indefinite solver exposure.

We found no directly matching implementation in the prior art we reviewed.

---

## Customer Validation

No customer conversations yet.

---

## CWF Disclosure Statement

- **Baseline Commit**: [`f8734ef`](https://github.com/dren712/sentinel_finance/commit/f8734ef) (Tagged `stocklana-baseline`, representing the state prior to CWF additions).
- **Work Completed for CWF (Post-September 14)**:
  - Commit [`be93523`](https://github.com/dren712/sentinel_finance/commit/be93523): Phase 0 — Branched `cwf/main` and deployed dedicated CWF Program ID `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` to Solana Devnet.
  - Commit [`d8451d5`](https://github.com/dren712/sentinel_finance/commit/d8451d5): Phase A — Removed price bypass, enforced Pyth Receiver ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`), added `feed_id` matching, freshness/confidence checks, test fixtures, and verified with 6 Anchor localnet tests.
  - Commit [`900f80c`](https://github.com/dren712/sentinel_finance/commit/900f80c): Phase B — Implemented quarantine state machine skeleton (`Active`, `Quarantined`, `RecoveryExpired`), hysteresis flagging, agent lockout, owner release, 13 slot-warped Bankrun tests, and live Devnet transaction flow.
  - Commit [`a5ad3a2`](https://github.com/dren712/sentinel_finance/commit/a5ad3a2): Phase 0 Fixes — Corrected commit hash citations in disclosure log and documented honest trust boundaries.
  - Commit [`efe194f`](https://github.com/dren712/sentinel_finance/commit/efe194f): Phase 1 — Implemented on-chain `recover()` instruction with reduce-only math, value conservation, oversell guard, postcondition validation, and 28 Cargo unit tests.
  - Commit [`67ca828`](https://github.com/dren712/sentinel_finance/commit/67ca828): Phase 2 — Built comprehensive 17-test Bankrun recovery suite with slot warping asserting exact error codes.
  - Commit [`42e9f23`](https://github.com/dren712/sentinel_finance/commit/42e9f23): Phase 3 — Updated TypeScript SDK and IDL, upgraded Devnet program, executed full live Devnet recovery flow with Pyth oracle, and saved transaction evidence to `docs/cwf/devnet-evidence.json`.
  - Commit [`14a8387`](https://github.com/dren712/sentinel_finance/commit/14a8387): Phase 4 — Implemented `/quarantine` web page with real on-chain vault state, exposure vs cap, recovery window countdown, exact error decoding, and authoritative event timeline.
