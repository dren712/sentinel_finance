# Sentinel Finance — 75-Second Single-Take Demo Script

**Total Runtime**: 75 seconds  
**Objective**: Demonstrate that Sentinel doesn't blindly trust the agent, the data, or the market, showing an atomic on-chain rejection, autonomous adaptation, and cryptographic settlement.

---

### [00:00 – 00:15] The Thesis: Outcome-Bounded Execution
- **Visual**: Start on `Overview` tab of the live Railway deployment (`https://sentinel-finance-production-4560.up.railway.app/`). Mouse hovers over the active portfolio and 4 invariant dials.
- **Spoken**:
  > "As AI agents gain financial autonomy on Solana, smart contracts can no longer trust agent prompts or off-chain decisions. Sentinel introduces outcome-bounded execution: the agent proposes trades, but our on-chain Anchor program deterministically bounds what the portfolio can become."

---

### [00:15 – 00:35] The Breach: Atomic On-Chain Interception
- **Visual**: Click to `Agent` tab. Point to the active Policy bounds (Max Stock 25%, Min Cash 20%, Max Order $10K). Click **"Run Autonomous Cycle"**.
- **Spoken**:
  > "Watch Robo-01 spot momentum and propose an aggressive order: BUY NVDAx fifteen thousand dollars. But Sentinel projects the post-state before execution: NVDA would surge to thirty-five percent, and cash would drain below twenty percent. Sentinel's Anchor program atomically reverts the trade on Solana Devnet. Zero tokens moved. Zero capital lost."

---

### [00:35 – 00:55] Autonomous Adaptation & Settlement
- **Visual**: Watch pipeline transition from `03 BLOCK` to `04 ADAPT` and then `05 SETTLE`. Point to the resized `$5,000` order and the Devnet transaction link.
- **Spoken**:
  > "Instead of crashing, the agent reads Sentinel's structured on-chain rejection telemetry, calculates exact compliant headroom, and adapts the order down to five thousand dollars. This time, all four postconditions pass: NVDA stays at twenty-five percent, cash stays at twenty percent. The transaction settles authoritatively on Solana Devnet."

---

### [00:55 – 01:15] Verification: Cryptographic Proof & Pyth Market Truth
- **Visual**: Scroll down to inspect the PROVN receipt with SHA-256 state roots. Click open the **LLM Intelligence Connector** to show the Raw Prompt, Raw Response, and "LEDGER-ONLY SETTLEMENT" badge.
- **Spoken**:
  > "Every outcome produces a deterministic SHA-256 cryptographic receipt. Sentinel reads Pyth Hermès sub-second oracle feeds on-chain, rejecting stale data and wide confidence intervals. And our ledger-only settlement architecture ensures transparent, auditable portfolio accounting."

---

### [01:15 – 01:25] Conclusion & Future
- **Visual**: Click `Activity` tab to show the permanent event timeline. Return to header.
- **Spoken**:
  > "Sentinel turns unconstrained agent speculation into deterministic institutional-grade investing. Built today on Solana Devnet, and ready for Solana's next sub-second Alpenglow consensus era. Thank you."
