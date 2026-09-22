# 🎬 Sentinel Finance — Official 3-Minute Hackathon Pitch Video Script

> **Target Duration**: Under 3 minutes (0:00 – 3:00)  
> **Format**: Founder Camera / Voiceover + Live Screen Share (Split-screen or Picture-in-Picture)  
> **Tone**: Confident, institutional, mathematically rigorous, zero crypto fluff  
> **Key Thesis**: *"Sentinel doesn't blindly trust the agent, the market, or the data."*

---

## ⏱️ Video Timeline Breakdown

```
[0:00 - 0:20]  THE PROBLEM: The Delegation Dilemma (Why AI agents are dangerous)
[0:20 - 0:40]  THE SENTINEL IDEA: Authoritative On-Chain Postconditions
[0:40 - 1:50]  THE LIVE DEMO: $15K Proposal ➔ Atomic Revert ➔ $5K Auto-Adapt ➔ PROVN
[1:50 - 2:30]  REAL SOLANA & SPONSORS: Meteora DBC + Pyth Security + PreStocks
[2:30 - 3:00]  VISION, TRACTION & THE MOAT
```

---

## 🎙️ Teleprompter Script with Visual Cue Directives

---

### [0:00 – 0:20] THE PROBLEM: The Delegation Dilemma

**[VISUAL CUE]**:
*Founder on camera, or slide showing a standard Web3 wallet popup with a red warning badge: "Signature Approved ➔ Portfolio Wiped".*

**[SPOKEN SCRIPT]**:
> "Tokenized equities already trade 24/7 on Solana. But delegating capital to an autonomous AI agent has always been a dangerous leap of faith.
> 
> Today, standard Web3 wallet delegation only checks one thing: *is the agent authorized to sign the transaction?*
> 
> It never checks *what financial state results*. If the AI model hallucinates, drifts, or hits an edge case, it can dump your cash reserves or plunge 90% of your net worth into a single volatile equity. 
> 
> Current AI agents are completely unconstrained."

---

### [0:20 – 0:40] THE SENTINEL IDEA: Postconditions at the Boundary

**[VISUAL CUE]**:
*Diagram transitions onto screen showing the pipeline:*
$$\text{Intent} \longrightarrow \text{Promise} \longrightarrow \text{Post-State} \longrightarrow \text{Financial Invariants} \longrightarrow \text{Decision}$$
*Show text: "The agent proposes the strategy. Sentinel enforces what the portfolio is allowed to become."*

**[SPOKEN SCRIPT]**:
> "Meet **Sentinel Robo**. 
> 
> Sentinel introduces **Authoritative Financial Postcondition Guarantees** directly at Solana's state-transition boundary.
> 
> The investor defines non-negotiable rules anchored in a Solana Policy PDA: maximum single-asset exposure, minimum stablecoin reserve floor, and maximum slippage. 
> 
> The AI agent can formulate any strategy it wants. But Sentinel evaluates the prospective post-trade portfolio *before* state commit. If a single rule is breached, the Solana Anchor program atomically reverts the transaction. Zero funds move."

---

### [0:40 – 1:50] THE LIVE DEMO: Flagship Aha Flow ($15k ➔ BLOCK ➔ $5k ➔ APPROVE)

**[VISUAL CUE]**:
*Switch to full-screen capture of the live web app at `http://localhost:3000`. Show the Hero Centerpiece: "What did the agent try to do?"*

**[SPOKEN SCRIPT]**:
> **[0:40]** *"Let's look at a live demonstration on Solana Devnet.*
> 
> Here is our starting portfolio: exactly \$100,000 NAV with 20% in Nvidia, 25% in Apple, and a 25% cash reserve. Our policy mandates: NVDA exposure must never exceed 25%, and cash reserve must never fall below 20%.*
> 
> **[0:55]** *Now, watch: Robo-01 spots a momentum surge on Nvidia and aggressively proposes: **BUY NVDAx \$15,000**.
> 
> Under normal wallet delegation, that trade executes blindly.*
> 
> **[1:05]** *Look at Sentinel. 
> Sentinel intercepts the intent, simulates the resulting state, and flags **three simultaneous mathematical violations**:
> 1. NVDA surges to 35% — exceeding our 25% cap.
> 2. Cash reserves drop to 10% — crashing through our 20% floor.
> 3. Sizing exceeds our \$10,000 order limit.
> 
> **[1:18]** *Sentinel executes an **Atomic Revert** on Solana. 
> 0 tokens transferred. 100% of capital protected.*
> 
> **[1:24]** *Now here is the second breakthrough: **Autonomous Reactive Adaptation**. 
> Instead of crashing, the agent reads Sentinel's invariant failure telemetry, calculates the exact mathematical headroom remaining — which is \$5,000 — and auto-adapts its intent.*
> 
> **[1:38]** *It resubmits: **BUY NVDAx \$5,000**. 
> Sentinel re-checks the postcondition: NVDA hits exactly 25.0%, cash stays at 20.0%. **APPROVED and SETTLED on Solana**.*
> 
> **[1:46]** *And PROVN seals an immutable two-tier cryptographic receipt with deterministic SHA-256 pre and post state roots."*

---

### [1:50 – 2:30] REAL SOLANA & SPONSOR VALUE: We Don't Blindly Trust

**[VISUAL CUE]**:
*Click on the "Case B: Market Trust" and "Case C: Data Trust" tabs in the UI. Highlight the Meteora DBC curve graphic, Pyth Hermès pull indicator, and PreStocks Vault badge.*

**[SPOKEN SCRIPT]**:
> **[1:50]** *"Why does Sentinel belong on Solana? 
> Not because of generic marketing speed. It's because our enforcement lives at the **financial state-transition boundary**. 
> The Policy PDA, the Vault, the Agent PDA, and the swap execution all live in the exact same atomic transaction runtime.*
> 
> **[2:04]** *And Sentinel proves that an institutional robo-manager cannot blindly trust three things:*
> 
> *First: **We don't blindly trust the AGENT** — our portfolio invariants catch rogue allocations.*
> 
> *Second: **We don't blindly trust the MARKET** — with our **Meteora Equity Market Guard**, when the agent proposes an \$8,000 trade into a shallow pool, Sentinel blocks it because DBC curve price impact exceeds 1.00%, then auto-adapts the trade along the curve to \$2,500.*
> 
> *Third: **We don't blindly trust the DATA** — with **Pyth Pro**, Pyth is an authoritative Security Input. If oracle quotes are stale or confidence intervals widen, Sentinel refuses execution before submission, pulling fresh truth on-demand via Hermès.*
> 
> *And with **PreStocks**, Sentinel enforces macro asset-class ceilings so private equity never exceeds 20%."*

---

### [2:30 – 3:00] VISION, TRACTION & CONCLUSION

**[VISUAL CUE]**:
*Founder back on camera or showing the Four Proof Layers graphic: Product ➔ Live Demo ➔ Protocol ➔ Evidence. Show live Solana Devnet Program ID link on screen.*

**[SPOKEN SCRIPT]**:
> **[2:30]** *"In the next five years, autonomous AI agents will manage hundreds of billions of dollars in tokenized real-world assets. 
> 
> But institutions, family offices, and retail investors cannot delegate capital without deterministic mathematical boundaries. 
> 
> Sentinel Finance provides those trust rails. 
> 
> Our Anchor program is deployed live on Solana Devnet today at `3gh1Cc2Q...`. We maintain 107 out of 107 verified passing automated tests, a zero-bloat modular monolith, and real cryptographic proofs.
> 
> Sentinel Finance: Safe autonomy for the tokenized economy. Thank you."*

---

## 📋 Speaker Checklist & Recording Tips

1. **Pacing**: Speak at an energetic, steady pace (~135–140 words per minute). 
2. **Numbers Matter**: Say the exact numbers clearly: *"Fifteen thousand dollars proposed... hits 35%... capped at 25%... auto-adapts to five thousand dollars."*
3. **No Fluff**: Avoid generic phrases like "web3 revolution" or "blockchain is the future". Focus on *state-transition boundaries, postconditions, and mathematical invariants*.
4. **Resolution**: Record screen capture at 1080p or 4K with clean dark-mode presentation. Ensure browser zoom is at 100% or 110% so text is crisp.
