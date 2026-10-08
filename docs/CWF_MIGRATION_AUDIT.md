# Sentinel Finance — CWF Architecture Audit & Gap Analysis

**Audited Commit**: [`8c0b1264decbc451d1cfe1ab0f225166d07029d1`](https://github.com/dren712/sentinel_finance/commit/8c0b1264decbc451d1cfe1ab0f225166d07029d1)  
**Date**: October 8, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Network Deployment**: Solana Devnet (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`)

---

## 1. EXECUTIVE SUMMARY

The codebase at commit `8c0b1264decbc451d1cfe1ab0f225166d07029d1` represents the completed Phase 0–5 prototype of **Sentinel: The Recovery Layer for Autonomous Capital**.

Unlike earlier pre-CWF revisions (such as `de1ccaf`), the current repository is no longer a blank skeleton:
1. It contains a fully working, onchain `recover()` instruction in `programs/sentinel/src/lib.rs`.
2. It includes a complete 3-state onchain state machine (`Active` / `Quarantined` / `RecoveryExpired`) with 2-stage hysteresis confirmation (`PendingViolation`).
3. It validates Pyth price updates with full cryptographic ownership and feed ID verification.
4. It includes 17 Bankrun recovery tests, 13 Bankrun quarantine tests, 20 localnet tests, and 97 SDK/domain unit tests (175/175 tests passing).
5. It features a standalone Next.js 15 web interface at `/quarantine` and confirmed Solana Devnet transactions.

**The Primary Technical Boundary**: While the onchain state machine, invariant gating, hysteresis, replay protection, value conservation, and oversell guard are fully functioning, **settlement is currently conducted at the ledger level inside `PortfolioVault` rather than via direct SPL Token custody**. This document details the exact boundary between implemented onchain code, offchain orchestration, simulations, and the target CWF real-custody architecture.

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

## 5. MISSING (What CWF Requires to Cross Custody Boundary)

1. **Program-Controlled SPL Token Custody**:
   - Vault PDA does not currently own or control SPL token accounts for volatile assets and USDC.
2. **Real Bounded Recovery Containment**:
   - `recover()` does not invoke SPL Token `TransferChecked` via CPI to move excess tokens to `policy.safe_destination`.
3. **Safe Destination Enforcement**:
   - `PolicyAccount.safe_destination` is stored onchain but not validated as the destination of recovery transfers.
4. **Standalone Watcher Daemon**:
   - Violation flagging is executed via script (`scripts/devnet-recovery-flow.mjs`) or UI rather than an autonomous background daemon.
5. **Standalone Solver Daemon**:
   - Solver execution is executed via script or UI rather than an autonomous untrusted solver service.

---

## 6. LIMITATIONS

1. **Owner Ledger Mutability**:
   - Because `sync_vault` can modify internal ledger balances, an owner could theoretically overwrite balances during quarantine.
2. **Policy Mutability During Active Recovery**:
   - `update_policy` does not currently freeze policy version while a vault is quarantined.
3. **Coarse Oversell Tolerance**:
   - `OVERSELL_BAND_BPS = 500` enforces a 5% window rather than mathematical proof of minimal necessary recovery.
4. **Single Volatile Position Assumption**:
   - `recover()` selects the first non-index position, assuming an MVP topology of exactly one volatile asset plus USDC.

---

## 7. TARGET CWF ARCHITECTURE (Real Custody Roadmap)

```text
               OWNER
                 │
                 ▼ (initialize & deposit)
          SENTINEL VAULT (PDA)
          ┌────────────────────────────────────────┐
          │  Vault Asset Token Account (SPL)       │
          │  Vault USDC Token Account (SPL)        │
          │  PortfolioVault Config & Invariants    │
          └──────────────────┬─────────────────────┘
                             │
            Pyth Oracle Price Shock
                             │
                             ▼
                    INVARIANT BREACH
                             │
                             ▼
                flag_violation (Watcher)
                             │
                             ▼
                        QUARANTINED
            (Agent Trade Authority Gated)
                             │
            Temporary Recovery Authority (PTA)
                             │
                             ▼
                recover (Untrusted Solver)
                             │
              CPI TransferChecked:
         Excess Volatile SPL ──► safe_destination (ATA)
                             │
                             ▼
                 Mandatory Postconditions
              (Token Conservation & Caps)
                             │
                             ▼
                    ACTIVE RESUMPTION
            (Recovery Authority Expired)
```

### Required Implementation Steps:
1. **Real SPL Vault Custody**: Add vault PDA-controlled SPL token accounts for the volatile asset and USDC.
2. **Emergency Containment Recovery**: In `recover()`, execute program-signed CPI `TransferChecked` transferring exactly the excess volatile tokens to the owner-configured `safe_destination`.
3. **Exact Token Conservation**: Replace simulated venue fee arithmetic with exact onchain token balance conservation.
4. **Policy Freeze**: Snapshot `policy_version` during quarantine to prevent rule mutations mid-recovery.
5. **Standalone Watcher & Solver Services**: Lightweight Node.js daemons subscribing to RPC events to automatically monitor invariants and submit bounded recovery transactions.
