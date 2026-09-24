# Sentinel Robo — Flagship Demo Walkthrough (`docs/DEMO.md`)

## 1. The 5-Step Flagship Demo Flow

Trigger via **"Run 5-Step Demo"** in the header or `POST /api/agent/run`:

| Step | Stage | Action | Portfolio Projection | Sentinel Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `OBSERVE` | Inspect `$100,000` portfolio (`NVDAx 20%`, `AAPLx 20%`, `SPYx 20%`, `USDC 25%`, `Pre-IPO 15%`) | `4/4` guarantees healthy | Ready |
| **2** | `PROPOSE` | `Robo-01` proposes `BUY NVDAx $15,000` | `NVDAx: 20% → 35%` (`> 25%` cap)<br>`USDC: 25% → 10%` (`< 20%` floor)<br>`Trade: $15K` (`> $10K` max) | Proposed |
| **3** | `REJECT` | Sentinel evaluates post-state invariants | `3` invariant breaches detected | **✕ BLOCKED** (`0` tokens moved, Devnet TX [`2haBLUK...`](https://explorer.solana.com/tx/2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD?cluster=devnet)) |
| **4** | `ADAPT` | `Robo-01` calls `readRejection()` and computes exact compliant headroom (`$5,000`) | `NVDAx: 20% → 25.0%` (`≤ 25%` cap)<br>`USDC: 25% → 20.0%` (`≥ 20%` floor)<br>`Trade: $5K` (`≤ $10K` max) | Re-proposed `BUY NVDAx $5,000` |
| **5** | `SETTLE` | Sentinel re-verifies postconditions and settles on Solana Devnet | All `6/6` verifiers pass | **✓ SETTLED** (Devnet TX [`59KCBronda...`](https://explorer.solana.com/tx/59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd?cluster=devnet)) |

---

## 2. Additional Sponsor Guard Scenarios

1. **Pyth Stale Oracle Refusal ("Pyth Demo")**:
   - Injects a `140s` stale quote (`> 60s` max age).
   - Sentinel blocks execution (`ERR_QUOTE_STALE` / `DATA_INTEGRITY_FAILURE`), then settles once a fresh Pyth Hermes pull update (`age 0s`) arrives.
2. **PreStocks Pre-IPO Cap Guard ("PreStocks Demo")**:
   - Proposes `BUY $30,000 OPENAIx` (`18% → 48% > 20%` Pre-IPO cap) $\rightarrow$ **BLOCKED**, then auto-adapts to `$2,000` (`18% → 20.0%`) $\rightarrow$ **SETTLED**.
3. **Meteora Liquidity Floor Guard ("Meteora Demo")**:
   - Simulates a shallow DBC pool (`$12,000 < $25,000` floor) $\rightarrow$ **BLOCKED** by `LiquidityVerifier` (`MARKET_QUALITY_FAILURE`).
