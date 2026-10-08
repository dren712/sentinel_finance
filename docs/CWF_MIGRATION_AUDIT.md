# Sentinel Finance — CWF Migration Audit & Architecture Gap Analysis

**Source-of-Truth Commit Inspected**: [`de1ccaff67ce185b14f26b82b8d7d19bfe181dd6`](https://github.com/dren712/sentinel_finance/commit/de1ccaff67ce185b14f26b82b8d7d19bfe181dd6)  
**Date**: October 8, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  

---

## 1. CURRENT (What Exists in `de1ccaf`)

The codebase at `de1ccaf` is a monorepo consisting of:
- **`programs/sentinel/src/`**: Anchor 0.30.1 Solana Program (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` on Devnet).
  - State accounts: `AgentAccount`, `PolicyAccount`, `PortfolioVault`, `PromiseAccount`, `EvidenceAccount`.
  - Core trade instructions: `initialize_agent`, `initialize_policy`, `update_policy`, `initialize_vault`, `sync_vault`, `set_agent_active`, `create_promise`, `execute_guarded_trade`, `reject_promise`, `record_evidence`.
  - Phase B quarantine instructions: `flag_violation` (permissionless watcher with 2-stage hysteresis), `owner_release` (owner-only recovery back to Active), `expire_quarantine` (permissionless expiration to `RecoveryExpired`).
  - Pyth oracle parser: `parse_and_verify_pyth_price` validating `rec5EKMG...` account ownership, Full verification level, 32-byte `feed_id`, max 60s freshness, max 200 bps confidence.
- **`packages/domain/`**:
  - Pure TypeScript policy engine (`policy-engine.ts`), asset registry (`asset-registry.ts`), valuation engine (`valuation-engine.ts`), PROVN cryptographic hasher (`provn.ts`), Meteora and PreStocks verification heuristics.
- **`packages/sdk/`**:
  - `LiveExecutionAdapter` (`execution-adapter.ts`): Anchor client with split keypair handling (`OWNER` vs `AGENT`), promise creation, trade execution, violation flagging, and owner release.
  - `SentinelClient` (`client.ts`), `AgentSimulator` (`agent-simulator.ts`), `LlmProvider` (`llm-provider.ts` with OpenAI GPT-4o tool calling + `DemoProvider`), `PortfolioIndexer` (`portfolio-indexer.ts`), PostgreSQL persistence client (`database.ts`).
- **`apps/web/`**:
  - Next.js 15 App router frontend (`page.tsx`), Tailwind CSS, Solana wallet adapter (`@solana/wallet-adapter-react`).
  - 8 Next.js API routes (`/api/agent/run`, `/api/agent/status`, `/api/health`, `/api/portfolio/[wallet]`, `/api/policy/[wallet]`, `/api/market/[asset]`, `/api/activity/[wallet]`, `/api/evidence/[decision]`).
  - PostgreSQL schema and read repository in `apps/web/src/lib/database.ts`.
  - Deployment assets: standalone production `Dockerfile` with multi-stage build, `docker-compose.yml`, `railway.json`.
- **`tests/`**:
  - `sentinel-localnet.test.ts`: 20 Anchor integration tests covering slippage, trade size, concentration, stable floor, promise expiry, owner-only sync, Pyth feeds, and valid trades.
  - `bankrun-quarantine.test.ts`: 13 Bankrun tests with slot warping covering `flag_violation`, hysteresis, agent trade gating (`VaultNotActive`), owner release, expiration, and oracle verification.
- **`scripts/`**:
  - `devnet-quarantine-flow.mjs`: Live Devnet script for policy/vault init, violation flagging, and owner release.
  - `make-price-fixture.mjs`: Localnet Pyth `PriceUpdateV2` fixture generator.

---

## 2. IMPLEMENTED (What Genuinely Works On-Chain)

1. **On-Chain Policy Invariants & Atomic Reversion**:
   - `execute_guarded_trade` deterministically reverts if single-asset exposure > `max_single_asset_bps` (`ExposureExceeded` 6005), stablecoin reserve < `min_stablecoin_bps` (`StablecoinReserveBreached` 6006), trade size > `max_trade_value_usd` (`TradeSizeExceeded` 6000), or promise expired (`PromiseExpired` 6004).
2. **Pyth Oracle Account Security (`parse_and_verify_pyth_price`)**:
   - Forged or program-owned oracle accounts are rejected (`UnverifiedPrice` 6024).
   - Feed ID mismatch against position config is rejected (`FeedMismatch` 6021).
   - Stale prices (>60s) are rejected (`StaleOracle` 6022).
   - Confidence intervals wider than 200 bps are rejected (`ConfidenceTooWide` 6023).
   - Partial verification is rejected (`UnverifiedPrice` 6024).
3. **Quarantine State Machine Skeleton (Phase B)**:
   - `flag_violation` re-evaluates vault invariants against live Pyth oracle prices.
   - Hysteresis confirmation (`confirm_slots`) prevents single-slot noise from triggering quarantine.
   - Vault transitions from `Active` ➔ `PendingViolation` ➔ `Quarantined`.
   - While `Quarantined`, agent instructions `execute_guarded_trade` and `create_promise` fail closed with `VaultNotActive` (6025).
   - `owner_release` atomically restores `Active` status and increments `recovery_nonce`.
   - `expire_quarantine` permissionlessly marks `RecoveryExpired` after `recovery_expires_slot`.
4. **Split-Key Security Partition**:
   - Owner keys can mutate policy and sync vault; agent keys cannot.
   - Non-owner `sync_vault` fails on-chain.
5. **PROVN Evidence Commitment**:
   - SHA-256 pre-state and post-state hashes anchored in on-chain `EvidenceAccount` PDAs.

---

## 3. SIMULATED (What is Demo-Only / Mocked)

1. **Vault Asset Balances**:
   - `PortfolioVault.usdc_balance_cents` and `positions[].amount_units` are ledger values updated via `sync_vault` or `initialize_vault`. There are no live SPL token transfers or vault token escrow accounts.
2. **Trade Settlement**:
   - In `execute_guarded_trade`, ledger units are adjusted, but no live DEX swaps (Meteora/Raydium/Jupiter) take place on-chain.
3. **PreStocks & Meteora Pre-Trade Verifiers**:
   - Evaluated off-chain in TypeScript heuristics before generating transactions; not verified inside Anchor CPI.
4. **Autonomous Agent Strategy Execution**:
   - If `OPENAI_API_KEY` is not present, the system falls back to scripted `DemoProvider` proposals.
5. **Venue Fee Deduction**:
   - `RECOVERY_VENUE_FEE_BPS` (30 bps) is simulated inside ledger arithmetic rather than deducted by a real DEX pool.
6. **Solver Bounty**:
   - Solver bounty (`max_bounty_bps`) is computed and emitted in events as `bounty_cap_cents`; no on-chain token payout occurs.

---

## 4. MISSING (What CWF Requires)

1. **The Core Recovery Instruction (`recover`)**:
   - In `de1ccaf`, there is **no `recover` instruction** in `programs/sentinel/src/lib.rs`.
   - A quarantined vault can only be unfrozen by `owner_release` (manual owner intervention).
   - The primary CWF thesis — **Proof-Triggered Temporary Authority (PTA)** where an external permissionless solver executes reduce-only rebalancing under mandatory postconditions — is completely absent at `de1ccaf`.
2. **Value Conservation Invariant Check**:
   - No mathematical guarantee on-chain that solver recovery does not drain vault value beyond `max_recovery_cost_bps`.
3. **Oversell Guard**:
   - No check preventing a solver from over-liquidating the volatile asset beyond what is necessary to satisfy the policy cap.
4. **Strict Risk Improvement Check**:
   - No check asserting that post-recovery exposure is strictly lower than pre-recovery exposure.
5. **Solver Audit Metadata**:
   - `PortfolioVault` lacks `last_recovery_slot` and `last_recovery_solver` tracking fields.
6. **Recovery Test Suite**:
   - Zero tests for solver recovery, solver races, value conservation breaches, overselling, stale nonces, or replay attacks.
7. **Quarantine & Recovery Frontend Surface**:
   - The web app at `de1ccaf` only displays the Stocklana pre-trade prevention dashboard (`Overview`, `Portfolio`, `Agent`, `Protection`, `Verification`, `Activity`). There is no quarantine status badge, no recovery window countdown, and no solver recovery trigger interface.
8. **Devnet Recovery Evidence**:
   - No recorded Devnet transactions demonstrating solver recovery (`recover`).

---

## 5. MISLEADING (Claims Not Supported by Implementation at `de1ccaf`)

1. **"Rollback" Terminology**:
   - Baseline docs sometimes state Sentinel "rolls back" trades. Sentinel does not rewind Solana history; it atomically reverts non-compliant transactions before state commits.
2. **SPL Token Custody**:
   - The UI displays token symbols (`NVDAx`, `AAPLx`, `USDC`), but assets are tracked on an internal Anchor ledger rather than circulating SPL tokens.
3. **Meteora DBC Pool Liquidity Verification**:
   - Promoted as on-chain verification, but `MeteoraDbcMarketQualityVerifier` is an off-chain TypeScript check.
4. **Permissionless Recovery Complete**:
   - Prior disclosure logs listed Phase B skeleton as if the recovery loop was operational, but without `recover()`, no solver could actually rebalance the vault.

---

## 6. REUSABLE (Stocklana Infrastructure to Keep for CWF)

1. **Anchor Project Structure & Toolchain**:
   - Clean Anchor 0.30.1 setup, PDA derivations, seed conventions (`[b"vault", owner]`, `[b"policy", owner]`).
2. **Pyth Oracle Integration**:
   - `parse_and_verify_pyth_price` is hardened, tested, and reliable. Can be reused verbatim for recovery repricing.
3. **Deterministic Integer Math**:
   - Cents (`u64`) and basis points (`u16`) calculations prevent floating-point vulnerabilities on-chain.
4. **TypeScript SDK & Monorepo Tooling**:
   - `@sentinel/domain`, `@sentinel/sdk`, pnpm workspace build scripts, Bankrun test setup.
5. **Autonomous Agent Loop**:
   - Typed `TradeIntent` schemas, structured headroom recalculations, LLM connector.
6. **Design System & Visual Layer**:
   - Dark theme styling, high contrast tokens, clean card components.

---

## 7. DELETE (Obsolete Code / Docs to Prune or Archive)

1. Stale migration workflows and legacy test scripts that do not run against the current Anchor program.
2. Unused temporary mock price instruction remnants (`post_price_update` was already deleted in Phase A, but check SDK stubs).
3. Outdated hackathon claims in documentation that do not map to running tests.

---

## 8. CHANGE (Required Architectural Changes for CWF)

1. **Anchor Program (`programs/sentinel/src`)**:
   - Add `recover(sell_units: u64, expected_nonce: u64)` instruction to `lib.rs`.
   - Add `last_recovery_slot: u64` and `last_recovery_solver: Pubkey` to `PortfolioVault` (update `LEN` to 878).
   - Add error codes: `RecoveryWindowClosed` (6030), `StaleRecoveryNonce` (6031), `ValueConservationBreached` (6032), `PostconditionFailed` (6033), `OversellGuard` (6034), `InvalidAmount` (6035).
   - Implement pure functions: `compute_recovery_proceeds`, `check_value_conservation`, `check_oversell_guard`, `check_strict_improvement`.
2. **Bankrun Test Suite (`tests/bankrun-recovery.test.ts`)**:
   - 17 slot-warped test cases asserting exact error codes for all happy path, boundary, adversarial, and race scenarios.
3. **TypeScript SDK (`packages/sdk`)**:
   - Implement `recover()` on `LiveExecutionAdapter`.
   - Update IDL and typings with recovery fields and events.
4. **Devnet Verification**:
   - Run end-to-end devnet recovery flow: `initialize_vault` ➔ `sync_vault` (violation) ➔ `flag_violation` (pending) ➔ wait ➔ `flag_violation` (quarantined) ➔ `recover` (Active).
   - Record and verify all transaction signatures in `docs/cwf/devnet-evidence.json`.
5. **Minimal UI (`apps/web/src/app/quarantine/page.tsx`)**:
   - Dedicated `/quarantine` page displaying live on-chain status badge, exposure vs cap, recovery window countdown, exact error decoding, and transaction timeline with Solana Explorer links.
   - Prominently labeled: *"Ledger-based vault. Simulated settlement."*
6. **Documentation Overhaul**:
   - Synchronize `docs/CLAIMS.md`, `docs/cwf/STATE_MACHINE.md`, `docs/cwf/DISCLOSURE.md`, `docs/cwf/SUBMISSION_CWF.md`, and `docs/cwf/DEMO_CWF.md`.
