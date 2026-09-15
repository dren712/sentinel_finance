# Sentinel Finance (Sentinel Robo)

> **Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative Financial Postcondition Guarantees.**

Sentinel Finance allows users to delegate portfolio management to autonomous agents while strictly enforcing machine-checkable financial guarantees at the transaction / state-transition boundary.

**"The agent can make investment decisions, but it cannot settle an outcome that violates the user's financial promises."**

---

## 🏆 Hackathon Context: Stocklana

- **Track**: Investing → Robo Portfolios
- **Core Judging Focus**: Could this be a real application that users trust to manage capital?
- **Why Solana?**: Solana transactions are atomic and composable. Financial state, tokenized equities, and Sentinel's on-chain postcondition program live within the same execution boundary, allowing atomic validation and abort before settlement.

---

## 💡 The Problem & The Sentinel Solution

### The Delegation Problem
A user wants an autonomous agent to rebalance their tokenized-stock portfolio (e.g. AAPLx, NVDAx, SPYx). However, standard wallet delegation only verifies:
> *"Is the agent authorized to call the swap instruction?"*

If the agent model drifts, hallucinates, or is manipulated, it can dump stablecoin reserves or over-concentrate 90% of the portfolio into a single volatile stock.

### The Sentinel Postcondition Model
Sentinel adds an authoritative second question:
> *"Does the resulting financial state satisfy the conditions the user promised?"*

If an agent proposes a trade that pushes single-stock exposure to 35% when the user's policy ceiling is 25%, **the transaction aborts atomically on-chain**.

---

## 🏛️ Architecture & System Design

```text
USER / WALLET
      │
      ▼
CONNECT & DEFINE FINANCIAL POLICY (PolicyAccount PDA)
      │
      ▼
AUTONOMOUS AGENT (ClawPump Identity / AgentAccount PDA)
      │
      ▼
TRADE INTENT (Asset, Direction, Amount, Rationale)
      │
      ▼
PROMISE COMMITMENT (PromiseAccount PDA)
      │
      ▼
PTA (Postcondition-Transaction-Acceptance) ENGINE
      │
      ├── 1. Max Single-Asset Exposure Check (BPS)
      ├── 2. Min Stablecoin Reserve Floor Check (BPS)
      ├── 3. Max Trade Sizing Limit Check (USD)
      └── 4. Max Price Slippage Tolerance (BPS)
      │
      ├── PASS ────► COMMIT TRANSACTION (Status: SETTLED)
      │
      └── FAIL ────► ATOMIC ABORT (Status: REJECTED, State Preserved)
      │
      ▼
PROVN EVIDENCE LAYER (Immutable Cryptographic Anchor)
```

---

## ⚡ Core Components

### 1. On-Chain Sentinel Program (`programs/sentinel`)
- **Program ID**: `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`
- **Framework**: Anchor / Solana Agave
- **Instructions**:
  - `initialize_agent`: Binds agent authority to user controller.
  - `initialize_policy`: Anchors financial constraints (`max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`, `max_slippage_bps`).
  - `create_promise`: Locks intent parameters into `PromiseAccount` PDA.
  - `execute_guarded_trade`: Authoritatively computes postcondition integer math. Reverts atomically if any invariant fails; settles if all pass.
  - `record_evidence`: Anchors PROVN cryptographic proof on-chain.

### 2. Deterministic Policy Engine (`packages/domain`)
- High-precision fixed-point integer basis point math.
- 10 comprehensive invariant boundary unit tests (`25.00% PASS` vs `25.01% FAIL`, `20.00% PASS` vs `19.99% FAIL`, `$10,000 PASS` vs `$10,001 FAIL`).

### 3. Autonomous Robo-Agent Simulator (`packages/sdk`)
- Autonomous agent implementing the reference hackathon demo scenario:
  - **Step 1 (Bad Autonomous Decision)**: Proposes `BUY NVDAx $15,000` → Rejected (exposure reaches 35% > 25%, stablecoin drops to 10% < 20%, size $15k > $10k).
  - **Step 2 (Auto-Adapted Compliant Decision)**: Agent reads rejection feedback and calculates exact maximum compliant size ($5,000) → Proposes `BUY NVDAx $5,000` → Settled!

### 4. PROVN Cryptographic Evidence Layer (`packages/domain`)
- Deterministic SHA-256 state commitments:
  - Pre-State Hash & Post-State Hash
  - Trade Intent Hash & Policy Hash
  - Verification Verdict, Failure Codes, and Transaction Signatures

### 5. SWARM-Lite Verification Modules (`packages/domain`)
- Three independent verifiers evaluate proposed transitions concurrently:
  - `RiskVerifier`: Evaluates single-equity caps and concentration risk.
  - `BalanceVerifier`: Evaluates reserve floors, sizing limits, and solvency.
  - `PolicyVerifier`: Evaluates policy freshness, status, and execution slippage.

### 6. Institutional Web UI (`apps/web`)
- Next.js 14 App Router, Tailwind CSS, `@solana/wallet-adapter-react`.
- Core screens:
  - **Portfolio**: Real-time balances vs policy boundaries with visual safety bars.
  - **Autonomous Agent**: Status, ClawPump wallet authority, strategy objectives, interactive custom trade tester.
  - **Policy Guarantees**: Interactive sliders for user guarantees and on-chain PDA state.
  - **Decision Inspector**: Side-by-side pre vs post state transition comparison, PTA lifecycle diagram, check tables, failure codes.
  - **Evidence (PROVN)**: Searchable cryptographic proof explorer.
  - **Sponsors**: Live Meteora DBC market-quality sandbox and ClawPump agent wallet identity.

---

## 🌟 Sponsor Integrations

### Meteora DBC Track
- **`MeteoraDBCMarketQualityVerifier`**: Ensures autonomous agents only trade on Meteora Dynamic Bonding Curves that meet institutional market quality thresholds (minimum liquidity depth >= $25,000 and price deviation <= 2.00% from reference equity index).

### ClawPump Track
- **`ClawPumpAgentWallet`**: Wraps autonomous agent keypair management, signs agent-originated trade intents, and enforces that agent authority cannot bypass the user's Sentinel policy constraints.

---

## 🚀 Quickstart & Verification

### Running the Web Application
```bash
# Start Next.js development server
pnpm --filter @sentinel/web run dev
# Open http://localhost:3000
```

### Running All Automated Test Suites
```bash
# 1. Domain Policy Engine Unit Tests (10 tests)
pnpm --filter @sentinel/domain run test

# 2. SDK & Agent Simulator Tests (5 tests)
pnpm --filter @sentinel/sdk run test

# 3. Anchor Program Rust Invariant Tests (6 tests)
cargo test --manifest-path programs/sentinel/Cargo.toml --lib

# 4. End-to-End Demo Integration Test
node --test tests/integration/demo-scenario.test.ts

# 5. Production Next.js Build
pnpm --filter @sentinel/web run build
```

---

## 📄 License
MIT License. Built for the Stocklana Solana Tokenized-Stock Hackathon.
