# Sentinel Finance — 3-Minute Hackathon Demo Script & Video Storyboard

## Overview for Judges & Evaluators

- **Application URL**: `http://localhost:3000`
- **Network**: Solana Devnet (`Program ID: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`)
- **Core Thesis**: Tokenized US equities and pre-IPO shares trade 24/7 on Solana. Sentinel solves the delegation problem by empowering autonomous AI agents to manage portfolios under **authoritative, machine-checkable on-chain financial guarantees**.
- **The Golden Rule**: *"The agent can make investment decisions, but it cannot settle an outcome that violates the user's financial promises."*

---

## 3-Minute Video Storyboard (0:00 – 3:00)

```
[0:00 – 0:35]  THE HOOK & THE PORTFOLIO (Home View)
               Show live NAV ($124k), TradingView curve, PreStocks & Public holdings, 4/4 Health pill.
               
[0:35 – 1:05]  THE FINANCIAL INVARIANTS (Protection View)
               Explain the 4 boundaries & on-chain Anchor PDA authority.
               
[1:05 – 1:45]  STEP 1: AUTONOMOUS VIOLATION & ATOMIC REVERT (Activity View)
               Agent proposes BUY NVDAx $15k ➔ Sentinel halts execution on-chain ➔ 0 tokens moved.
               
[1:45 – 2:25]  STEP 2: AUTONOMOUS REACTIVE ADAPTATION & SETTLEMENT (Activity View)
               Agent reads rejection telemetry ➔ Calculates max compliant size ($5k) ➔ Settles!
               
[2:25 – 3:00]  THE TWO-TIER PROVN RECEIPT & SPONSOR ENGINE
               "✓ Protected on Solana" + Forensic drawer (SHA-256 commitments, slot, PDA).
```

---

## Word-for-Word Script

### 0:00 – 0:35 | The Core Problem & Portfolio Landing (Tab: `Portfolio`)

**[Visual: Start on `Portfolio` tab. Zoom in on `$124,382.18` NAV, `● Sentinel Robo active`, and the 4/4 Guarantees Healthy pill.]**

> **Speaker**:
> *"Tokenized US equities and private unicorns trade 24/7 on Solana. But how do you safely delegate capital to an autonomous AI trading agent?*
> 
> *Today's Web3 delegation only answers: 'Is the agent authorized to call the transaction?' It cannot guarantee what financial state results. If the model drifts, hallucinates, or gets manipulated, it can dump your cash or over-concentrate 90% of your net worth into a single volatile equity.*
> 
> *Meet **Sentinel Finance**—an institutional robo-portfolio on Solana where the agent can make investment decisions, but **cannot settle any outcome that violates the user's financial promises**."*

**[Visual: Click on a holding row (e.g. `NVDAx`). Slide open the Asset Detail Drawer showing Pyth live feed freshness, basis tracking error (12 bps), and Carta 409A NAV attestation.]**

> **Speaker**:
> *"Every asset—from public equities like Nvidia and Apple, to PreStocks tech giants like SpaceX and Stripe—is tracked in real time against Pyth Network dual-feed market truth."*

---

### 0:35 – 1:05 | Enforceable Guarantees (Tab: `Protection`)

**[Visual: Click on the `Protection` tab in the navigation. Show the headline: "Your money moves only within these boundaries." Show the 4 core sliders and on-chain Anchor PDA.]**

> **Speaker**:
> *"On the Protection tab, the investor sets hard mathematical invariants that bind the autonomous agent:*
> 
> 1. *Maximum single-asset exposure: capped at 25%.*
> 2. *Minimum stablecoin reserve floor: held at 20%.*
> 3. *Maximum trade size limit: capped at $10,000.*
> 4. *Maximum slippage tolerance: 1.00%.*
> 
> *Crucially, these are not just frontend warnings. They are codified in our deployed Solana Anchor program at `3gh1...` in `u128` fixed-point math. If any invariant is violated, **the Solana runtime aborts the entire transaction atomically**."*

---

### 1:05 – 1:45 | The Flagship Demo: Autonomous Drift & Atomic Revert (Tab: `Activity`)

**[Visual: Click "Flagship 5-Step Demo" in the top header. The 5-Step Demo Stepper banner animates at the top: `Step 1 ➔ Step 2 ➔ Step 3`.]**

> **Speaker**:
> *"Let's watch Sentinel in action. We trigger the Flagship 5-Step Demo.*
> 
> *Our agent, Sentinel Robo-01, identifies momentum in Nvidia and proposes a trade: **BUY NVDAx for $15,000**.*
> 
> *Watch what happens: Sentinel's on-chain postcondition engine intercepts the prospective state transition:*
> - *Nvidia exposure would reach 35%—breaching the 25% ceiling.*
> - *USDC cash reserves would drop to 10%—violating the 20% floor.*
> - *Trade sizing exceeds the $10,000 limit.*
> 
> ***Verdict: REJECTED.** The transaction aborts atomically. Zero tokens move; 100% of investor capital is preserved."*

---

### 1:45 – 2:25 | Autonomous Reactive Adaptation & Settlement (Tab: `Activity`)

**[Visual: The stepper advances to `Step 4: Auto-Adapt $5k` then `Step 5: PROVN Settle`. Show the timeline updating with `Adapted & Settled`.]**

> **Speaker**:
> *"This is where Sentinel's intelligence shines. The agent doesn't crash or halt. It reads Sentinel's machine-readable rejection telemetry, solves the exact mathematically compliant trade boundary—which is $5,000—and adapts its intent.*
> 
> *It re-submits: **BUY NVDAx for $5,000**.*
> 
> *This time, all 4 invariants pass with flying colors: exposure lands at exactly 25.0%, reserves hold at 20.0%, and sizing is within bounds.*
> 
> ***Verdict: APPROVED & SETTLED.** The on-chain PortfolioVault ledger mutates, and liquidity settles through the venue."*

---

### 2:25 – 3:00 | The Two-Tier PROVN Receipt & Hackathon Tracks (Tab: `Activity`)

**[Visual: Scroll to the Decision Inspector. Highlight the top badge: "✓ Protected on Solana". Then expand the Technical Evidence Drawer showing the SHA-256 pre-state hash, post-state hash, slot, and PDA address.]**

> **Speaker**:
> *"Every decision produces a two-tier **PROVN Financial Audit Receipt**:*
> - *For the everyday investor: a simple, reassuring badge—**'Protected on Solana'**.*
> - *For the auditor or judge: a full forensic drawer with deterministic SHA-256 commitments linking pre-state, post-state, intent hash, policy hash, and the Solana transaction slot.*
> 
> *By unifying **Pyth Network** for market truth, **PreStocks** for private unicorn access, and **Meteora DBC** for bonding curve market quality, Sentinel Finance turns autonomous AI agents from an unpredictable liability into institutional-grade robo-investors on Solana.*
> 
> *Sentinel is fully deployed and verified on Solana Devnet today. Thank you!"*

---

## Key Numbers to Memorize for Recording

| Parameter | Value |
| :--- | :--- |
| **Initial Portfolio NAV** | `$124,382.18` (or `$100,000.00` default) |
| **Violating Intent Size** | `$15,000` (causes 35% NVDA exposure, 10% reserve) |
| **Policy Invariant Limits** | Exposure $\le 25.00\%$, Reserve $\ge 20.00\%$, Size $\le \$10,000$ |
| **Adapted Compliant Size** | `$5,000` (lands at exactly 25.00% exposure, 20.00% reserve) |
| **Devnet Program ID** | `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` |
| **Total Automated Tests** | `104 / 104 passed (100%)` |
