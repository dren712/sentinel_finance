# Sentinel Finance — 3-Minute Hackathon Demo Script

## Overview for Judges & Evaluators

- **Application URL**: `http://localhost:3000`
- **Network**: Solana Devnet (`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`)
- **Theme**: Tokenized stocks already trade on Solana. Sentinel builds what makes owning and delegating them better than today's brokerage apps: **autonomous AI investing with mathematically enforceable financial guarantees**.

---

## 3-Minute Presentation Timeline

### 0:00 – 0:30 | The Core Problem & Portfolio Landing (Tab: `Portfolio`)

1. **The Hook**:
   > *"Tokenized US equities trade 24/7 on Solana. But how do you safely delegate capital to an autonomous AI trading agent? Traditional models only check if an agent has permission to call an instruction—they cannot guarantee what financial state results. If the AI hallucinates, it can wipe out your cash or dump your portfolio into a single volatile token."*
2. **Show Portfolio View**:
   - Point out the **Portfolio NAV**: `$100,000.00` total value.
   - Point out the **Policy Health Pill**: `4 / 4 Guarantees Healthy`.
   - Point out the **Transparency Banner**: Explicitly identified as `Demo Portfolio (Simulated Benchmark Assets)`.
   - Show the **TradingView Interactive Financial Chart** with timeframe toggles and the **Asset Allocation Strip** with permanent brand colors (`NVDAx` emerald, `AAPLx` slate, `SPYx` blue, `USDC` cyan).
   - Show the **Holdings Table** displaying individual stock positions and active compliance checks.

---

### 0:30 – 0:55 | Enforceable Guarantees (Tab: `Protection`)

1. **Navigate to the `Protection` Tab**:
   > *"In Sentinel, the investor sets hard mathematical invariants that no agent can violate."*
2. **Highlight the 4 User Guarantees**:
   - **Invariant A (Ceiling)**: Maximum Single-Asset Exposure ≤ **25.00%** (2,500 bps).
   - **Invariant B (Floor)**: Minimum Stablecoin Reserve Floor ≥ **20.00%** (2,000 bps).
   - **Invariant C (Sizing)**: Maximum Single Trade Value ≤ **$10,000**.
   - **Invariant D (Execution)**: Maximum Slippage Tolerance ≤ **1.00%** (100 bps).
3. **Show "What Sentinel Guarantees"**:
   - Explain that these are not merely frontend checks—they are verified by the on-chain Anchor program in `u128` integer math, guaranteeing **atomic transaction rollback on Solana** if breached.

---

### 0:55 – 1:45 | Bad Decision & Atomic Revert (Tab: `Activity`)

1. **Trigger Autonomous Execution**:
   - Click **"Run Autonomous Demo"** in the top navigation header.
   - The app automatically navigates to the **`Activity`** tab.
2. **Step 1: The Autonomous Drift / Over-Concentration**:
   - Sentinel Robo-01 spots momentum in NVIDIA and proposes: `BUY NVDAx — $15,000`.
   - Show the **Decision Verdict**:
     - **POSTCONDITION VIOLATION • TRANSACTION ABORTED**
     - Reason: `Single-asset exposure exceeded: NVDAx would reach 35.00%, exceeding ceiling of 25.00%`.
     - Failure Code: `ERR_EXPOSURE_EXCEEDED`.
3. **The Proof of Safety**:
   - Point out that **zero capital moved**: the Solana transaction was aborted, and the portfolio state remained 100% intact.

---

### 1:45 – 2:25 | Autonomous Self-Adaptation & Settlement (Tab: `Activity`)

1. **Step 2: The Agent Adapts to User Guarantees**:
   - Show how the autonomous agent reads the machine-readable rejection code and calculates the exact maximum compliant trade size ($5,000).
   - Agent proposes: `BUY NVDAx — $5,000`.
2. **Show Successful Settlement**:
   - All 4 postconditions evaluate to **PASS**.
   - Status transitions to: **POSTCONDITIONS SATISFIED • SETTLED**.
   - The on-chain `PortfolioVault` balance mutates:
     - `NVDAx` increases from $20,000 to $25,000 (reaching exactly the 25.00% cap).
     - `USDC` decreases from $25,000 to $20,000 (remaining safely on the 20.00% reserve floor).

---

### 2:25 – 3:00 | Cryptographic Proof & Sponsor Capabilities (Tab: `Activity` & `Agent`)

1. **Inspect PROVN Cryptographic Commitments**:
   - Expand the settled transaction drawer in the `Activity` tab.
   - Show:
     - **Pre-State SHA-256 Hash**: Canonical JSON commitment of portfolio before trade.
     - **Post-State SHA-256 Hash**: Canonical JSON commitment of portfolio after trade.
     - **Intent Hash & Signature**: Verified Ed25519 signature.
     - **Solana Explorer Devnet Link**: Real transaction reference.
2. **Highlight Sponsor Capabilities**:
   - **Meteora DBC**: Validated pool liquidity floor ($25k) and curve price stability before execution.
   - **Pyth Network**: Market truth oracle powering mark-to-market valuation and slippage detection.
   - **PreStocks**: Architecture expanded to support tokenized pre-IPO tech giants (SpaceX, OpenAI, Stripe).
   - **ClawPump**: Autonomous agent economic identity and detached signing keypair.
3. **Closing Punchline**:
   > *"Sentinel Finance turns autonomous AI agents from uncontrollable liability into institutional-grade robo-investors on Solana."*
