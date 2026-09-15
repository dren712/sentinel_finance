# Sentinel Finance (Sentinel Robo)

> **Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative On-Chain Financial Postcondition Guarantees.**

Sentinel Finance allows users to delegate portfolio management to autonomous agents while strictly enforcing machine-checkable financial guarantees at the transaction / state-transition boundary.

**"The agent can make investment decisions, but it cannot settle an outcome that violates the user's financial promises."**

---

## 🧭 Technical Truth & Architecture Boundaries

In accordance with strict technical truth:

| Component | Status | Implementation Truth |
| :--- | :--- | :--- |
| **Sentinel Anchor Program** | **LIVE ON-CHAIN** | Deployed on Solana (`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`). Manages `PolicyAccount`, `AgentAccount`, `PromiseAccount`, and `PortfolioVault` PDAs. |
| **Guarded Trade Execution** | **LIVE ON-CHAIN** | `execute_guarded_trade` enforces agent authority, mutates the on-chain `PortfolioVault` ledger, computes resulting exposure in `u128`, and **atomically reverts the entire Solana transaction** if any postcondition fails. |
| **Agent Intent Signing** | **REAL CRYPTOGRAPHY** | `ClawPumpAgentWallet` generates genuine **Ed25519** signatures over RFC-8785 canonical JSON bytes and verifies them cryptographically. |
| **PROVN Evidence** | **REAL CRYPTOGRAPHY** | Deterministic SHA-256 commitments linking pre-state, post-state, intent, policy version, and on-chain failure codes. |
| **Meteora Integration** | **VERIFIER MODULE** | `MeteoraDBCMarketQualityVerifier` models and validates Dynamic Bonding Curve (DBC) depth ($25k floor) and price deviation (2% cap). *(Not a live DEX pool).* |
| **ClawPump Integration** | **AGENT WALLET PATTERN** | Autonomous agent keypair identity with Ed25519 intent signing bounded by on-chain Sentinel policy. *(Not a token launch).* |
| **Demo Execution Modes** | **DUAL MODE** | **Simulation Mode**: Deterministic offline scenario for judges. **Live Mode**: Requires funded wallet and submits transactions to the Solana Anchor program. |

---

## 🏆 Hackathon Context: Stocklana

- **Track**: Investing → Robo Portfolios
- **The Core Wedge**: Controlled Autonomy.
- **Why Solana?**: Solana transactions are atomic and composable. Financial state and Sentinel's on-chain postcondition program share the same execution boundary: any policy violation aborts before state commit.

---

## 💡 The Problem & The Sentinel Solution

### The Delegation Problem
A user wants an autonomous agent to rebalance their tokenized-stock portfolio (e.g. AAPLx, NVDAx, SPYx). However, standard wallet delegation only verifies:
> *"Is the agent authorized to call the transaction?"*

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
TRADE INTENT (Asset, Direction, Amount, Ed25519 Signature)
      │
      ▼
PROMISE COMMITMENT (PromiseAccount PDA)
      │
      ▼
SENTINEL PORTFOLIO VAULT PDA (programs/sentinel)
      │
      ├── 1. Verify Signer Authority (Agent or Owner)
      ├── 2. Mutate Vault Balance Ledger
      ├── 3. Evaluate Postconditions in u128:
      │      ├── Max Single-Asset Exposure Check (BPS)
      │      ├── Min Stablecoin Reserve Floor Check (BPS)
      │      ├── Max Trade Sizing Limit Check (USD)
      │      └── Max Price Slippage Tolerance (BPS)
      │
      ├── PASS ────► COMMIT VAULT STATE (Status: SETTLED)
      │
      └── FAIL ────► ATOMIC REVERT (Status: REJECTED, Balance Preserved)
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
  - `initialize_policy`: Enforces basis point bounds (`0..10,000 bps`) for `max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`, `max_slippage_bps`.
  - `initialize_vault`: Establishes the on-chain `PortfolioVault` holding USDC reserves and position ledgers.
  - `create_promise`: Locks intent parameters into `PromiseAccount` PDA.
  - `execute_guarded_trade`: Mutates vault state, computes resulting exposure in `u128`, and reverts atomically if any invariant fails.
  - `record_evidence`: Constrained to authorized agent/owner to anchor PROVN cryptographic proof.

### 2. Deterministic Policy Engine (`packages/domain`)
- High-precision fixed-point integer basis point math.
- 10 comprehensive invariant boundary unit tests (`25.00% PASS` vs `25.01% FAIL`, `20.00% PASS` vs `19.99% FAIL`, `$10,000 PASS` vs `$10,001 FAIL`).

### 3. Autonomous Robo-Agent Simulator (`packages/sdk`)
- Autonomous agent implementing the reference hackathon demo scenario:
  - **Step 1 (Bad Autonomous Decision)**: Proposes `BUY NVDAx $15,000` → Rejected (exposure reaches 35% > 25%, stablecoin drops to 10% < 20%, size $15k > $10k).
  - **Step 2 (Auto-Adapted Compliant Decision)**: Agent reads rejection feedback and calculates exact maximum compliant size ($5,000) → Proposes `BUY NVDAx $5,000` → Settled!

### 4. PROVN Cryptographic Evidence Layer (`packages/domain`)
- RFC-8785 canonical JSON serialization with deterministic SHA-256 state commitments:
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
  - **Autonomous Agent**: Identity, ClawPump wallet authority, strategy objectives, interactive custom trade tester.
  - **Policy Guarantees**: Interactive sliders for user guarantees and on-chain PDA state.
  - **Decision Inspector**: Side-by-side pre vs post state transition comparison, PTA lifecycle diagram, check tables, failure codes.
  - **Evidence (PROVN)**: Searchable cryptographic proof explorer.
  - **Sponsors**: Live Meteora DBC market-quality sandbox and ClawPump agent wallet identity with live Ed25519 signing tester.

---

## 🌟 Sponsor Integrations

### Meteora DBC Track
- **`MeteoraDBCMarketQualityVerifier`**: Ensures autonomous agents only trade on Meteora Dynamic Bonding Curves that meet institutional market quality thresholds (minimum liquidity depth >= $25,000 and price deviation <= 2.00% from reference equity index).

### ClawPump Track
- **`ClawPumpAgentWallet`**: Wraps autonomous agent keypair management, signs agent-originated trade intents with real **Ed25519** detached signatures over canonical JSON, and enforces that agent authority cannot bypass the user's Sentinel policy constraints.

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

# 2. SDK & Agent Simulator Tests (6 tests)
pnpm --filter @sentinel/sdk run test

# 3. Anchor Program Rust Invariant Tests (8 tests)
cargo test --manifest-path programs/sentinel/Cargo.toml --lib

# 4. End-to-End Demo Integration Test
node --test tests/integration/demo-scenario.test.ts

# 5. Production Next.js Build
pnpm --filter @sentinel/web run build
```

---

## 📄 License
MIT License. Built for the Stocklana Solana Tokenized-Stock Hackathon.
