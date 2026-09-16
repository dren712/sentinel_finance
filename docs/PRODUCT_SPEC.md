# Sentinel Finance — Product Specification

## 1. Product Identification & Mission

- **Product Name**: Sentinel Finance (Sentinel Robo)
- **Tagline**: Autonomous investing for tokenized stocks with enforceable financial guarantees.
- **Hackathon Track**: Stocklana — Solana Tokenized-Stock Hackathon (Trading & Investing Track).
- **Core Thesis**: Tokenized equities and pre-IPO assets trade 24/7 on Solana. Investors want autonomous AI robo-agents to actively manage and rebalance portfolios, but cannot risk agent hallucination, runaway liquidation, or prompt-injection attacks. Sentinel solves this by introducing mathematically enforceable on-chain postconditions.

---

## 2. Target User Personas

1. **Autonomous Robo-Advisory Retail User**:
   - Wants hands-off passive or momentum allocation to US equities (`NVDAx`, `AAPLx`, `SPYx`) and pre-IPO equities on Solana.
   - Demands hard mathematical guarantees that their stablecoin reserves will never be drained below a floor (e.g., 20%) and no single asset exceeds a portfolio cap (e.g., 25%).
2. **DAO Treasury & On-Chain Family Office**:
   - Manages capital pools that require programmatically constrained execution.
   - Demands auditable, cryptographic PROVN records for every state mutation, with deterministic SHA-256 commitments and on-chain failure codes.
3. **AI Agent Developers & Quant Funds**:
   - Build autonomous trading strategies using ClawPump keypairs or autonomous wallet models.
   - Want a trusted execution environment on Solana where user funds remain strictly guarded by on-chain policies.

---

## 3. The 4-Pillar Information Architecture

The Sentinel Finance web application (`apps/web`) is structured strictly into 4 cohesive, institutional-grade pillars:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SENTINEL NAVIGATION BAR                         │
│   [Portfolio]          [Agent]          [Protection]       [Activity]  │
└────────────────────────────────────────────────────────────────────────┘
```

### Pillar 1: Portfolio (`/` or tab `portfolio`)
- **Portfolio NAV Metric**: Displays total Net Asset Value denominated in USD (e.g. `$100,000.00`).
- **Transparency Header Banner**: Explicitly badges the asset pool as `Demo Portfolio (Simulated Benchmark Assets) • Solana Devnet`.
- **Policy Health Indicator**: Prominent pill showing `4 / 4 Guarantees Healthy` (or warning if any threshold is currently violated).
- **Interactive TradingView Financial Chart**: Powered by `lightweight-charts` v5.2, rendering interactive equity performance curves across multiple timeframes (1D, 1W, 1M) with required attribution.
- **Allocation Distribution Strip**: Color-coded asset breakdown using permanent, stable brand colors:
  - `NVDAx`: Emerald (`#10B981`)
  - `AAPLx`: Slate (`#94A3B8`)
  - `SPYx`: Blue (`#3B82F6`)
  - `USDC`: Cyan (`#06B6D4`)
- **Holdings Table**: Lists all active positions, mark-to-market prices, token quantities, portfolio weights, Devnet mint addresses with explorer links, and individual policy compliance status.

### Pillar 2: Agent (`agent`)
- **Agent Identity**: Features **Sentinel Robo-01**, badged as `AUTONOMOUS ACTIVE`.
- **Wallet Architecture**: Identifies the agent's dedicated operational keypair utilizing the `ClawPump-compatible wallet pattern` on Solana Devnet.
- **Mandate & Strategy Selection**: Dropdown allowing users to assign strategies (`Momentum Growth`, `Balanced Allocation`, `Conservative Capital Preservation`).
- **Autonomous Decision Lifecycle**: Interactive 4-step diagram (01. Intent Propose → 02. Preflight Verifiers → 03. Anchor Vault Guard → 04. Atomic Settlement / Rollback).
- **Pre-Flight Invariant Tester**: Interactive sandbox where users can simulate custom trade sizes and assets, receiving immediate feedback on whether Sentinel's invariants will permit or reject the trade before submitting.

### Pillar 3: Protection (`protection`)
- **"Your Guarantees" (Interactive Sliders)**:
  1. **Maximum Single-Asset Exposure**: Slider range 10% to 50% (default: 25.00% / 2,500 bps).
  2. **Minimum Stablecoin Reserve Floor**: Slider range 5% to 40% (default: 20.00% / 2,000 bps).
  3. **Maximum Single Trade Value**: Slider range $1,000 to $25,000 (default: $10,000).
  4. **Maximum Slippage Tolerance**: Slider range 0.10% to 3.00% (default: 1.00% / 100 bps).
- **"What Sentinel Guarantees"**: Explains the on-chain atomic rollback invariant enforced by the Anchor program. Any state transition violating any slider reverts atomically on Solana with zero capital loss.
- **On-Chain Anchor PDA Specs**: Documents live Program ID, Policy PDA seeds (`[b"policy", owner]`), and Vault PDA seeds (`[b"vault", owner]`).

### Pillar 4: Activity (`activity`)
- **Recent Activity Feed**: Chronological stream of all evaluated agent actions, settlements, and rejections.
- **Filter Controls**: Filter by `ALL`, `SETTLED`, or `REJECTED`, plus text search over hashes, signatures, and failure codes.
- **Decision Inspector (PTA)**: Deep-dive view of prospective state transitions, showing side-by-side Before vs. After metrics and checklist of machine-evaluated postconditions.
- **PROVN Cryptographic Commitment Explorer**: Expandable drawer displaying:
  - Pre-State SHA-256 Hash
  - Post-State SHA-256 Hash
  - Trade Intent Hash
  - Policy Hash & Policy Version
  - Transaction signature linking to Solana Devnet Explorer
  - SWARM-Lite 3-verifier consensus verdict breakdown (`RiskVerifier`, `BalanceVerifier`, `PolicyVerifier`)

---

## 4. Product Quality Bar & Anti-Deception Rules

1. **Zero Fake Metrics**: No hardcoded static profit claims (e.g. `+1.42%`). Metrics are calculated dynamically or explicitly identified as benchmark references.
2. **Honest Sponsor Positioning**:
   - Meteora DBC is positioned as the market-quality liquidity primitive verifying pool depth and price stability.
   - ClawPump is positioned as the autonomous agent wallet pattern.
   - PreStocks is positioned as the pre-IPO equity asset universe.
   - Pyth is positioned as the market truth / valuation oracle.
3. **Transparent Execution Mode**:
   - Simulation Mode is clearly badged with `sim_tx_` signatures.
   - Live Mode explicitly requires a connected Solana wallet or keypair and submits on-chain instructions.
