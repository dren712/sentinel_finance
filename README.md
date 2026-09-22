# Sentinel Robo (Sentinel Finance)

> **Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative On-Chain Financial Postcondition Guarantees.**

Sentinel Robo is an autonomous portfolio manager on Solana where the agent can choose the trade, but Sentinel enforces what the resulting portfolio is allowed to become.

**Core Invariant Moat Pipeline**:
$$\text{Intent} \longrightarrow \text{Promise} \longrightarrow \text{Post-State} \longrightarrow \text{Financial Invariants} \longrightarrow \text{Decision} \longrightarrow \text{Adaptation} \longrightarrow \text{Evidence (PROVN)}$$

---

## 🧭 Technical Status & Definition of Truth

Sentinel maintains absolute architectural honesty. We distinguish clearly between verified on-chain code, cryptographic engines, and simulated execution:

```
[LIVE ON SOLANA DEVNET]
Program ID: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
IDL Account: H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6
Policy PDA:  3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh
Agent PDA:   62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ
Vault PDA:   7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y
Solana Explorer: https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet
```

### Definition of Truth Matrix

| Metric / Concept | Concrete Source of Truth | Verification Method | UI Badge / Representation |
| :--- | :--- | :--- | :--- |
| **Wallet Balance** | Solana SPL Token Account / System Account | Direct RPC account query via `@solana/web3.js` | `[DEVNET]` or `[SIMULATION]` |
| **Stock / Asset Price** | Pyth Network Price Feed (Dual-feed) | Pyth SDK deserialization + staleness & confidence bounds check | `[LIVE PYTH]` or `[SIMULATION PRICE]` |
| **Portfolio Allocation** | $\sum(\text{Balance} \times \text{Pyth Price})$ | Computed portfolio valuation engine (`SentinelValuationEngine`) | `[DERIVED METRIC]` |
| **Trade Approved / Rejected** | Sentinel Anchor `execute_guarded_trade` instruction | On-chain execution simulation or confirmed transaction signature | `[PROGRAM CONFIRMED]` |
| **Transaction Status** | Solana RPC Cluster | Block commitment level (`confirmed` / `finalized`) | `[TX PENDING/CONFIRMED/FAILED]` |
| **Venue Liquidity** | Meteora DBC / AMM Pool State | On-chain pool account reserves & invariant checks | `[LIVE VENUE]` or `[ADAPTER VERIFIED]` |
| **Financial Evidence** | PROVN Cryptographic Commitment | On-chain event log / Deterministic SHA-256 preimage | `[CRYPTOGRAPHIC PROOF]` |
| **Offline Test Scenarios** | Local deterministic scenario fixture | Evaluated in memory; badge clearly displayed | `[SIMULATION MODE]` |

---

## 🛡️ Permanent Copilot & Architectural Rules

1. **The Smallest Implementation Rule**:
   Prefer the minimal working implementation that satisfies user intent over bloated architecture. We reject unnecessary microservices, external databases, or superfluous abstractions. Every feature lives in a streamlined **Modular Monolith**.
2. **The Anti-Churn Rule**:
   Preserve working code and existing verified test baselines. Do not churn frameworks, rewrites, or dependencies for superficial aesthetics. Correctness and financial invariants take precedence over novelty.

---

## 🏆 Hackathon Alignment: Stocklana First, Colosseum Graduation

- **Primary Wedge**: **Investing → Robo-Portfolios ($100,000 Main Track)**
- **Strategic Sponsor Focus (2 Locked Paid Tracks + Pyth Oracle Foundation)**:
  1. **PreStocks — $10,000 Target**: 100% PreStocks Tokenized Pre-IPO Asset Universe (`OPENAIx`, `SPACEXx`, `ANTHROPICx`, `STRIPEx`), Portfolio Builder, and Macro Asset Class Allocation Policies (`Pre-IPO ≤ 20%`).
     - *Demo Moment*: Agent proposes `BUY OPENAIx $30,000` (pre-IPO surges from 18% ➔ 48%) ➔ Reverted atomically (`48% > 20% PreStocks Cap`) ➔ Auto-adapts to $2,000 remaining headroom ➔ Settles cleanly via PreStocks Secondary Vault.
  2. **Meteora — $5,000 Target**: Sentinel Equity Market Guard (**Market Protection + Account Protection**). Meteora DBC curve mechanics, reserve depth verification ($25,000 floor), dynamic fee tracking, and bidirectional market protection.
     - *Demo Moment*: Agent proposes `BUY NVDAx $8,000` ➔ User policy passes ($8k ≤ $10k ✓), Portfolio exposure passes (28% ≤ 30% ✓) ➔ BLOCKED by Sentinel Equity Market Guard on shallow Meteora DBC pool depth ($12,000 < $25,000 floor).
  3. **Pyth Network (Pyth Pro)**: Dual-feed mark-to-market pricing, confidence bounds ($\pm \sigma$), tracking error detection, and stale-quote rejection.
- *Strict Sponsor Compliance*: 100% of pre-IPO assets belong exclusively to PreStocks Protocol. No competing pre-IPO tokens are integrated. ClawPump is retained cleanly as an internal Ed25519 agent-wallet identity pattern.

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

## 🎬 The Flagship 5-Step "Aha!" Demo Flow

The core user experience demonstrates autonomous adaptation under strict safety guardrails:

```
Step 1: Connect & Inspect Portfolio
        │
        ▼
Step 2: Robo-01 Proposes Violating Trade (BUY NVDAx $15,000)
        │
        ▼
Step 3: Sentinel Postcondition Aborts Atomically
        ├── NVDAx Exposure: 35.00% > 25.00% [FAILED]
        ├── Stable Reserve: 10.00% < 20.00% [FAILED]
        └── Trade Sizing:  $15,000 > $10,000 [FAILED]
        │
        ▼
Step 4: Autonomous Reactive Adaptation
        ├── Agent reads invariant rejection telemetry
        ├── Solves maximum compliant trade size ($5,000)
        └── Re-submits: BUY NVDAx $5,000
        │
        ▼
Step 5: Settlement & Two-Tier PROVN Receipt
        ├── All 4 Invariants Satisfied (25.00% / 20.00% / $5,000 / 0.12%)
        ├── Investor View: "✓ Protected on Solana"
        └── Technical Drawer: Deterministic SHA-256 Pre/Post State Hashes & PDA
```

---

## 📦 Monorepo Layout & Responsibilities

| Package / Directory | Purpose | Test Status |
| :--- | :--- | :--- |
| `programs/sentinel` | Authoritative Solana Anchor program enforcing postconditions on-chain. | **9/9 Rust Tests Passing** |
| `packages/domain` | Pure TypeScript financial policy engine, fixed-point math, SWARM verifiers, and PROVN receipts. | **39/39 Tests Passing** |
| `packages/sdk` | High-level orchestration client, 10-stage autonomous agent loop, and execution adapters. | **55/55 Tests Passing** |
| `tests/integration` | End-to-end multi-step autonomous adaptation integration test. | **1/1 Test Passing** |
| `apps/web` | Institutional 4-Pillar Next.js 14 frontend (Portfolio, Agent, Protection, Activity). | **Build Passing (Exit 0)** |

---

## 🚀 Verification & Quickstart

### 1. Run All Automated Test Suites
```bash
# 1. Rust Anchor Invariant Tests (9 tests)
cargo test --manifest-path programs/sentinel/Cargo.toml --lib

# 2. Domain Policy Engine & Financial Math Tests (39 tests)
pnpm --filter @sentinel/domain test

# 3. SDK, Autonomous Agent Loop & Execution Adapter Tests (55 tests)
pnpm --filter @sentinel/sdk test

# 4. End-to-End Demo Scenario Integration Test (1 test)
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
