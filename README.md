# Sentinel Robo

> **Autonomous Robo-Portfolio on Solana with Authoritative On-Chain Financial Postcondition Guarantees.**

Sentinel Robo is an autonomous portfolio manager where the AI agent chooses the trade, but Sentinel enforces what the resulting portfolio is allowed to become.

---

## ⚡ The First Screen: WHAT • WHY • HOW • DEMO

### 1. WHAT: The Product
**Sentinel Robo** is an autonomous portfolio manager on Solana designed for tokenized equities, pre-IPO tech assets, and stable reserves.
- **The Core Wedge**: Investing → Autonomous Robo-Portfolios on Solana.
- **Sponsor Tracks**: **PreStocks** ($10K Target) • **Meteora** ($5K Target) • **Pyth Network** (Security Input).

### 2. WHY: The Financial State-Transition Boundary
- **The Delegation Dilemma**: Standard Web3 wallet delegation only checks *who signed the transaction*. It never checks *what financial state results*. If an autonomous AI agent hallucinates, drifts, or hits illiquid routing, it can wipe out cash reserves or concentrate 90% into a single equity.
- **Why Solana**: *"Our enforcement lives at the financial state-transition boundary."* The Policy PDA, Promise PDA, Portfolio State, and Trade Execution settle within the **exact same Solana execution environment**. Enforcement is authoritative and on-chain—not an advisory off-chain API.

### 3. HOW: The Sentinel Loop

```
       ┌────────────────────────┐
       │      AGENT INTENT      │ (Agent proposes trade from market thesis)
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   POST-STATE PROJECTION│ (Prospective state transition calculated)
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │ ON-CHAIN GUARANTEES    │ (Authoritative Anchor & SWARM verifiers)
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   [PASS: SETTLE]      [BREACH: BLOCK]
   Actual SPL Deltas   Atomic On-Chain Revert
   Zero State Leak     Zero Funds Moved
         │                   │
         │                   ▼
         │             ┌───────────┐
         │             │   ADAPT   │ (Agent autonomously computes headroom)
         │             └─────┬─────┘
         │                   │ (Re-submits compliant trade)
         ▼                   ▼
       ┌────────────────────────┐
       │      PROVN PROOF       │ (Two-tier verified cryptographic receipt)
       └────────────────────────┘
```

### 4. DEMO: Three Flagship "Aha" Cases
Sentinel does not blindly trust the **AGENT**, the **MARKET**, or the **DATA**:
- **Case A (Doesn't trust the AGENT)**: Agent proposes `BUY NVDAx $15,000` (would breach 25% single-asset cap & 20% cash floor) ➔ **BLOCK** ➔ Agent auto-calculates remaining compliant capacity ➔ Proposes `BUY NVDAx $5,000` ➔ **SETTLES**!
- **Case B (Doesn't trust the MARKET)**: Agent proposes `BUY NVDAx $8,000` into shallow Meteora DBC pool (1.70% price impact > 1.00% limit) ➔ **BLOCK** by Equity Market Guard ➔ Agent adapts size along DBC curve to `$2,500` (0.45% impact) ➔ **SETTLES**!
- **Case C (Doesn't trust the DATA)**: Agent proposes `BUY AAPLx $4,000` on 140s stale Pyth oracle quote (> 60s limit) ➔ **REFUSED** (`ERR_QUOTE_STALE`) ➔ Pyth Hermès on-demand pull update delivers fresh quote (age 0s) ➔ **SETTLES**!

---

## 🔍 Verified Solana Devnet Evidence

| Component | Solana Devnet Address / Link | Role / Invariant Guaranteed |
| :--- | :--- | :--- |
| **Program ID** | [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet) | Anchor Program holding `execute_guarded_trade` |
| **Policy PDA** | [`3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh`](https://explorer.solana.com/address/3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh?cluster=devnet) | Seeds `[b"policy", owner]` — 25% cap, 20% floor, $10k size |
| **Agent PDA** | [`62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ`](https://explorer.solana.com/address/62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ?cluster=devnet) | Seeds `[b"agent", owner, agent_id]` — Unprivileged agent authority |
| **Vault PDA** | [`7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y`](https://explorer.solana.com/address/7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y?cluster=devnet) | Seeds `[b"vault", owner]` — Authoritative on-chain execution authority |
| **IDL Account** | [`H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6`](https://explorer.solana.com/address/H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6?cluster=devnet) | Verified Anchor IDL definition deployed on Devnet |
| **Meteora DBC Program** | [`dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`](https://explorer.solana.com/address/dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN) | Official Meteora Dynamic Bonding Curve Program |
| **Meteora DBC Authority** | [`FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM`](https://explorer.solana.com/address/FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM) | Canonical Meteora Virtual Pool Authority PDA |
| **NVDAx DBC Pool PDA** | [`4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk`](https://explorer.solana.com/address/4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk) | Canonical Pool PDA `[b"pool", auth, baseMint, quoteMint]` |

> 📹 **Submission Video Materials**:
> - **Pitch Video (3 min)**: [`docs/PITCH_VIDEO_SCRIPT.md`](docs/PITCH_VIDEO_SCRIPT.md) — Product, market opportunity, live demo, and vision.
> - **Technical Video (5 min)**: [`docs/TECHNICAL_VIDEO_SCRIPT.md`](docs/TECHNICAL_VIDEO_SCRIPT.md) — Anchor accounts, PDAs, postconditions, adapt loop, and PROVN state roots.

---

## 🏆 Hackathon Alignment: Stocklana First, Colosseum Graduation

- **Primary Wedge**: **Investing → Robo-Portfolios ($100,000 Main Track)**
- **Strategic Sponsor Focus (2 Locked Paid Tracks + Pyth Oracle Foundation)**:
  1. **PreStocks — $10,000 Target**: 100% PreStocks Tokenized Pre-IPO Asset Universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`), Portfolio Builder, and Macro Asset Class Allocation Policies (`Pre-IPO ≤ 20%`).
     - *Demo Moment (Mode 1: PORTFOLIO_FAILURE)*: Portfolio holds $18k (18%) in Pre-IPO equity. Agent proposes `BUY OPENAIx $5,000` (individual trade sizing passes: $5k ≤ $10k cap). Pre-IPO allocation surges to 23.0% (> 20.0% ceiling) ➔ Reverted atomically on asset class invariant! ➔ Agent auto-solves remaining headroom: `($100,000 × 20%) - $18,000 = $2,000` ➔ Reproposes `BUY OPENAIx $2,000` (hits exact 20.0% cap) ➔ Settles cleanly via PreStocks Secondary Vault PDA.
  2. **Meteora — $5,000 Target**: Sentinel Equity Market Guard (**Market Protection + Account Protection**). Meteora DBC curve mechanics, reserve depth verification ($25,000 floor), dynamic fee tracking, and bidirectional market protection.
     - *Demo Moment (Mode 2: MARKET_FAILURE)*: Agent proposes `BUY NVDAx $8,000`. User policy passes ($8k ≤ $10k ✓), Portfolio exposure passes (28% ≤ 30% ✓) ➔ BLOCKED by Sentinel Equity Market Guard because Meteora DBC curve estimates 1.70% price impact (> 1.00% max slippage cap) and pool depth is shallow ($12,000 < $25,000 floor) ➔ Agent reads DBC bonding curve equation and auto-adapts trade down to $2,500 along the curve (0.45% ≤ 1.00% impact) ➔ Approved & Settled on Meteora DBC!
  3. **Pyth Network (Pyth Pro)**: Pyth as an authoritative **Security Input** (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`). Dual-feed mark-to-market pricing (verified distinct tokenized vs underlying feeds), basis tracking error detection, confidence bounds ($\pm \sigma$), and staleness rejection via Pyth pull updates.
     - *Demo Moment (Mode 3: DATA_INTEGRITY_FAILURE)*: Agent proposes `BUY AAPLx $4,000`. Sizing and exposure pass, but Pyth oracle quote is 140s old (> 60s freshness limit) ➔ Execution refused (`ERR_QUOTE_STALE`) ➔ Pyth Hermès on-demand pull update delivers fresh price (age 0s, ±$0.03) ➔ Approved & Settled!
- *Strict Sponsor Compliance*: 100% of pre-IPO assets belong exclusively to PreStocks Protocol ($10K Bounty). Meteora DBC provides dynamic liquidity curves with liquidity floor guards ($5K Bounty). Pyth Network provides pull oracle market truth and security bounds. Unprivileged agent execution uses standard Solana Ed25519 keypair signatures.

---

## 🛑 The Three Flagship "Aha" Cases: We Don't Blindly Trust

Sentinel transforms autonomous execution from unconstrained agency into a bounded financial system governed by internal state, external market quality, and data integrity:

> **Core Thesis: Sentinel doesn't blindly trust the AGENT, the MARKET, or the DATA.**

| Flagship Case | Category | What Sentinel Doesn't Trust | Canonical Demo Flow |
| :--- | :--- | :--- | :--- |
| **Case A: Portfolio Violation** | **Mode 1: PORTFOLIO_FAILURE** | Doesn't trust the **AGENT** | **Rogue Allocation Breach**: Agent proposes `BUY NVDAx $15,000`. Concentration surges to 35% (> 25% cap), cash drops to 10% (< 20% floor), size breaches $10k limit ➔ **BLOCK** ➔ **ADAPT** ➔ Agent solves exact headroom and proposes `BUY NVDAx $5,000` (hits 25.0% cap, 20.0% cash) ➔ **APPROVED & SETTLED**! |
| **Case B: Market Violation** | **Mode 2: MARKET_FAILURE** | Doesn't trust the **MARKET** | **Meteora DBC Curve Impact**: Agent proposes `BUY NVDAx $8,000`. Portfolio exposure & user policy both pass ($8k ≤ $10k, 28% ≤ 30%). Meteora DBC curve estimates 1.70% price impact (> 1.00% max slippage) ➔ **BLOCK** by Equity Market Guard! ➔ **ADAPT along curve** ➔ Agent auto-adapts trade down to $2,500 along DBC curve (0.45% ≤ 1.00% impact) ➔ **APPROVED & SETTLED** on Meteora DBC! |
| **Case C: Data Violation** | **Mode 3: DATA_INTEGRITY_FAILURE** | Doesn't trust the **DATA** | **Pyth Oracle Staleness**: Agent proposes `BUY AAPLx $4,000`. Pyth price quote is 140s old (> 60s freshness ceiling) ➔ `STALE / LOW CONFIDENCE ➔ NO EXECUTION` ➔ **REFUSED** (`ERR_QUOTE_STALE`) ➔ **WAIT / REPRICE** via Pyth Hermès on-demand pull update (age 0s, $\pm \$0.03$) ➔ **APPROVED & SETTLED**! |

*Bonus PreStocks Demonstration*: Proves Sentinel understands **macro asset classes** (Public Equity + Pre-IPO + Stable Reserve). Agent proposes `BUY OPENAIx $5,000` (sizing passes). Pre-IPO allocation surges to 23% (> 20% cap) ➔ **REJECTED** on asset class invariant! Agent auto-solves remaining headroom: `($100,000 × 20%) - $18,000 = $2,000` ➔ Reproposes `BUY OPENAIx $2,000` (hits exact 20.0% cap) ➔ **APPROVED & SETTLED** via PreStocks Secondary Vault PDA!

---

## 💎 The Four Proof Layers of Sentinel

When a judge evaluates Sentinel Finance, every element of our repository and submission serves one of four concrete proof layers:

1. **Proof 1 — Product**: *"I understand what this does."*  
   Autonomous robo-portfolio manager on Solana where the agent chooses the trade, but Sentinel enforces what the resulting portfolio is allowed to become.
2. **Proof 2 — Live Demo**: *"I saw it actually work."*  
   The three flagship Aha cases demonstrating that Sentinel does not blindly trust the agent, the market, or the data.
3. **Proof 3 — Protocol**: *"I can inspect the Anchor logic."*  
   Live Anchor program deployed on Solana Devnet (`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`), fixed-point `u128` math, Policy PDA (`3wTp1Y...`), Agent PDA (`62vpHz...`), and Vault PDA (`7TffMK...`).
4. **Proof 4 — Evidence**: *"I can verify what happened."*  
   Two-tier PROVN receipts with deterministic SHA-256 pre and post state roots, intent hashes, policy hashes, and Solana transaction signatures.

> 🎬 **Pitch Video**: Read our official 3-minute video script formatted for Colosseum review: [docs/PITCH_VIDEO_SCRIPT.md](docs/PITCH_VIDEO_SCRIPT.md).

---

## 💡 The Problem & The Sentinel Solution

### The Delegation Dilemma
When an investor delegates trading authority to an autonomous AI agent, standard Solana wallet delegation only answers:
> *"Is the agent authorized to call the transaction?"*

If the AI drifts, hallucinates, or falls victim to market anomalies, it can drain stablecoin reserves, purchase low-liquidity assets, or over-concentrate 90% of the portfolio into a single volatile equity.

### The Sentinel Postcondition Architecture
Sentinel enforces an authoritative second question:
> *"Does the resulting financial state satisfy the conditions the user promised?"*

Sentinel checks invariants **after simulated state transition but before on-chain commit**:
- **Max Single-Asset Exposure**: e.g., $\le 25.00\%$
- **Min Stablecoin Reserve Floor**: e.g., $\ge 20.00\%$
- **Max Trade Sizing Limit**: e.g., $\le \$10,000\text{ USD}$
- **Max Slippage Tolerance**: e.g., $\le 1.00\%$
- **Pre-IPO Secondary Cap**: e.g., $\le 20.00\%$

If **any** invariant is breached, the Anchor program **atomically reverts the entire Solana transaction**. Zero funds leave the vault.

---

## ⚡ Why Solana? Enforcement at the Financial State-Transition Boundary

The common pitch for Solana is speed and low fees. For Sentinel, **that is the wrong answer**.

Sentinel belongs on Solana because **our enforcement lives directly at the financial state-transition boundary**.

### The Fatal Flaw of Off-Chain Risk APIs
In conventional Web3 agent frameworks, risk evaluation is an off-chain HTTP API (`POST /verify -> { "approved": true }`). This architecture fails in real financial conditions:
1. **Advisory, Not Enforcing**: A drifting, hallucinating, or compromised agent can simply bypass the API check and sign transactions directly with its keypair.
2. **State Desynchronization & Slippage**: An off-chain API inspects stale historical state. Between the API check and on-chain block commitment, pool liquidity shifts, slippage spikes, or concurrent transactions execute.
3. **No Sovereign Custody**: The agent either holds the raw private keys (catastrophic tail risk) or relies on centralized off-chain custody.

### The Solana State-Transition Solution
Solana's Sealevel runtime and Program Derived Address (PDA) architecture allow all four pillars of authoritative risk enforcement to co-exist within the **exact same atomic execution environment**:

```
┌─────────────────────────────────────────────────────────────┐
│                 SAME SOLANA ATOMIC TRANSACTION               │
│                                                             │
│   1. Policy PDA          Immutable user risk invariants     │
│      (3wTp...JUUh)       (Max 25% single-asset, 20% cash)   │
│            │                                                │
│            ▼                                                │
│   2. Promise PDA         Agent's committed trade intent     │
│      (Deterministic)     (Direction, Size, Target Mint)     │
│            │                                                │
│            ▼                                                │
│   3. Portfolio State     Real on-chain SPL Token Vaults     │
│      (7Tff...AY4Y)       (NVDAx, AAPLx, SPYx, USDC)         │
│            │                                                │
│            ▼                                                │
│   4. Execution Venue     Meteora DBC / PreStocks Vault      │
│      (CPI Swap)          (Atomic balance mutation)          │
│            │                                                │
│            ▼                                                │
│   5. Sentinel Guard      u128 Fixed-Point Postcondition     │
│      (Program Runtime)   Verification & Invariant Check     │
│            │                                                │
│      ┌─────┴────────────────────────┐                       │
│      ▼                              ▼                       │
│   PASS: Commit State            FAIL: ATOMIC REVERT         │
│   PROVN Receipt Emitted         0 tokens leave vault        │
└─────────────────────────────────────────────────────────────┘
```

1. **Policy PDA**: Authoritative risk bounds (`max_single_asset_bps`, `min_reserve_bps`, `max_trade_size_usd`) reside on-chain as a Solana PDA owned by the Sentinel program. The user—and only the user—can initialize or update them.
2. **Promise PDA & Conditional Delegation**: The agent does NOT own the vault tokens. The agent is granted restricted delegation that can ONLY be executed via Sentinel's `execute_guarded_trade` instruction.
3. **Atomic Evaluation**: The swap executes and the post-trade portfolio balance is evaluated against the Policy PDA within the **exact same Solana transaction**.
4. **Guaranteed Revert**: If the resulting post-state breaches even 1 basis point of the user's invariant, the program aborts with a Solana runtime error (`SentinelError::PolicyInvariantViolated`). Because transactions are atomic, **the entire trade is rolled back**. 0 tokens leave the vault; 0 capital is lost.

**Sentinel is not a recommendation engine. It is an authoritative on-chain state machine guard.**

---

## 🧾 PROVN: The Cryptographic Receipt of Sentinel's Decision

PROVN is not a speculative standalone "crypto feature" or a disconnected dashboard tab—**it is the authoritative cryptographic receipt produced by Sentinel's decision cycle**.

Sentinel implements a **two-tier audit architecture**:
1. **Tier 1 (The Investor View)**: Instant reassurance and clarity. The investor sees:
   - **`Protected by Sentinel`**
   - **`0 tokens transferred · Capital 100% safe`**
   - Clear visual status of portfolio health guarantees.
2. **Tier 2 (The Engineer & Institutional Auditor View)**: One-click expandable drawer exposing full cryptographic verification:
   - **Intent Hash**: SHA-256 digest of the agent's proposed intent parameters.
   - **Policy Hash**: Cryptographic commitment of active risk limits.
   - **Pre-State Root**: SHA-256 state tree digest prior to instruction execution.
   - **Post-State Root**: Prospective or confirmed post-trade balance state.
   - **Deterministic Evidence Record**: Sealed execution telemetry and invariant verification flags.

---

## 🏛️ Modular Monolith Architecture

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                    │
│  apps/web (Next.js 14, Tailwind, @solana/wallet-adapter-react, Lightweight Charts)│
│                                                                                   │
│   ┌───────────────┐   ┌───────────────┐   ┌────────────────┐   ┌──────────────┐   │
│   │ 1. PORTFOLIO  │   │   2. AGENT    │   │ 3. PROTECTION  │   │ 4. ACTIVITY  │   │
│   │ NAV & Assets  │   │  Robo-01 &    │   │ Boundaries &   │   │ Decisions &  │   │
│   │ 4/4 Health    │   │  10-Stage Loop│   │ PDA Guarantees │   │ PROVN Drawer │   │
│   └───────┬───────┘   └───────┬───────┘   └────────┬───────┘   └──────┬───────┘   │
└───────────┼───────────────────┼────────────────────┼──────────────────┼───────────┘
            │                   │                    │                  │
            ▼                   ▼                    ▼                  ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             SDK & ORCHESTRATION LAYER                             │
│  packages/sdk (SentinelClient, ExecutionAdapters, AutonomousRoboAgent)            │
│                                                                                   │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐   │
│  │ AutonomousRoboAgent   │   │ Decision Cycle        │   │ Execution Adapters │   │
│  │ • 10-Stage Loop       │──►│ • Pre-Flight Engine   │──►│ • Meteora DBC      │   │
│  │ • Ed25519 Signer      │   │ • Auto-Adaptation     │   │ • PreStocks Sec.   │   │
│  └───────────────────────┘   └───────────────────────┘   │ • SimulatedAdapter │   │
│                                                          └─────────┬──────────┘   │
└────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                     │
            ┌────────────────────────────────────────────────────────┘
            ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          DOMAIN & VERIFICATION LAYER                              │
│  packages/domain (PolicyEngine, SWARM-Lite Verifiers, PROVN Receipts)             │
│                                                                                   │
│  ┌──────────────────┐   ┌─────────────────────┐   ┌───────────────────────────┐   │
│  │ AssetRegistry    │   │ SWARM-Lite Engine   │   │ PROVN Evidence Receipts   │   │
│  │ • NVDAx, AAPLx   │   │ • RiskVerifier      │   │ • Canonical JSON Hashing  │   │
│  │ • SPYx, USDC     │   │ • BalanceVerifier   │   │ • Pre/Post SHA-256 Proofs │   │
│  │ • PreStocks Uni  │   │ • PriceIntegrity    │   │ • Two-Tier Drawer Output  │   │
│  └──────────────────┘   └─────────────────────┘   └───────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        ON-CHAIN ENFORCEMENT BOUNDARY                              │
│  programs/sentinel (Solana Anchor Program: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9k)│
│                                                                                   │
│   Instructions:                                                                   │
│   ├── initialize_policy / update_policy (PolicyAccount PDA)                       │
│   ├── initialize_agent (AgentAccount PDA)                                         │
│   ├── initialize_vault (PortfolioVault PDA)                                       │
│   ├── create_promise (PromiseAccount PDA)                                         │
│   └── execute_guarded_trade (u128 Fixed-Point Math Postcondition Check)           │
│                                                                                   │
│   Result:                                                                         │
│   ├── PASS: Mutates vault ledger & records settlement                             │
│   └── FAIL: ATOMIC REVERT — 0 tokens transferred, 0 capital loss                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎬 The Center of the UI: "What did the agent try to do?"

The UI does not lead with a generic portfolio balance. It leads directly with the core product thesis:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ WHAT DID THE AGENT TRY TO DO?                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   PROPOSED                    SENTINEL                                           │
│   BUY NVDAx            ───►   BLOCKED                                            │
│   $15,000                     Prospective state breached 3 financial invariants  │
│                               0 tokens moved · Capital 100% safe                 │
│                                                                                  │
│   PROJECTED STATE FAILURES:                                                      │
│   ├── NVDAx Exposure:    20.0% → 35.0%   (Policy Limit: 25.0%)   [FAILED]        │
│   ├── USDC Cash Reserve: 25.0% → 10.0%   (Policy Floor: 20.0%)   [FAILED]        │
│   └── Max Trade Sizing:  $15,000         (Policy Ceiling: $10k)  [FAILED]        │
│                                                                                  │
│                                    ▼                                             │
│                                                                                  │
│   ROBO-01  ADAPTING...                                                           │
│   Agent read rejection telemetry ➔ Solved maximum compliant headroom ($5,000)    │
│                                                                                  │
│                                    ▼                                             │
│                                                                                  │
│   NEW PROPOSAL                SENTINEL                                           │
│   BUY NVDAx            ───►   APPROVED                                           │
│   $5,000                      All 4 Invariants Satisfied · Settled on Solana     │
│                               PROVN Receipt Sealed                               │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 🎯 Scope Discipline & The Exemplary Path

Rather than seventeen shallow mock assets with fake integrations, Sentinel delivers **one exemplary, verifiable path**:
- **Public Equities**: `USDC` ➔ `AAPLx` / `NVDAx` (+ `SPYx` index benchmark).
- **PreStocks ($10K Bounty)**: 1-2 certified Pre-IPO tech unicorns (`OPENAIx`, `SPACEXx`) with 409A attestations and Secondary Vault settlement.
- **Meteora ($5K Bounty)**: 1 genuine DBC liquidity use case (`NVDAx` dynamic bonding curve with reserve floor and slippage shield).
- **Pyth Network (Security Input)**: Real-time price, confidence interval, and staleness verification (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`).

### 🎮 Turnkey Demo Scenarios (Interactive in UI & Test Suite)

1. **Flagship Scenario: Exposure & Reserve Enforcement**
   - Agent proposes `BUY NVDAx $15,000` (exceeds single-asset cap & trade size) ➔ Atomic Revert ➔ Auto-adapts to `$5,000` headroom ➔ Settles with PROVN receipt.
2. **PreStocks Scenario ($10,000 Target): Macro Category Cap**
   - Agent proposes `BUY OPENAI $30,000` (pre-IPO surges to 48% vs 20% cap) ➔ Policy rejection ➔ Auto-adapts to `$2,000` capacity ➔ Settles via PreStocks Vault PDA.
3. **Meteora Scenario ($5,000 Target): Sentinel Equity Market Guard**
   - Agent proposes `BUY NVDAx $8,000` (account checks pass) ➔ Intercepted by Meteora DBC pool depth check ($12k < $25k floor) ➔ Prevents toxic slippage before execution.
4. **Pyth Sponsor Scenario: Oracle Security Guard (`STALE / LOW CONFIDENCE ➔ NO EXECUTION`)**
   - Oracle quote stale (140s > 60s max allowed) ➔ Agent proposes `BUY AAPL $4,000` ➔ Sentinel refuses execution on stale pricing ➔ Pyth Hermès pull update refreshes quote (2s) ➔ Settles cleanly on-chain.

---

## 📦 Monorepo Layout & Responsibilities

| Package / Directory | Purpose | Test Status |
| :--- | :--- | :--- |
| `programs/sentinel` | Authoritative Solana Anchor program enforcing postconditions on-chain. | **9/9 Rust Tests Passing** |
| `packages/domain` | Pure TypeScript financial policy engine, fixed-point math, SWARM verifiers, and PROVN receipts. | **39/39 Tests Passing** |
| `packages/sdk` | High-level orchestration client, 10-stage autonomous agent loop, and execution adapters. | **57/57 Tests Passing** |
| `tests/integration` | End-to-end multi-step autonomous adaptation integration test suite (Flagship, PreStocks, Meteora, Pyth). | **4/4 Tests Passing** |
| `apps/web` | Institutional 4-Pillar Next.js 14 frontend (Portfolio, Agent, Protection, Activity). | **Build Passing (Exit 0)** |

---

## 🚀 Verification & Quickstart

### 1. Run All Automated Test Suites (109 / 109 Passing)
```bash
# 1. Rust Anchor Invariant Tests (9 tests)
cargo test --manifest-path programs/sentinel/Cargo.toml --lib

# 2. Domain Policy Engine & Financial Math Tests (39 tests)
pnpm --filter @sentinel/domain test

# 3. SDK, Autonomous Agent Loop & Execution Adapter Tests (57 tests)
pnpm --filter @sentinel/sdk test

# 4. End-to-End Demo Scenario Integration Tests (4 tests)
node --test tests/integration/demo-scenario.test.ts

# 5. Production Web Build Check
pnpm --filter @sentinel/web run build
```

### 2. Start the Development Server
```bash
pnpm --filter @sentinel/web run dev
# Open http://localhost:3000
```

### 3. Or Run with Docker (Zero Node/Rust Setup)
```bash
# Run locally with Docker Compose
docker compose up -d --build

# Or run directly from Docker Hub
docker run -d -p 3000:3000 --name sentinel-finance <your-username>/sentinel-finance:latest
```
See [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) for full Docker Hub publishing instructions.

---

## 📄 License
MIT License. Built for the Stocklana Solana Tokenized-Stock Hackathon.
