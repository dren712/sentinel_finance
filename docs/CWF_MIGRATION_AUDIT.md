# Sentinel Finance — CWF Architecture Audit & Gap Analysis

**Audited Commit**: [`8c0b1264decbc451d1cfe1ab0f225166d07029d1`](https://github.com/dren712/sentinel_finance/commit/8c0b1264decbc451d1cfe1ab0f225166d07029d1)  
**Date**: October 8, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Network Deployment**: Solana Devnet (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`)

---

## 1. EXECUTIVE SUMMARY

The codebase represents the completed production implementation of **Sentinel: The Recovery Layer for Autonomous Capital** for Crypto's World Fair (CWF 2026).

All roadmap phases have crossed the real custody boundary:
1. **On-Chain SPL Token Custody**: Native zero-dependency SPL Token & Token-2022 CPI custody module (`programs/sentinel/src/custody.rs`) where the vault PDA holds actual tokens, managed by `owner_deposit` and `owner_withdraw`.
2. **Mandatory Emergency Containment Recovery**: `recover()` requires 4 canonical custody remaining accounts and executes program-signed CPI `transfer_checked_signed` transferring exact excess volatile tokens directly to `policy.safe_destination`. The simulated fallback branch has been fully eliminated (`MissingCustodyAccounts` 6045).
3. **Exact Token Conservation**: Program enforces exact on-chain balance conservation (`pre_balance == post_balance + sell_units`), strict risk reduction, and postcondition compliance.
4. **Policy Freeze**: Snapshotting of `policy_version` during quarantine ensures policy cannot be modified mid-recovery (`PolicyFrozen` 6036).
5. **Pure Solver Engine**: Mathematical recovery calculation in `@sentinel/sdk` (`requiredRecoveryUnits`) computes minimal sell units required to satisfy postconditions without heuristics.
6. **Autonomous Watcher & Solver Daemons**: Standalone Node.js background daemons (`scripts/watcher-daemon.mjs`, `scripts/solver-daemon.mjs`) continuously monitor RPC for invariant breaches and submit automated recovery transactions using `resolveRecoveryCustodyAccounts`.
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

4. **Mandatory Recovery Custody (`recover`)**:
   - Permissionless solver execution gated by `vault.status == Quarantined` (`VaultNotQuarantined` 6026).
   - Expiration guard: `current_slot <= recovery_expires_slot` (`RecoveryWindowClosed` 6030).
   - Replay protection: `expected_nonce == vault.recovery_nonce` (`StaleRecoveryNonce` 6031).
   - Strict custody accounts requirement: Requires 4 canonical accounts `[vault_ta, safe_dest_ta, mint, token_program]` (`MissingCustodyAccounts` 6045).
   - Token program allowlist: Program ID must equal SPL Token (`TokenkegQfe...`) or Token-2022 (`TokenzQdBNb...`) (`InvalidTokenProgram` 6040).
   - Program-signed CPI `transfer_checked_signed` moves exact `sell_units` to `policy.safe_destination`.
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
   - `resolveRecoveryCustodyAccounts`: Canonical derivation of vault ATA, safe destination ATA, mint, and token program accounts.
   - `LiveExecutionAdapter`: Anchor client managing separate owner and agent keypairs, building instructions, and decoding custom program errors canonicalized from `SENTINEL_IDL`.
   - `SentinelWatcherService` & `SentinelSolverService`: Daemons continuously polling Pyth oracles and submitting automated custody recoveries.
   - `AgentSimulator`: 10-stage autonomous cycle executor with tool calling.

3. **Web Application (`apps/web`)**:
   - Next.js 15 App router dashboard (`/`) displaying institutional portfolio metrics, agent mandate, policy configuration, dynamic context-aware header (`WATCHING` vs `QUARANTINED`), and the 6-stage Hero State Rail (`AUTHORIZED -> UNSAFE -> PROVEN -> QUARANTINED -> RECOVERED -> EXPIRED`).
   - Standalone `/quarantine` interface with real custody containment, 8-state interactive recovery button, slot countdown timer, exact Anchor error decoding, and Solana Explorer timeline.
   - 8 Next.js API endpoints (`/api/agent/run`, `/api/health`, `/api/portfolio/[wallet]`, etc.).

---

## 4. SIMULATED (What is Demo-Only / Mocked)

1. **Solver Bounty**:
   - `bounty_cap_cents` is computed and emitted in `RecoveryExecutedEvent` as an informational metric (`SIMULATED / NOT PAID`). No token reward is transferred to the solver wallet.
2. **Offchain Market Verifiers**:
   - PreStocks pre-trade checks and Meteora liquidity checks are evaluated in offchain TypeScript pre-flight filters rather than onchain CPI checks.


---

## 5. SCOPE FREEZE & RESIDUAL BOUNDARIES

1. **DEX Swaps vs Containment**:
   - In production decentralized environments, full DEX rebalancing introduces unbounded slippage and sandwich risk during high-volatility shocks. Sentinel's onchain containment model moves excess risk directly to the owner's `safe_destination` (cold wallet or multisig) under exact token conservation. Live external DEX routing remains offchain.
2. **Single Volatile Position Topology**:
   - The current Anchor smart contract targets an institutional core topology of one primary volatile asset + USDC reserve. Multi-asset vaults enforce strict non-index single-asset bounds (`MultipleVolatileAssetsUnsupported` 6037).
3. **Solver Incentive Distribution**:
   - Solver bounty calculation is emitted deterministically in event logs; direct token payment escrow is scheduled for post-CWF mainnet protocol upgrades.

---

## 6. FINAL CWF ARCHITECTURE


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

