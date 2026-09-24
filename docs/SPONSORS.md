# Sentinel Robo — Sponsor Integrations (`PreStocks`, `Meteora`, `Pyth`)

## 1. Pyth Network (`PythLivePriceProvider` + Dual-Feed Tracking)

- **Architecture**:
  `Browser ➔ GET /api/market/:symbol ➔ PythLivePriceProvider ➔ Pyth Hermes v2 REST ➔ NormalizedMarketPrice ➔ Sentinel PriceIntegrityVerifier`
- **Live vs. Benchmark Separation**:
  - **`PythLivePriceProvider` (`LIVE` mode)**: Queries `https://hermes.pyth.network/v2/updates/price/latest` for real-time price, confidence interval ($\pm\text{conf}$), exponent, and `publish_time`.
  - **Fail-Closed Guarantee**: In `DEVNET LIVE` mode, `PythLivePriceProvider` has **no synthetic fallback**. If Pyth Hermes is unreachable or `ageSeconds > 60`, Sentinel marks the quote `STALE` and halts execution (`NO EXECUTION: Pyth oracle quote unavailable or stale`).
  - **`PythBenchmarkPriceProvider` (`SIMULATION` mode)**: Deterministic benchmark feed used strictly for offline tests and sandbox scenarios (`isSimulation: true`).
- **Dual-Feed Peg Deviation Guard (`P7`)**:
  Compares distinct Pyth feed IDs for tokenized equities vs. underlying US equities (`calculateTrackingErrorBps`):
  - `NVDAx` (`0x4244d078...`) vs. `NVDA` (`0xb1073854...`)
  - `AAPLx` (`0x978e6cc6...`) vs. `AAPL` (`0x49f6b65c...`)
  - `SPYx` (`0x2817b784...`) vs. `SPY` (`0x19e09bb8...`)
  - Blocks execution if tracking error exceeds `100 bps` (`1.00%`).

---

## 2. PreStocks (`PreStocksApiClient` + Pre-IPO Exposure Ceiling)

- **Architecture**:
  `Next.js Server ➔ PreStocksApiClient ➔ Isolated PRESTOCKS_EXCLUSIVE_PRE_IPO Universe ➔ Sentinel Asset-Class Policy (Pre-IPO ≤ 20%)`
- **Server-Side Normalization (`P8` & `Item 15`)**:
  - Normalizes PreStocks pre-IPO assets (`OPENAIx`, `SPACEXx`, `STRIPEx`, `ANTHROPICx`) server-side with certified 409A / secondary tender NAVs and `secondaryVaultPda` addresses.
  - Keeps the `PRESTOCKS_EXCLUSIVE_PRE_IPO` asset universe strictly isolated from public equities (`AAPLx`, `NVDAx`, `SPYx`).
- **PreStocks Demo Scenario**:
  - Initial portfolio holds `18.0%` (`$18,000`) Pre-IPO exposure under a `20.0%` (`2000 bps`) Pre-IPO cap.
  - Agent proposes `BUY $5,000 OPENAIx` (`18% → 23%`) $\rightarrow$ **BLOCKED** (`ERR_PRE_IPO_EXPOSURE_EXCEEDED`).
  - Agent reads remaining compliant headroom (`$2,000`) and adapts to `BUY $2,000 OPENAIx` (`18% → 20%`) $\rightarrow$ **APPROVED**.

---

## 3. Meteora (`MeteoraDBCMarketQualityVerifier` + Pool PDA Derivation)

- **Architecture**:
  `Next.js / SDK ➔ Deterministic Meteora DBC Pool PDA ➔ Liquidity & Price Impact Verifier ➔ Sentinel Pre-Trade Market Guard`
- **Deterministic Pool PDAs (`P9`)**:
  Derived from official Meteora Dynamic Bonding Curve (`dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`) seeds:
  - `NVDAx` Pool PDA: `4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk`
  - `AAPLx` Pool PDA: `Lju8wdGRe5UreH3j8oPw5puDEeJTR9CQQWyj4EFmmga`
  - `SPYx` Pool PDA: `7qyKe5feUC4s7mWmYVnxuRstGCW3txuxjZ7ULk5KxHtM`
- **Market Quality Invariants & Honest Attribution (`Item 16`)**:
  - Enforces minimum pool depth (`≥ $25,000`) and price divergence ceiling (`≤ 200 bps`) before Sentinel authorizes execution.
  - **Honest Settlement Attribution**: Because Devnet settlement occurs on the Sentinel Anchor `VaultAccount` PDA after pre-trade Meteora DBC verification (rather than an on-chain Meteora swap CPI), receipts explicitly state `"Settled via Sentinel Vault PDA (Meteora DBC Pre-Trade Guard Verified)"`.
