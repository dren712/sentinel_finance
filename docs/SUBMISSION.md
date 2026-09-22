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

## 2. The Four Proof Layers of Sentinel

When a judge evaluates Sentinel Finance, every element of our repository and submission serves one of four concrete proof layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│  PROOF 1: PRODUCT   │ "I understand what this does."                   │
│                     │ Autonomous robo-manager where agent proposes,    │
│                     │ but Sentinel enforces what portfolio can become. │
├─────────────────────┼──────────────────────────────────────────────────┤
│  PROOF 2: LIVE DEMO │ "I saw it actually work."                        │
│                     │ 3 Flagship Aha cases: NVDA $15k ➔ Block ➔ $5k;   │
│                     │ Meteora 1.70% slippage ➔ Block ➔ Adapt along DBC;│
│                     │ Pyth 140s stale ➔ Refuse ➔ Hermès pull update.   │
├─────────────────────┼──────────────────────────────────────────────────┤
│  PROOF 3: PROTOCOL  │ "I can inspect the Anchor logic."                │
│                     │ On-chain Solana Devnet program (3gh1Cc2Q...),    │
│                     │ u128 fixed-point math, Policy/Agent/Vault PDAs.  │
├─────────────────────┼──────────────────────────────────────────────────┤
│  PROOF 4: EVIDENCE  │ "I can verify what happened."                    │
│                     │ Two-tier PROVN receipts with deterministic       │
│                     │ SHA-256 pre/post state roots & transaction sigs. │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Three Flagship "Aha!" Cases

We don't overwhelm judges with 30 superficial features. We prove one core thesis through **three mathematically rigorous flagship demonstrations**:

$$\mathbf{Sentinel\ doesn't\ blindly\ trust:\ The\ Agent,\ The\ Market,\ or\ The\ Data.}$$

### Case A — Doesn't Trust The Agent: Portfolio Invariant Violation
1. **The Intent**: Robo-01 spots Nvidia momentum and proposes an aggressive trade: `BUY NVDAx $15,000`.
2. **Atomic Revert on Solana**: Sentinel intercepts the trade. Projected post-state triggers three simultaneous failures: NVDA hits 35% (> 25% cap), cash drops to 10% (< 20% floor), and trade exceeds $10,000. Anchor program **atomically reverts** the transaction. 0 tokens moved; 100% capital protected.
3. **Autonomous Adaptation**: Agent reads invariant failure telemetry, calculates exact compliant headroom ($5,000), and reproposes `BUY NVDAx $5,000`.
4. **Settlement**: All guarantees pass: trade is approved and settled on-chain.

### Case B — Doesn't Trust The Market: Meteora DBC Slippage & Depth Breach
1. **The Intent**: Agent proposes `BUY NVDAx $8,000`. User sizing passes ($8k ≤ $10k ✓) and portfolio exposure passes (28% ≤ 30% ✓).
2. **Sentinel Equity Market Guard Interception**: Sentinel inspects the underlying Meteora DBC pool. Bonding curve price impact is estimated at **1.70% (170 bps)**, violating user's 1.00% max slippage policy, and pool depth is shallow ($12k < $25k floor). Sentinel **BLOCKS** execution atomically!
3. **DBC Curve Sizing Adaptation**: Agent reads the Meteora DBC bonding curve equation and auto-adapts trade size down to **$2,500** along the curve (where price impact compresses to **0.45% ≤ 1.00%**).
4. **Settlement**: `BUY NVDAx $2,500` settles cleanly on Meteora DBC Bonding Curve PDA with zero market dislocation.

### Case C — Doesn't Trust The Data: Pyth Oracle Staleness Refusal
1. **The Intent**: Agent proposes `BUY AAPLx $4,000`. User policy passes, but Pyth oracle price quote is 140s old (exceeds 60s freshness ceiling).
2. **Security Input Refusal**: Sentinel halts execution before submission: `STALE / LOW CONFIDENCE ➔ NO EXECUTION` (`ERR_QUOTE_STALE`). Zero capital is risked on stale market truth.
3. **Pyth Pull Model via Hermès**: Sentinel triggers an on-demand Pyth price update from Hermès, posting fresh benchmark data on Solana (quote age = 0s, ±$0.03 confidence).
4. **Settlement**: With authoritative market truth restored, the trade executes and settles cleanly.

### Bonus PreStocks Asset-Class Demonstration
* In addition to single-trade limits, Sentinel proves awareness of **macro asset classes**: Public Equity ($57k) + Pre-IPO ($18k / 18%) + Reserve ($25k / 25%).
* Agent proposes `BUY OPENAIx $5,000` (individual trade sizing passes). But Pre-IPO surges from 18% to 23% (> 20% cap) ➔ **REJECTED** on asset class invariant!
* Agent solves remaining headroom `($100k × 20%) - $18k = $2,000` ➔ Reproposes `BUY OPENAIx $2,000` ➔ Settles via PreStocks Secondary Vault PDA.

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

## 7. Official 3-Minute Pitch Video Script (Colosseum Structure)

Our pitch video is structured precisely under the 3-minute Colosseum guideline ([`docs/PITCH_VIDEO_SCRIPT.md`](file:///Users/darshangaikwad/Desktop/stocklana/docs/PITCH_VIDEO_SCRIPT.md)):

* **0:00–0:20 | The Problem**: The delegation dilemma. Standard wallet delegation checks *if the agent can sign*, never *what financial state results*. Rogue drift, hallucinations, and liquidations.
* **0:20–0:40 | The Sentinel Idea**: Authoritative financial postconditions at the state-transition boundary. Agent proposes any trade; Anchor atomically reverts any invariant breach.
* **0:40–1:50 | The Flagship Demo**: Live screen share: `BUY NVDAx $15,000` ➔ 3 simultaneous failures (NVDA 35% > 25%, Cash 10% < 20%, Size $15k > $10k) ➔ Atomic Revert on Solana ➔ Agent auto-adapts remaining headroom to `$5,000` ➔ Approved & Settled on-chain ➔ PROVN two-tier cryptographic audit receipt sealed.
* **1:50–2:30 | Real Solana + Sponsors**: Why Solana (state-transition boundary execution). We don't blindly trust **The Agent** (Portfolio Guard), **The Market** (Meteora DBC curve price impact 1.70% > 1.00% ➔ adapt to $2,500), or **The Data** (Pyth 140s stale quote refused ➔ Hermès pull update).
* **2:30–3:00 | Vision & Moat**: Trust rails for autonomous finance. Managing billions in AI capital safely. Live on Solana Devnet today.

---

## 8. Colosseum Graduation Roadmap

1. **Testnet / Mainnet-Beta Tokenized Stock Whitelisting**: Onboard regulated tokenized stock issuers (Backed Finance, Ondo, Dinari).
2. **Permissionless Policy Attestation**: Allow third-party algorithmic agents (Eliza, LangChain, Autonomous SDKs) to bind to Sentinel vaults via standard CPI.
3. **Institutional Multi-Sig Delegation**: Support Squads v4 multi-sig governance for institutional fund managers delegating sub-vaults to automated strategies.
