# 🛡️ Sentinel Finance — Live Demo & Presentation Playbook

> **Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative On-Chain Financial Postcondition Guarantees.**

This document provides a comprehensive, turn-by-turn presentation guide and live demo script for **Sentinel Finance**. Use this playbook when presenting to hackathon judges, venture investors, or technical evaluators.

---

## 📋 Table of Contents
1. [The 30-Second Elevator Pitch](#-1-the-30-second-elevator-pitch)
2. [Pre-Flight Setup & Environment](#-2-pre-flight-setup--environment)
3. [The Flagship 5-Step "Aha!" Demo Script](#-3-the-flagship-5-step-aha-demo-script)
4. [Deep Dive: The 4 Architecture Pillars](#-4-deep-dive-the-4-architecture-pillars)
5. [Sponsor & Bounty Track Alignment](#-5-sponsor--bounty-track-alignment)
6. [Judges & Technical Q&A Defense](#-6-judges--technical-qa-defense)

---

## 🎯 1. The 30-Second Elevator Pitch

> *"When an investor delegates trading authority to an autonomous AI agent on Solana today, standard wallet delegation only answers: **'Is the agent authorized to call this transaction?'** If the AI drifts, hallucinates, or catches an oracle anomaly, it can drain stable reserves or dump 90% of your portfolio into a volatile equity.*
>
> *Sentinel Finance introduces **Authoritative On-Chain Financial Postcondition Guarantees**.*
>
> ***The agent can make investment decisions, but it is cryptographically and on-chain impossible for it to settle an outcome that violates the investor's promised financial rules.*** *If an invariant is breached, the Solana Anchor program atomically reverts the entire transaction. Zero funds lost."*

---

## 🛠️ 2. Pre-Flight Setup & Environment

Before you begin your presentation, ensure your local environment is active:

```bash
# 1. Start the web application (if not already running)
pnpm --filter @sentinel/web run dev

# 2. Open in Brave Browser
# URL: http://localhost:3000
```

### Deployed Devnet Reference:
* **Solana Cluster**: `Devnet`
* **Sentinel Program ID**: [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet)
* **IDL Account**: `H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6`
* **Vault PDA**: `7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y`
* **Policy PDA**: `3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh`
* **Agent Authority PDA**: `62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ`

---

## 🎬 3. The Flagship 5-Step "Aha!" Demo Script

This is the core demonstration. It takes **under 2 minutes** and visibly demonstrates the entire value proposition of Sentinel Finance.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Initial State│ ────► │ 2. Propose $15k │ ────► │ 3. REVERT! (0$ Loss)
│ NAV $100k, 4/4  │       │ Momentum BUY    │       │ 35% > 25% Cap   │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
                                                             ▼
┌─────────────────┐                                 ┌─────────────────┐
│ 5. PROVN Settle │ ◄────────────────────────────── │ 4. Auto-Adapt   │
│ SHA-256 Proof   │                                 │ Resizes to $5k  │
└─────────────────┘                                 └─────────────────┘
```

---

### Step 1: Landing on the Hero Story: "What did the agent try to do?"
* **Where to look**: Right at the top of the **PORTFOLIO** home view.
* **Action**:
  1. The UI immediately leads with the central question: **"WHAT DID THE AGENT TRY TO DO?"**
  2. Point out the mathematically engineered initial state ($100,000 NAV: $20k NVDAx, $25k AAPLx, $30k SPYx, $25k USDC).
  3. Point to the four on-chain invariant boundaries anchored in the Solana Policy PDA:
     * **Max Single-Asset Exposure**: `≤ 25.0%`
     * **Min Stablecoin Reserve Floor**: `≥ 20.0%`
     * **Max Trade Sizing Limit**: `≤ $10,000`
     * **Max Slippage Tolerance**: `≤ 1.0%`
* **What to say**:
  > *"When you open Sentinel Finance, we don't bury the story in generic portfolio charts. We lead immediately with the core question: **What did the agent try to do?**
  >
  > Here is our starting portfolio: exactly $100,000 with $20k NVDAx (20%), $25k AAPLx (25%), and $25k USDC (25%). Everything is governed by authoritative postconditions enforced directly on Solana."*

---

### Step 2: The Rogue Trade ($15,000) & The Three Inevitable Failures
* **Action**:
  1. Click **`[ Replay Enforcement ]`** on the hero card (or select from the header dropdown).
  2. The hero card highlights the initial proposal:
     * **PROPOSED**: `BUY NVDAx $15,000`
     * **SENTINEL**: `BLOCKED`
  3. Inspect the **Projected State Violations**:
     * **NVDAx Exposure**: `20.0% → 35.0%` (Limit: 25.0%) `[FAILED]`
     * **USDC Cash Reserve**: `25.0% → 10.0%` (Floor: 20.0%) `[FAILED]`
     * **Order Sizing**: `$15,000` (Ceiling: $10,000) `[FAILED]`
* **What to say**:
  > *"Robo-01 spots momentum on Nvidia and proposes an aggressive $15,000 buy. Under normal wallet delegation, this trade executes blindly.
  >
  > But look at Sentinel's projected post-trade verification: the trade triggers **three simultaneous, mathematically undeniable failures**: NVDA hits 35%, cash drops to 10%, and the order exceeds $10,000.
  >
  > Sentinel atomically aborts the transaction on Solana. Zero funds leave the vault."*

---

### Step 3: The Atomic Invariant Revert (The Climax)
* **On Screen**:
  * Step 3 banner flashes red: **`[🚨 INVARIANT REVERT]`**.
  * Rejection telemetry displays:
    * `NVDAx Exposure: 35.00% > 25.00% [REJECTED]`
    * `Stable Reserve: 10.00% < 20.00% [REJECTED]`
    * `Trade Sizing: $15,000 > $10,000 [REJECTED]`
* **What to say**:
  > *"Watch what happens before settlement: Sentinel's Anchor postcondition check executes in fixed-point math. It evaluates the simulated post-trade state and detects three violations simultaneously: NVDA would reach 35%, reserves drop below 20%, and trade exceeds $10k.*
  >
  > *The Anchor program **atomically reverts the entire transaction**. Zero tokens leave the vault. Zero capital is lost."*

---

### Step 4: Autonomous Reactive Adaptation
* **On Screen**:
  * Step 4 banner turns amber: **`[⚡ ADAPTING PROPOSAL]`**.
  * Message: *"Step 4/5: Agent reads invariant rejection telemetry and solves maximum compliant size ($5,000)"*.
* **What to say**:
  > *"Instead of crashing or failing silently, Robo-01 consumes the on-chain rejection telemetry. It formulates a constrained optimization problem and mathematically calculates the exact maximum compliant trade size: **$5,000**.*
  >
  > *It autonomously resubmits the adapted intent without requiring any human panic-intervention."*

---

### Step 5: Compliant Settlement & PROVN Audit Receipt
* **On Screen**:
  * Step 5 banner turns emerald: **`[✅ SETTLED]`**.
  * A new settled transaction row appears in the Activity timeline.
* **What to say**:
  > *"The trade settles with 100% compliance: NVDA is held precisely at 25.0%, reserves stay at 20.0%, and trade sizing is satisfied."*

---

### Bonus Step: Inspecting the Two-Tier PROVN Receipt
* **Action**:
  1. Click on the newly settled row in the **Activity** timeline.
  2. The **PROVN Audit Record** inspector opens:
     * Show the **Tier 1 (Investor View)**: Green badges showing all 4 guarantees verified.
     * Click **"Expand"** on the **Technical Evidence Drawer (Tier 2)**:
       * Deterministic **SHA-256 Pre-State Hash**
       * Deterministic **SHA-256 Post-State Hash**
       * Authority and Vault PDA signatures
       * Link to Solana Explorer Devnet transaction
* **What to say**:
  > *"Every single action produces a deterministic cryptographic audit receipt. Institutional allocators can independently verify the exact pre-trade and post-trade state transitions on-chain."*

---

### 3.2 PreStocks $10,000 Bounty Live Demo: Pre-IPO Cap Enforcement
* **How to trigger**: Click **"Demo Scenarios"** dropdown in the header and select **"PreStocks ($10K Bounty)"**.
* **The Narrative**:
  > *"The PreStocks bounty evaluates material product integration and private equity safety. Watch how Sentinel prevents an autonomous agent from over-concentrating in private equity."*
* **Step-by-Step Flow**:
  1. **Step 1/5 (Universe)**: Shows PreStocks Asset Universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`) with macro policy limit: $\text{Pre-IPO} \le 20.0\%$.
  2. **Step 2/5 (Proposal)**: Agent spots an OpenAI secondary tender and proposes `BUY OPENAIx $30,000` (would surge Pre-IPO exposure from $18\% \rightarrow 48\%$).
  3. **Step 3/5 (Atomic Revert)**: Sentinel on-chain postcondition aborts immediately: `ERR_PRE_IPO_EXPOSURE_EXCEEDED: 48.0% > 20.0% cap`. Reverted atomically with 0 funds lost!
  4. **Step 4/5 (Autonomous Adaptation)**: Agent inspects rejection telemetry, computes exact remaining Pre-IPO headroom ($2,000), and auto-adapts proposal to `BUY OPENAIx $2,000`.
  5. **Step 5/5 (PreStocks Settlement)**: Trade settles cleanly via **PreStocks Secondary Vault**, generating an immutable PROVN receipt.

---

### 3.3 Meteora $5,000 Bounty Live Demo: Sentinel Equity Market Guard
* **How to trigger**: Click **"Demo Scenarios"** dropdown in the header and select **"Meteora ($5K Bounty)"**.
* **The Narrative**:
  > *"Meteora asked: 'What does Meteora DBC look like for tokenized stocks?' Our answer: Sentinel Equity Market Guard. We unite Meteora market quality with Sentinel account protection to provide bidirectional safety."*
* **Step-by-Step Flow**:
  1. **Step 1/4 (Market Inspection)**: Inspects Meteora DBC market for `NVDAx` (virtual reserves, graduation threshold, and $25,000 liquidity floor).
  2. **Step 2/4 (Compliant Proposal)**: Agent proposes `BUY NVDAx $8,000`. User policy passes ($8k \le \$10k$ ✓) and portfolio concentration passes ($28\% \le 30\%$ ✓).
  3. **Step 3/4 (Market Guard Detection)**: Sentinel Equity Market Guard inspects DBC pool depth and detects shallow liquidity ($12,000 < \$25,000$ minimum floor).
  4. **Step 4/4 (Execution Blocked)**: Sentinel **BLOCKS** execution atomically!
     - Protects the investor from catastrophic price impact.
     - Protects the Meteora DBC curve from toxic, predatory orders.

---

### 3.4 Pyth Network Bounty Live Demo: Pyth as a Security Input
* **How to trigger**: Click **"Demo Scenarios"** dropdown in the header and select **"Pyth Oracle Security Guard"**.
* **The Narrative**:
  > *"Pyth is not just a price display in Sentinel — it is a non-negotiable SECURITY INPUT. Sentinel refuses autonomous agent execution when market truth is stale or unreliable, directly showcasing the Pyth pull model in action."*
* **Step-by-Step Flow**:
  1. **Step 1/4 (Stale Feed Inspection)**: Agent inspects Pyth feed for `AAPLx`. Quote publish timestamp is 140s old (exceeds freshness ceiling of 60s).
  2. **Step 2/4 (Autonomous Intent)**: Agent proposes `BUY AAPLx $4,000`. User sizing limit passes ($4k \le \$10k$ ✓) and portfolio exposure passes ($29\% \le 30\%$ ✓).
  3. **Step 3/4 (Security Refusal)**: Sentinel evaluates: *"Is this price trustworthy enough to let the agent act?"* Result: **NO EXECUTION** (`ERR_QUOTE_STALE`). Autonomous intent is halted before capital is risked on stale market data!
  4. **Step 4/4 (Pyth Pull Update & Settlement)**: App pulls fresh Hermès price update on Solana (age 0s, $\pm \$0.20$ confidence). Sentinel verifies quote integrity, authorizes execution, and settles trade on-chain with PROVN receipt.

---

## 🏛️ 4. Deep Dive: The 4 Architecture Pillars

If the judges or audience ask to explore further, walk through the 4 navigation tabs:

### Pillar 1: PORTFOLIO & PreStocks Universe
* **Navigate to**: `PORTFOLIO` tab.
* **Key Features to Highlight**:
  * **Interactive Asset Breakdown**: Liquid tokenized stocks (`NVDAx`, `AAPLx`, `SPYx`) alongside late-stage Pre-IPO private equities (`SPACEXx`, `OPENAIx`, `ANTHROPICx`, `STRIPEx`).
  * **PreStocks Exclusivity**: 100% of pre-IPO secondary allocations belong to PreStocks Protocol. Zero competing pre-IPO tokens.
  * **Asset Detail Drawer**: Clicking any pre-IPO holding displays the **PreStocks Tokenized Pre-IPO Secondary Allocation**, Certified 409A / Forge NAV ($200.00), attestation date, and Secondary Vault PDA.
  * **Interactive Portfolio Builder**: Click **"Asset Allocator"** to test multi-asset presets (*Balanced Multi-Asset*, *PreStocks Tech Alpha*, *Public Blue-Chips*).
  * **Macro Asset Class Caps**: Automatic enforcement of `Pre-IPO ≤ 20.0%` allocation.

### Pillar 2: AGENT (Robo-01 & 10-Stage Loop)
* **Navigate to**: `AGENT` tab.
* **Key Features to Highlight**:
  * **Agent Identity**: Ed25519 Autonomous Keypair with dedicated PDA Authority (`62vp...`).
  * **10-Stage Autonomous Reactive Adaptation Loop**:
    1. `OBSERVE` (Fetch Pyth oracle prices)
    2. `FORMULATE` (Formulate investment thesis)
    3. `PROPOSE` (Construct trade intent)
    4. `CHECK` (Simulate postcondition invariants)
    5. `REJECTED` (Catch on-chain violation error)
    6. `READ` (Parse rejection telemetry)
    7. `ADAPT` (Solve compliant trade size)
    8. `REPROPOSE` (Re-construct compliant intent)
    9. `RECHECK` (Verify invariants pass)
    10. `SETTLE` (Execute on-chain Anchor instruction)
  * Click **"Run Autonomous Adaptation"** to see all 10 stages illuminate one by one.
  * **Execution Venue Selector**: Switch between **Meteora Dynamic Bonding Curves (DBC)** and **PreStocks Secondary**.

### Pillar 3: PROTECTION (Policies & Circuit Breakers)
* **Navigate to**: `PROTECTION` tab.
* **Key Features to Highlight**:
  * **Interactive Boundary Sliders**: Live adjustments for Single-Asset Exposure, Reserve Floor, Max Slippage, and Daily Budget.
  * **Emergency Pause**: On-chain circuit breaker that freezes all agent activity instantly.
  * **Financial Policy DSL**: Click **"Export DSL"** to display the machine-readable policy specification used by institutional compliance teams.

### Pillar 4: ACTIVITY (Cryptographic Audit Trail)
* **Navigate to**: `ACTIVITY` tab.
* **Key Features to Highlight**:
  * Complete historical ledger of every proposed, rejected, adapted, and settled action.
  * Search and filter by `SETTLED` vs `REJECTED`.
  * Instant access to PROVN cryptographic receipts.

---

## 🏆 5. Sponsor & Bounty Track Alignment

| Track / Sponsor | Bounty / Prize | How Sentinel Finance Delivers Concrete Value |
| :--- | :--- | :--- |
| **Primary Wedge: Investing** | **Robo-Portfolios ($100,000 Main Track)** | Fully autonomous robo-portfolio manager delivering dynamic multi-asset balancing bounded by on-chain postconditions. |
| **PreStocks** | **$10,000 Bounty Target** | 100% PreStocks exclusive pre-IPO asset universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`), Portfolio Builder, and Macro Asset Class allocation enforcement (`Pre-IPO ≤ 20%`). |
| **Meteora** | **$5,000 Bounty Target** | **Sentinel Equity Market Guard**: Meteora DBC curve mechanics, reserve depth verification ($25,000 floor), dynamic fee tracking, and bidirectional market protection. |
| **Pyth Network** | **Pyth Pro Track** | **Pyth as a Security Input**: Quote freshness enforcement (≤ 60s), confidence ratio bounds (≤ 1.50%), pull-model updates via Hermès, dual-feed basis tracking error checks, and refusal of execution on stale market truth. |

---

## ❓ 6. Judges & Technical Q&A Defense

### Q1: "Is this postcondition check done in the frontend or actually on-chain?"
> **Answer**: *"Authoritative enforcement is 100% on-chain inside our Solana Anchor program (`programs/sentinel/src/lib.rs`). The instruction `execute_guarded_trade` calculates portfolio balances and post-trade state transitions in u128 fixed-point math directly on Solana. Even if an attacker bypasses the frontend and calls the RPC directly, the on-chain Anchor program reverts."*

### Q2: "Why postconditions instead of traditional pre-trade whitelists?"
> **Answer**: *"Pre-trade checks only know the input parameters (e.g. 'swap $5,000 USDC for NVDA'). They cannot know the resulting state after AMM slippage, dynamic fees, or concurrent pool transactions. Sentinel checks the **actual post-state result**: if the resulting portfolio violates the user's promises, it reverts atomically."*

### Q3: "What happens if Pyth oracle price data is stale or manipulated?"
> **Answer**: *"We consume Pyth price feeds with strict confidence intervals ($\pm \sigma$) and age checks (`maxQuoteAgeSeconds`). If the Pyth publisher confidence band exceeds our threshold or the quote is older than 60 seconds, the trade is rejected on price integrity grounds before touching the vault."*

### Q4: "Can the agent withdraw the user's funds?"
> **Answer**: *"No. The agent only possesses trading delegation authority bound to the Sentinel Anchor program. The vault PDA has no instruction allowing funds to be withdrawn to an arbitrary agent wallet. All settlements must deposit acquired SPL tokenized assets back into the user's portfolio vault."*

---

*Sentinel Finance — Built for the Stocklana Solana Tokenized-Stock Hackathon.*
