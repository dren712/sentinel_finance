# Sentinel Finance (Sentinel Robo) — Stocklana Hackathon Submission

## 1. Project Overview & Meta Information

- **Project Name**: Sentinel Finance (Sentinel Robo)
- **Tagline**: Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative On-Chain Financial Postcondition Guarantees.
- **Submission Track**: **Investing → Robo-Portfolios ($100,000 Main Track)**
- **Target Sponsor Bounties**:
  1. **Pyth Network (Pyth Pro)**: Pyth as an authoritative **Security Input** (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`). Dual-feed oracle mark-to-market pricing, staleness protection via Pyth pull model (Hermès on-demand updates), confidence intervals ($\pm \sigma$), and tracking error checks.
  2. **PreStocks ($10,000 Bounty)**: Certified pre-IPO tech universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`), strict ecosystem exclusivity, and macro asset class allocation limits (`Pre-IPO ≤ 20%`).
  3. **Meteora ($5,000 Bounty)**: **Sentinel Equity Market Guard** — pairing Meteora Dynamic Bonding Curve (DBC) market quality ($25k reserve floor, $\le 200\text{ bps}$ price divergence) with Sentinel account protection.
- **GitHub Repository**: [https://github.com/dren712/sentinel_finance](https://github.com/dren712/sentinel_finance)
- **Live Solana Devnet Program ID**: [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet)
- **On-Chain IDL Account**: [`H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6`](https://explorer.solana.com/address/H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6?cluster=devnet)

---

## 2. Executive Elevator Pitch

> *"Tokenized stocks already trade 24/7 on Solana. But delegating capital to an autonomous AI agent has always been a dangerous leap of faith: traditional Web3 authorization only checks if an agent has permission to call an instruction, not what financial state results. If the AI model drifts or hallucinates, it can dump your reserves or over-concentrate 90% of your capital into a single equity.*
> 
> *Sentinel Finance introduces **authoritative postcondition guarantees at the state-transition boundary**: the agent can propose any strategy, but the Solana runtime atomically reverts any trade that breaches the user's financial policy (e.g. max single-asset exposure ≤ 25%, min cash reserve ≥ 20%). Combined with autonomous reactive adaptation and two-tier PROVN cryptographic receipts, Sentinel makes AI portfolio management institutional-grade on Solana."*

---

## 3. Verified Demo Moments

Sentinel Finance includes four turnkey live demo scenarios that demonstrate the full reactive enforcement pipeline (`Intent → Promise → Post-state → Financial Invariants → Decision → Adaptation → Evidence`).

### 3.1 Flagship Scenario: Single-Asset Exposure & Cash Reserve Enforcement
1. **Portfolio Inspection**: User views a diversified portfolio ($124k+ NAV) with `4 / 4 Guarantees Healthy`.
2. **Rogue AI Trade Intent**: Sentinel Robo-01 spots momentum and proposes an aggressive trade: `BUY NVDAx $15,000`.
3. **Atomic Revert on Solana**: Sentinel evaluates prospective post-state. NVDA exposure would hit 35% (> 25% cap), cash drops to 10% (< 20% floor), and order size breaches $10,000 limit. The transaction is aborted atomically. Zero tokens move; 100% of capital is safe.
4. **Autonomous Reactive Adaptation**: The agent reads the rejection telemetry, calculates the maximum mathematically compliant headroom ($5,000), and auto-adapts: `BUY NVDAx $5,000`.
5. **Settlement & PROVN Receipt**: Compliant trade settles on-chain; balances update; PROVN produces a two-tier financial audit record ("✓ Protected on Solana" for investors; technical drawer with deterministic SHA-256 state commitments, PDA, and slot for auditors).

### 3.2 PreStocks Bounty Scenario: Macro Asset Class Cap Breach (`$10,000 Target`)
1. **Pre-IPO Universe Context**: Portfolio holds 18% in PreStocks pre-IPO equity against an authoritative **20% macro category ceiling**.
2. **Rogue Private Equity Surge**: Agent identifies private market secondary catalyst and proposes `BUY OPENAI $30,000`. Prospective Pre-IPO allocation surges from **18% → 48%**.
3. **Policy Engine Rejection**: Sentinel halts the intent before submission: **48% Pre-IPO allocation violates the 20% hard cap** (breach of 2,800 bps / $28,000 over ceiling).
4. **Headroom Solver Adaptation**: The agent calculates remaining capacity: `($100,000 × 20%) - $18,000 = $2,000`. It recalculates and issues adapted order `BUY OPENAI $2,000`.
5. **Settlement via PreStocks Vault**: Trade verifies compliant at 20.00% category allocation and settles via PreStocks Secondary Vault PDA.

### 3.3 Meteora Bounty Scenario: Sentinel Equity Market Guard (`$5,000 Target`)
1. **Market Protection Meets Account Protection**: User policy allows up to $10,000 trade size; single-asset exposure allows up to 30%.
2. **Agent Proposes Liquid Trade**: Agent proposes `BUY NVDAx $8,000`. User policy passes (`$8k ≤ $10k` ✓); portfolio post-state passes (`28% ≤ 30%` ✓).
3. **Meteora Market Guard Interception**: Sentinel inspects the underlying Meteora DBC pool before routing. The pool's reserve depth is **$12,000**, which falls below Sentinel's institutional floor of **$25,000**.
4. **Zero Slippage Execution**: Execution is blocked *before* capital hits the pool, shielding both the robo-portfolio from toxic slippage and the DBC pool from sudden price dislocation.
5. **Deterministic Rejection Receipt**: PROVN logs the market quality violation with pool telemetry and reserve verification.

### 3.4 Pyth Sponsor Scenario: Oracle Security Guard (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`)
1. **Market Uncertainty / Stale Quote**: Portfolio holds equities. Market oracle data for AAPL is delayed (quote age = 140s, breaching the strict 60s freshness ceiling).
2. **Agent Proposes Trade on Stale Data**: Agent proposes `BUY AAPL $4,000`. Sizing ($4,000 ≤ $10,000) and portfolio concentration (29% ≤ 30%) pass.
3. **Pyth Security Input Interception**: Sentinel queries the Pyth quote timestamp. Because market truth is stale (140s > 60s), Sentinel halts execution before submission: `ERR_QUOTE_STALE: Pyth price quote is stale (140s > 60s max allowed)`. Zero capital is risked on unconfirmed or stale pricing.
4. **Hermès Pull Update**: Sentinel requests an on-demand Pyth price update from Hermès, posting fresh benchmark data on-chain (quote age = 2s).
5. **Execution & Settlement**: With authoritative market truth restored, the trade executes and settles cleanly; PROVN logs the oracle verification proof.

---

## 4. Technical Architecture: The Modular Monolith

Sentinel avoids distributed infrastructure bloat (no unnecessary message queues, microservices, or complex databases) by organizing into a clean, battle-tested modular monolith:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                              │
│       apps/web (Next.js 14, Tailwind, Solana Wallet Adapter)           │
│   • Portfolio (NAV & Assets)          • Agent (10-Stage Loop)          │
│   • Protection (On-Chain PDA Caps)    • Activity (PROVN Receipts)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SDK & ORCHESTRATION LAYER                        │
│                         packages/sdk                                   │
│   • SentinelClient                    • AutonomousRoboAgent            │
│   • Meteora DBC Adapter               • PreStocks Secondary Adapter    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DOMAIN & VERIFICATION LAYER                       │
│                        packages/domain                                 │
│   • PolicyEngine (Basis Points Math)  • SWARM-Lite 6-Verifier Consensus│
│   • PROVN Evidence & State Hashing    • Asset & SPV Registry           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ON-CHAIN ENFORCEMENT BOUNDARY                      │
│                  programs/sentinel (Anchor on Solana)                  │
│   • Program ID: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK           │
│   • u128 Fixed-Point Postcondition Verification                        │
│   • Atomic Reversion upon invariant breach (0 tokens moved)            │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Why Solana? Enforcement at the Financial State-Transition Boundary

When judges ask *"Why does this belong on Solana?"*, the answer is not generic marketing speed or low fees.

**Sentinel belongs on Solana because our enforcement lives directly at the financial state-transition boundary.**

- **The Failure of Off-Chain APIs**: Off-chain risk APIs (`POST /verify -> { "approved": true }`) cannot protect vaults. A rogue or hallucinating agent simply bypasses the API and signs directly with its keypair. Furthermore, off-chain checks suffer from race conditions against AMM slippage and concurrent block state.
- **The Solana State-Transition Boundary**: On Solana, the **Policy PDA** (user's immutable risk bounds), the **Promise PDA** (agent's committed trade intent), the **Portfolio Vault** (SPL token accounts), and the **Execution Instruction** (Meteora DBC swap or PreStocks secondary transfer) all co-exist within the **exact same atomic transaction runtime**.
- **Atomic Rollback**: Sentinel's `execute_guarded_trade` instruction calculates the prospective post-trade portfolio allocation in 128-bit fixed-point math. If any user invariant is violated (e.g. NVDA > 25% or Cash < 20%), the transaction emits `PolicyInvariantViolated` and **atomically rolls back the entire instruction chain**. Zero tokens move.

### 4.2 Two-Tier PROVN Receipt Architecture

PROVN is not a detached crypto dashboard tab; it is the cryptographic receipt of Sentinel's decision:
- **Tier 1 (Investor View)**: Reassuring, clear status (`Protected by Sentinel`, `0 tokens moved · Capital safe`, visual guarantee health indicators).
- **Tier 2 (Auditor & Engineer Drawer)**: Full deterministic cryptographic evidence containing SHA-256 pre-state root, post-state root, intent hash, policy hash, and transaction signature verification.

---

## 5. Sponsor Integration Breakdown

### 5.1 Pyth Network (Pyth Pro Track)
- **Centrality to Product**: Pyth price feeds are not just market indicators—they are an authoritative **Security Input**. Sentinel enforces: *"Is this price trustworthy enough to let the agent act?"* If stale or wide-confidence, execution is atomically refused (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`).
- **Capabilities Delivered**:
  - **Pyth as a Security Input**: Enforcing hard limits on quote age ($\le 60\text{s}$) and confidence interval width ($\pm \sigma \le 150\text{ bps}$) before any trade is permitted to execute.
  - **Pyth Pull Model Architecture**: Leveraging Pyth Hermès on-demand updates to refresh on-chain benchmark truth before program execution.
  - **Dual-feed pricing**: Comparing tokenized stock prices with underlying US equity benchmarks to detect depegging or basis tracking error (> 100 bps).
  - **Mark-to-market portfolio NAV**: Continuous valuation updates with confidence intervals ($\pm \sigma$).

### 5.2 PreStocks ($10,000 Bounty)
- **Centrality to Product**: Broadens Sentinel's tokenized universe beyond public equities into high-demand pre-IPO secondary tech shares.
- **Strict Exclusivity Compliance**: 100% PreStocks certified asset universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`) with Certified 409A / Forge NAV pricing and Secondary Vault PDA settlement. All competing/unaffiliated pre-IPO tokens are strictly excluded to preserve full bounty eligibility.
- **Capabilities Delivered**:
  - Full Asset Universe supporting pre-IPO market leaders (`SPACEXx`, `OPENAIx`, `ANTHROPICx`, `STRIPEx`).
  - Portfolio Builder with macro asset class policy enforcement (`Public Equities ≤ 70%`, `Pre-IPO ≤ 20%`, `USDC Cash Reserves ≥ 10%`).
  - Autonomous mathematical headroom solver that down-sizes aggressive private equity orders to remain precisely within the 20% illiquidity cap.

### 5.3 Meteora ($5,000 Bounty)
- **Centrality to Product**: **Sentinel Equity Market Guard** — unifying Meteora market infrastructure with Sentinel on-chain portfolio guarantees.
- **The Core Formula**:
  $$\text{Meteora Market Quality} + \text{Sentinel Portfolio Protection} = \mathbf{Market\ Protection\ +\ Account\ Protection}$$
  - **Meteora Market Quality**: Bonding curve health, reserve liquidity floor, price divergence bounds, dynamic LP fee capture, and graduation readiness.
  - **Sentinel Portfolio Protection**: User-defined risk boundaries, macro asset allocation ceilings, and execution postconditions.
- **Capabilities Delivered**:
  - `MeteoraDBCMarketQualityVerifier` inspecting curve liquidity depth (≥ $25,000 floor) and price stability (≤ 200 bps divergence from reference index).
  - Bidirectional Protection: Sentinel protects investors from toxic slippage in shallow pools *and* protects Meteora DBC pools from reckless algorithmic draining.

---

## 6. Verification & Test Credentials

Sentinel Finance boasts a **100% test pass rate** across its entire codebase:

| Suite | Command | Test Count | Result |
| :--- | :--- | :--- | :--- |
| **Rust Anchor Invariant Tests** | `cargo test --manifest-path programs/sentinel/Cargo.toml --lib` | 9 tests | **PASS (0 failures)** |
| **Domain Policy Engine** | `pnpm --filter @sentinel/domain test` | 39 tests | **PASS (0 failures)** |
| **SDK & Agent Simulator** | `pnpm --filter @sentinel/sdk test` | 55 tests | **PASS (0 failures)** |
| **End-to-End Demo Scenarios** | `node --test tests/integration/demo-scenario.test.ts` | 4 tests | **PASS (0 failures)** |
| **Production Web Build** | `pnpm --filter @sentinel/web run build` | 4/4 static pages | **Exit code 0** |
| **Total Automated Tests** | — | **107 tests** | **107 / 107 passed (100%)** |

---

## 7. Colosseum Graduation Roadmap

1. **Testnet / Mainnet-Beta Tokenized Stock Whitelisting**: Onboard regulated tokenized stock issuers (Backed Finance, Ondo, Dinari).
2. **Permissionless Policy Attestation**: Allow third-party algorithmic agents (ClawPump, Eliza, Autonomous SDKs) to bind to Sentinel vaults via standard CPI.
3. **Institutional Multi-Sig Delegation**: Support Squads v4 multi-sig governance for institutional fund managers delegating sub-vaults to automated strategies.
