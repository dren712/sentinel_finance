# 🎬 Sentinel Finance — Official 3-Minute Dual-Presenter Pitch & Demo Script

> **Presenters**: **Darshan** (Project Lead) & **Co-Founder** (Demo Driver / Technical Lead)  
> **Duration**: Exactly 3:00 (180 seconds)  
> **Tone**: Confident, institutional, mathematically rigorous, zero crypto fluff  
> **Pacing**: Steady, energetic (~140 words per minute • Total: ~430 words)  
> **Live App URL**: `http://localhost:3000` (Solana Devnet)

---

## ⏱️ Timeline & Role Handoff Breakdown

```
[0:00 - 0:35]  Darshan     │ Hook, Problem (The Delegation Dilemma) & The Solution Thesis
[0:35 - 1:30]  Co-Founder  │ Live Hero Demo: Rogue $15k Trade ➔ 3 Invariant Breaches ➔ Atomic Revert
[1:30 - 2:05]  Co-Founder  │ Autonomous Reactive Adaptation ($5k) ➔ Settlement ➔ Two-Tier PROVN Receipt
[2:05 - 2:35]  Darshan     │ Multi-Track Safety: Meteora DBC Market Guard, PreStocks & Pyth Security
[2:35 - 3:00]  Darshan     │ Sealevel Architecture Moat, Live Solana Devnet & Closing Vision
```

---

## 🎙️ Teleprompter Script with Live Screen Cues

---

### Segment 1: The Delegation Dilemma & The Sentinel Solution (0:00 – 0:35)

* **Speaker**: **Darshan**
* **Visual Cue**: Darshan on camera (or split-screen with the Sentinel Dashboard at `http://localhost:3000`).

**[Darshan speaks]**:
> "Hi everyone, I’m Darshan, lead of Sentinel Finance, and with me is my co-founder.
>
> Today, tokenized equities trade 24/7 on Solana. But delegating capital to an autonomous AI agent is a massive leap of faith.
>
> Standard Web3 wallet delegation only answers one question: *'Is the agent authorized to sign the transaction?'*
> 
> It never checks *what financial state results*. If an AI model hallucinates or catches bad data, it can drain stable reserves or dump 90% of your portfolio into a single volatile stock. Current agents are completely unconstrained.
>
> Sentinel Finance introduces **Authoritative On-Chain Financial Postcondition Guarantees**. 
>
> The investor defines non-negotiable rules in a Solana Policy PDA. The agent can formulate any strategy, but it is mathematically impossible for it to settle an outcome that violates those rules. 
>
> Let’s see this live on Solana Devnet." *(Handoff to Co-Founder)*

---

### Segment 2: The Live Rogue Trade & Atomic Revert (0:35 – 1:30)

* **Speaker**: **Co-Founder (Demo Driver)**
* **Visual Cue**: Full-screen capture of Sentinel Web UI. Mouse cursor active on the Hero Centerpiece card.
* **Screen Actions**:
  1. Cursor points to the live starting portfolio ($100k NAV: NVDAx 20%, AAPLx 25%, USDC 25%).
  2. Click the blue **`[ Replay Enforcement ]`** button (or header **`[ ▶ Flagship 5-Step Demo ]`**).
  3. Highlight the 3 red violation tags on screen.
  4. Step 3 flashes bright red: `[🚨 INVARIANT REVERT: ERR_INVARIANT_BREACH]`.

**[Co-Founder speaks]**:
> "Thanks Darshan. Here is our live portfolio on Solana Devnet: exactly $100,000 NAV, holding 20% in Nvidia, 25% in Apple, and a 25% cash reserve.
>
> Our anchored policy enforces four strict boundaries: Nvidia exposure cannot exceed 25%, cash reserves must stay above 20%, and single trade size cannot exceed $10,000.
>
> Now watch: Robo-01 spots a momentum signal and aggressively proposes: **BUY NVDAx for $15,000**.
>
> Under standard wallet delegation, that order executes blindly.
>
> Look at Sentinel. Before state commit, Sentinel simulates the prospective post-trade portfolio and catches **three simultaneous mathematical violations**:
> 
> First, NVDA surges to 35%—breaching our 25% ceiling.  
> Second, cash reserves drop to 10%—violating our 20% floor.  
> And third, order sizing exceeds our $10,000 limit.
>
> Sentinel’s Anchor program immediately triggers an **Atomic Invariant Revert** on Solana. 
> 
> Zero tokens move. Funds lost: exactly zero."

---

### Segment 3: Autonomous Adaptation & PROVN Audit Receipt (1:30 – 2:05)

* **Speaker**: **Co-Founder (Demo Driver)**
* **Visual Cue**: Watch the UI transition to Step 4 (Amber) ➔ Step 5 (Emerald) ➔ Click Activity row to open drawer.
* **Screen Actions**:
  1. Step 4 banner: `[⚡ ADAPTING PROPOSAL]` — agent reads telemetry and solves compliant size ($5,000).
  2. Step 5 banner: `[✅ SETTLED]` — state reflects NVDA at 25.0% and Cash at 20.0%.
  3. Scroll down to the Activity table, click the settled row.
  4. Expand the **Technical Evidence Drawer** to reveal SHA-256 state hashes and Solana Devnet explorer link.

**[Co-Founder speaks]**:
> "Now comes the real breakthrough: **Autonomous Reactive Adaptation**.
>
> The agent doesn’t crash or fail silently. It reads the on-chain rejection telemetry, calculates the exact remaining headroom—which is $5,000—and resubmits a resized, compliant intent: **BUY NVDAx $5,000**.
>
> Sentinel re-checks the postcondition: NVDA hits exactly 25.0%, cash stays at 20.0%. **Approved and settled on Solana**.
>
> Every action generates an immutable **PROVN cryptographic audit receipt**. 
> Investors see green compliance badges, and technical auditors can expand this technical drawer to verify deterministic SHA-256 pre-state and post-state roots, policy hashes, and Solana settlement signatures." *(Handoff back to Darshan)*

---

### Segment 4: Multi-Track Safety: Meteora, PreStocks & Pyth (2:05 – 2:35)

* **Speaker**: **Darshan**
* **Visual Cue**: Co-founder clicks scenario tabs in the UI (**Case B: Market Trust** and **PreStocks $10K**) while Darshan presents.
* **Screen Actions**:
  1. Click **`Case B: Market Trust (Meteora)`** ➔ Show DBC curve price impact 1.70% > 1.00% blocked, auto-adapted to $2,500 along curve.
  2. Click **`PreStocks ($10K)`** ➔ Show macro pre-IPO private equity cap (20%) preventing over-allocation into OpenAI.

**[Darshan speaks]**:
> "What makes Sentinel powerful is that we don’t blindly trust three critical layers:
>
> **First: We don’t blindly trust the agent**—our portfolio invariants catch rogue allocations.
>
> **Second: We don’t blindly trust the market**—with our **Meteora Equity Market Guard**, when the agent attempts an $8,000 buy into a shallow pool, Sentinel blocks it because DBC price impact hits 1.70%, then auto-adapts the trade along the curve to $2,500 where impact is only 0.45%.
>
> **Third: We don’t blindly trust asset classes or data**—with **PreStocks**, Sentinel enforces macro ceilings so private equity never exceeds 20%. And with **Pyth**, oracle quotes older than 60 seconds are refused as a core security check, pulling fresh truth via Hermès."

---

### Segment 5: Technical Moat, Solana Devnet & Vision (2:35 – 3:00)

* **Speaker**: **Darshan**
* **Visual Cue**: Co-founder briefly switches to the `AGENT` tab (showing 10-stage loop) and `PROTECTION` tab (showing DSL modal), then focuses on the live Devnet Program ID link.

**[Darshan speaks]**:
> "Sentinel is not an off-chain API filter. Our enforcement lives at the **financial state-transition boundary** inside Solana’s Sealevel runtime. The Policy PDA, the Vault, the Agent PDA, and trade settlement all execute in the exact same atomic transaction.
>
> We are live on Solana Devnet today at `3gh1Cc2Q...` backed by 107 out of 107 passing automated tests.
>
> As autonomous agents take over managing tokenized capital, Sentinel Finance provides the mathematical trust rails. 
>
> Thank you."

---

## 🛠️ Recording Day Checklist

1. **Local Dev Server**: Run `pnpm --filter @sentinel/web run dev` and ensure `http://localhost:3000` is active.
2. **Display Settings**: Set browser zoom to 100% or 110% at 1080p / 4K resolution. Use Dark Mode.
3. **Pristine State**: Refresh the page before recording so the portfolio starts at initial $100,000 NAV.
4. **Trigger Buttons**: Both the blue **`[ ▶ Flagship 5-Step Demo ]`** button in the header and the **`[ Replay Enforcement ]`** button in the Hero card trigger the identical 5-step flow.
5. **Handoff Timing**:
   - Darshan hands off at **0:35**: *"Let’s see this live on Solana Devnet."*
   - Co-founder hands off back at **2:05**: *"Darshan, over to you."*
