# Sentinel Finance — 3-Minute Demo Guide for Judges

## Quick Start
The development server runs at `http://localhost:3000`.

---

## 3-Minute Demo Script

### 0:00–0:25 — The Problem
1. Connect wallet (Phantom/Solflare) or observe default institutional test portfolio.
2. Note the core problem:
   > *"We can trade tokenized equities 24/7 on Solana. But delegating execution to autonomous agents creates severe trust risks: traditional permission models verify if an agent can execute, but cannot guarantee what financial state results."*

### 0:25–0:50 — Active Financial Guarantees
1. Open the **Portfolio** tab. Observe starting portfolio:
   - Total Value: **$100,000.00**
   - AAPLx: **25.00%** ($25,000)
   - NVDAx: **20.00%** ($20,000)
   - SPYx: **30.00%** ($30,000)
   - USDC: **25.00%** ($25,000)
2. Open the **Policy Guarantees** tab:
   - Max Single Equity: **25.00%** (2500 bps)
   - Min Stablecoin Reserve: **20.00%** (2000 bps)
   - Max Trade Size: **$10,000**
   - Max Slippage: **1.00%**

### 0:50–1:40 — Bad Autonomous Decision (Atomic Abort)
1. Click the top-bar button **"Run Autonomous Demo"**.
2. The UI automatically navigates to the **Decision Inspector** (`Core PTA` tab).
3. **Step 1 Proposed**:
   - Intent: `BUY NVDAx — $15,000`
   - Expected Result: NVDA reaches 35.00% (exceeds 25% cap), USDC drops to 10.00% (breaches 20% floor), Trade size $15,000 (exceeds $10k limit).
4. **Sentinel PTA Result**:
   - Status: **POSTCONDITION VIOLATION • TRANSACTION ABORTED**
   - Reason: `Single-asset exposure exceeded: NVDAx would reach 35.00%, exceeding ceiling of 25.00%`
   - Failure Code: `ERR_EXPOSURE_EXCEEDED`
   - State: Preserved untouched.

### 1:40–2:15 — Autonomous Compliant Decision (Settled)
1. After observing the rejection, the autonomous agent self-adapts.
2. **Step 2 Proposed**:
   - Intent: `BUY NVDAx — $5,000`
   - Expected Result: NVDA reaches exactly 25.00%, USDC stays at exactly 20.00%, Trade size $5,000 <= $10,000.
3. **Sentinel PTA Result**:
   - Status: **POSTCONDITIONS SATISFIED • SETTLED**
   - State: Committed to the portfolio.

### 2:15–2:40 — PROVN Cryptographic Evidence
1. Open the **Evidence (PROVN)** tab.
2. Inspect the latest record:
   - Pre-State SHA-256 Hash
   - Post-State SHA-256 Hash
   - Trade Intent Hash
   - Policy Hash & Version
   - Transaction reference / explorer link
   - SWARM-Lite 3-Module Verdicts (Risk, Balance, Policy)

### 2:40–3:00 — Sponsor Integrations (Meteora & ClawPump)
1. Open the **Sponsors** tab:
   - **Meteora DBC**: Market-quality verifier evaluating liquidity depth and price deviation.
   - **ClawPump**: Dedicated autonomous agent wallet identity bounded by Sentinel policy.
