# Sentinel Robo — Flagship Demo Walkthrough (`docs/DEMO.md`)

> **Live Hosted Application**: [https://sentinel-finance-production-4560.up.railway.app/](https://sentinel-finance-production-4560.up.railway.app/)  
> *(Test the 5-step autonomous loop in the browser. The hosted deployment uses Solana Devnet when the autonomous agent signer is configured; otherwise the execution path explicitly falls back to simulation.)*

## 1. The 5-Step Flagship Demo Flow

Trigger via **"Run 5-Step Demo"** in the header or `POST /api/agent/run`:

| Step | Stage | Action | Portfolio Projection | Sentinel Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `OBSERVE` | Inspect `$100,000` portfolio (`NVDAx 20%`, `AAPLx 20%`, `SPYx 20%`, `USDC 25%`, `Pre-IPO 15%`) | `4/4` guarantees healthy | Ready |
| **2** | `PROPOSE` | `Robo-01` proposes `BUY NVDAx $15,000` | `NVDAx: 20% → 35%` (`> 25%` cap)<br>`USDC: 25% → 10%` (`< 20%` floor)<br>`Trade: $15K` (`> $10K` max) | Proposed |
| **3** | `REJECT` | Sentinel evaluates post-state invariants | `3` invariant breaches detected | **✕ BLOCKED** (`0` tokens moved, Devnet TX [`Yj4VQjWB...`](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet)) |
| **4** | `ADAPT` | `Robo-01` calls `readRejection()` and computes exact compliant headroom (`$5,000`) | `NVDAx: 20% → 25.0%` (`≤ 25%` cap)<br>`USDC: 25% → 20.0%` (`≥ 20%` floor)<br>`Trade: $5K` (`≤ $10K` max) | Re-proposed `BUY NVDAx $5,000` |
| **5** | `SETTLE` | Sentinel re-verifies postconditions and settles on Solana Devnet | All pre-trade & on-chain guards pass | **✓ SETTLED** (Devnet TX [`424aJbYW...`](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet)) |

> **Settlement Note**: Sentinel's PortfolioVault is an on-chain ledger that tracks balances and enforces invariants. Token settlement is simulated; tokens do not move between SPL accounts. No external DEX swap or SPL token transfer is claimed or performed.

---

## 2. Additional Sponsor Guard Scenarios

1. **Pyth Stale Oracle Refusal ("Pyth Demo")**:
   - Injects a `140s` stale quote (`> 60s` max age).
   - Sentinel blocks execution (`ERR_QUOTE_STALE` / `DATA_INTEGRITY_FAILURE`), then settles once a fresh Pyth Hermes pull update (`age 0s`) arrives.
2. **PreStocks Pre-IPO Cap Guard ("PreStocks Demo")**:
   - Proposes `BUY $30,000 OPENAIx` (`18% → 48% > 20%` Pre-IPO cap) $\rightarrow$ **BLOCKED**, then auto-adapts to `$2,000` (`18% → 20.0%`) $\rightarrow$ **SETTLED**.
3. **Meteora Liquidity Floor Guard ("Meteora Demo")**:
   - Simulates a shallow DBC pool (`$12,000 < $25,000` floor) $\rightarrow$ **BLOCKED** by `LiquidityVerifier` (`MARKET_QUALITY_FAILURE`).
