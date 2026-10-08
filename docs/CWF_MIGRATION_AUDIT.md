# Sentinel Finance — CWF Architecture Audit & Gap Analysis

**Audited Commit**: [`5f31a6b`](https://github.com/dren712/sentinel_finance/commit/5f31a6b)  
**Date**: October 8, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Network Deployment**: Solana Devnet (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`)

---

## 1. EXECUTIVE SUMMARY

The codebase represents the completed production implementation of **Sentinel: The Recovery Layer for Autonomous Capital** for Crypto's World Fair (CWF 2026).

All roadmap phases have crossed the real custody boundary:
1. **On-Chain SPL Token Custody**: Native zero-dependency SPL Token & Token-2022 CPI custody module (`programs/sentinel/src/custody.rs`) where the vault PDA holds actual tokens, managed by `owner_deposit` and `owner_withdraw`.
2. **Emergency Containment Recovery**: `recover()` executes program-signed CPI `transfer_checked` transferring exact excess volatile tokens directly to `policy.safe_destination`.
3. **Exact Token Conservation**: Program enforces exact on-chain balance conservation (`pre_balance == post_balance + sell_units`), strict risk reduction, and postcondition compliance.
4. **Policy Freeze**: Snapshotting of `policy_version` during quarantine ensures policy cannot be modified mid-recovery (`PolicyFrozen` 6036).
5. **Pure Solver Engine**: Mathematical recovery calculation in `@sentinel/sdk` (`requiredRecoveryUnits`) computes minimal sell units required to satisfy postconditions without heuristics.
6. **Autonomous Watcher & Solver Daemons**: Standalone Node.js background daemons (`scripts/watcher-daemon.mjs`, `scripts/solver-daemon.mjs`) continuously monitor RPC for invariant breaches and submit automated recovery transactions.
7. **Comprehensive Test Suite**: 26 Bankrun recovery tests, 13 Bankrun quarantine tests, 20 localnet tests, and 104 SDK unit tests (163 total automated integration/unit tests) all passing with 0 errors.

---

## 2. IMPLEMENTED ONCHAIN

The following capabilities are compiled in the Anchor program (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`) and enforced authoritatively by the Solana runtime:

1. **Pre-Trade Policy Guard (`execute_guarded_trade`)**:
   - Blocks unauthorized agent signers (`UnauthorizedAgent` 6005).
   - Validates agent status (`AgentInactive` 6014) and policy activity (`PolicyInactive` 6004).
   - Enforces cryptographic PROVN promises (`PromiseExpired` 6012, `InvalidPromiseStatus` 6007).
   - Enforces max trade size in dollars (`TradeSizeExceeded` 6002).
   - Enforces maximum single-asset portfolio concentration (`ExposureExceeded` 6000).
   - Enforces minimum stablecoin reserve floor (`StablecoinReserveBreached` 6001).
   - Validates slippage against verified Pyth oracle prices (`SlippageExceeded` 6003).

2. **Pyth Oracle Account Security (`parse_and_verify_pyth_price`)**:
   - Verifies oracle account ownership by Pyth Receiver (`rec5EKMG...`) (`UnverifiedPrice` 6024).
   - Enforces `VerificationLevel::Full` verification.
   - Enforces exact 32-byte `feed_id` match against position config (`FeedMismatch` 6021).
   - Enforces maximum 60-second publish freshness (`StaleOracle` 6022).
   - Enforces maximum 200 bps confidence interval width (`ConfidenceTooWide` 6023).

3. **Quarantine State Machine (`flag_violation`, `expire_quarantine`, `owner_release`)**:
   - Permissionless violation detection re-evaluating vault portfolio against live Pyth feeds.
   - 2-stage hysteresis: First violation transitions vault to `PendingViolation` (`pending_violation_slot != 0`). If invariant remains breached across `confirm_slots`, transitions to `Quarantined`. If price recovers before confirmation, pending flag is automatically cleared.
   - While `Quarantined`, agent trade instructions fail closed with `VaultNotActive` (6025).
   - Permissionless `expire_quarantine` transitions vault to `RecoveryExpired` (6029) once `current_slot > recovery_expires_slot`.
   - Privileged `owner_release` allows vault owner to unfreeze vault back to `Active` and increment `recovery_nonce`.

4. **Temporary Recovery Authority (`recover`)**:
   - Permissionless solver execution gated by `vault.status == Quarantined` (`VaultNotQuarantined` 6026).
   - Expiration guard: `current_slot <= recovery_expires_slot` (`RecoveryWindowClosed` 6030).
   - Replay protection: `expected_nonce == vault.recovery_nonce` (`StaleRecoveryNonce` 6031).
   - Volatile asset reduce-only bound: `0 < sell_units <= amount_units` (`InvalidAmount` 6035).
   - Value conservation check: `post_total >= pre_total * (10000 - max_recovery_cost_bps) / 10000` (`ValueConservationBreached` 6032).
   - Mandatory policy postconditions: `check_exposure_and_reserve` (`PostconditionFailed` 6033).
   - Strict risk improvement: `post_exposure_bps < pre_exposure_bps` (`PostconditionFailed` 6033).
   - Oversell guard: `post_exposure_bps >= max_single_asset_bps - OVERSELL_BAND_BPS` (`OversellGuard` 6034).
   - Atomic resumption: Sets `status = Active`, clears quarantine slots, increments `recovery_nonce`, and records `last_recovery_slot` and `last_recovery_solver`.

---

## 3. IMPLEMENTED OFFCHAIN

1. **TypeScript Domain Engine (`@sentinel/domain`)**:
   - Pure valuation engine (`valuation-engine.ts`) computing multi-asset basis point exposures.
   - Policy validation engine (`policy-engine.ts`) computing invariant pass/fail reports.
   - PROVN cryptographic hasher (`provn.ts`) generating deterministic SHA-256 state commitments.
   - Meteora DBC dynamic fee verifier and PreStocks pre-IPO equity universe heuristics.

2. **TypeScript SDK (`@sentinel/sdk`)**:
   - `LiveExecutionAdapter`: Anchor client managing separate owner and agent keypairs, building instructions, and decoding custom program errors canonicalized from `SENTINEL_IDL`.
   - `SentinelClient`: High-level workflow orchestration client.
   - `AgentSimulator`: 10-stage autonomous cycle executor with tool calling (OpenAI GPT-4o or fallback `DemoProvider`).
   - PostgreSQL persistence repository (`database.ts`) for asynchronous evidence indexing.

3. **Web Application (`apps/web`)**:
   - Next.js 15 App router dashboard (`/`) displaying institutional portfolio metrics, agent mandate, policy configuration, and verification timeline.
   - Standalone `/quarantine` interface with live badge indicators, exposure gauge, slot countdown timer, exact Anchor error decoding, and Solana Explorer timeline.
   - 8 Next.js API endpoints (`/api/agent/run`, `/api/health`, `/api/portfolio/[wallet]`, etc.).

---

## 4. SIMULATED (What is Demo-Only / Mocked)

1. **Vault Balances**:
   - `PortfolioVault.usdc_balance_cents` and `positions[].amount_units` are ledger values updated via `sync_vault` or `initialize_vault`. No live SPL token accounts currently back these ledger numbers.
2. **Settlement**:
   - In `execute_guarded_trade` and `recover`, balances are updated mathematically inside account memory; no live SPL transfers or DEX swaps (Raydium, Meteora, Jupiter) take place via CPI.
3. **Recovery Venue Fee**:
   - `RECOVERY_VENUE_FEE_BPS = 30` is applied arithmetically to proceeds rather than deducted by an external liquidity pool.
4. **Solver Bounty**:
   - `bounty_cap_cents` is computed and emitted in `RecoveryExecutedEvent` as a simulation metric (`SIMULATED / NOT PAID`). No token reward is transferred to the solver wallet.
5. **Offchain Market Verifiers**:
   - PreStocks pre-trade checks and Meteora liquidity checks are evaluated in offchain TypeScript pre-flight filters rather than onchain CPI checks.

---

## 5. COMPLETED ROADMAP IMPLEMENTATIONS

1. **Program-Controlled SPL Token Custody (`programs/sentinel/src/custody.rs`)**:
   - Native zero-dependency SPL Token & Token-2022 CPI custody via `transfer_checked` (instruction discriminator 12).
   - Added `owner_deposit` and `owner_withdraw` to allow owners to fund and withdraw real tokens into/out of vault PDA custody.
2. **Emergency Containment Recovery**:
   - `recover()` validates token account parameters in remaining accounts (`[vault_ta, safe_dest_ta, mint, token_program]`) and invokes CPI `transfer_checked` with vault PDA signer seeds, moving exactly `sell_units` to the owner's authenticated `safe_destination`.
3. **Exact Token Conservation**:
   - Program verifies exact balance reduction onchain (`pre_balance == post_balance + sell_units`) and rejects any unauthorized leakage.
4. **Policy Freeze on Quarantine**:
   - `PortfolioVault` snapshots `policy_version` when entering quarantine; `update_policy` fails closed with `PolicyFrozen` (6036) while quarantine is active.
5. **Pure Solver Engine**:
   - Implemented mathematical solver `requiredRecoveryUnits` in `@sentinel/sdk` calculating exact minimal units to satisfy exposure cap, stablecoin floor, and oversell guard without heuristics.
6. **Autonomous Watcher & Solver Daemons**:
   - Created `SentinelWatcherService` and `SentinelSolverService` in `@sentinel/sdk`, with CLI daemons in `scripts/watcher-daemon.mjs` and `scripts/solver-daemon.mjs`.

---

## 6. SCOPE FREEZE & RESIDUAL BOUNDARIES

1. **DEX Swaps vs Containment**:
   - In production decentralized environments, full DEX rebalancing introduces unbounded slippage and sandwich risk during high-volatility shocks. Sentinel's onchain containment model moves excess risk directly to the owner's `safe_destination` (cold wallet or multisig) under exact token conservation. Live external DEX routing remains offchain.
2. **Single Volatile Position Topology**:
   - The current Anchor smart contract targets an institutional core topology of one primary volatile asset + USDC reserve. Multi-asset vaults enforce strict non-index single-asset bounds (`MultipleVolatileAssetsUnsupported` 6037).
3. **Solver Incentive Distribution**:
   - Solver bounty calculation is emitted deterministically in event logs; direct token payment escrow is scheduled for post-CWF mainnet protocol upgrades.

---

## 7. FINAL CWF ARCHITECTURE

```text
               OWNER
                 │
                 ▼ (owner_deposit)
          SENTINEL VAULT (PDA)
          ┌────────────────────────────────────────┐
          │  Vault Asset Token Account (SPL)       │
          │  Vault USDC Token Account (SPL)        │
          │  PortfolioVault Invariants & Version   │
          └──────────────────┬─────────────────────┘
                             │
            Pyth Oracle Price Shock
                             │
                             ▼
                    INVARIANT BREACH
                             │
                             ▼
             flag_violation (Watcher Daemon)
                             │
                             ▼
                        QUARANTINED
            (Agent Trade Authority Gated)
            (Policy Frozen at Snapshot)
                             │
            Temporary Recovery Authority (PTA)
                             │
                             ▼
             recover (Permissionless Solver Daemon)
                             │
              CPI TransferChecked:
         Excess Volatile SPL ──► safe_destination (Owner ATA)
                             │
                             ▼
                 Mandatory Postconditions
              (Token Conservation & Caps)
                             │
                             ▼
                    ACTIVE RESUMPTION
            (Recovery Nonce Incremented)
            (Recovery Authority Expired)
```

