# Sentinel Finance — Judge Q&A Defense Matrix

This document provides concise, authoritative answers to the hardest technical and architectural questions judges and auditors ask about Sentinel Finance. Every claim maps directly to verified Devnet transactions and automated integration tests documented in [`docs/CLAIMS.md`](file:///Users/darshangaikwad/Desktop/stocklana/docs/CLAIMS.md).

---

### Q1: "Why isn't this just a multisig or pre-trade simulation?"

Multisigs require synchronous human approvals or off-chain co-signers that destroy autonomous execution velocity and leave windows open to market front-running and execution drift. Pre-trade simulation (`simulateTransaction`) is purely off-chain and advisory—it cannot prevent on-chain state changes between simulation and settlement. Sentinel implements an atomic on-chain postcondition firewall: the AI agent acts autonomously, but the Solana program deterministically verifies concentration, leverage, and drawdown bounds inside the transaction itself, reverting atomically if any invariant is breached. *(See `CLAIMS.md` §1 & §3)*.

---

### Q2: "Can a rogue agent bypass your caps by manipulating prices?"

No. In Phase 4, Sentinel removed all reliance on caller-supplied pricing: `execute_guarded_trade` reads verified Pyth Network `PriceUpdateV2` feed accounts directly on-chain. The program cryptographically validates feed IDs, enforces a 60-second freshness ceiling (`check_pyth_freshness`), bounds confidence intervals (`max_conf_bps`), and recalculates asset position valuations inside the SVM before checking policy limits. A rogue agent passing arbitrary prices fails on-chain with `PythPriceStale`, `PythConfidenceTooWide`, or `InvalidPythFeedId`. *(See `CLAIMS.md` §3 and Anchor integration tests in `tests/sentinel.ts`)*.

---

### Q3: "Are you doing real SPL token transfers?"

Sentinel distinguishes between two execution paths:
1. **Guarded Trade Execution**: The prototype enforces on-chain portfolio ledger state transitions (`PortfolioVault.usdc_balance_cents` and `AssetPosition[]`) directly on-chain without executing external DEX swaps. This is transparently labeled in the UI as `"LEDGER-ONLY SETTLEMENT — NO SPL TRANSFERS"`.
2. **Emergency Containment (`recover`)**: The emergency containment path executes a real, program-signed SPL Token & Token-2022 CPI `transfer_checked_signed` transferring excess volatile tokens from vault PDA custody directly to the owner's `safe_destination`.

---

### Q4: "What does 'recovery' mean in Sentinel?"

In Sentinel, recovery refers strictly to **vault-state recovery** and **asset containment**. It does not mean recovering lost capital or reversing market losses. When a supported policy breach occurs and is confirmed via Pyth oracle price checks, the vault is quarantined. The recovery operation transfers excess volatile tokens out of the strategy vault to the owner's safe destination and reactivates the vault to `Active` after on-chain postconditions pass.

---

### Q5: "Does Sentinel execute DEX trades or sell contained assets?"

No. The current prototype does not execute DEX swaps or market sales. The containment path transfers tokens directly to the owner's pre-approved destination (e.g. cold storage or multisig) to remove them from autonomous agent signing custody. Liquidating or hedging those tokens on an exchange is left to the vault owner.

---

### Q6: "Does containment reduce the owner's total market exposure?"

Not necessarily. Containment reduces the *vault's* exposure and deprives the autonomous agent of custody over those tokens. However, because the tokens are transferred to an owner-controlled destination, the owner's aggregate economic exposure remains unchanged unless the owner separately sells them.

---

### Q7: "Can someone front-run evidence or squat on promise accounts?"

No. The `RecordEvidence` instruction strictly constrains the agent signer to match the promise record (`promise.agent == agent.key()`), preventing unauthenticated third parties from recording evidence for another agent's promise. Furthermore, `record_evidence` verifies that `verification_result` matches `promise.status` (3 for settled, 4 for rejected) and computes SHA-256 state hashes on-chain. Any attempt to front-run, squat, or submit mismatched evidence reverts with `VerificationMismatch` or Anchor seed constraint errors. *(See `CLAIMS.md` §2 & `programs/sentinel/src/lib.rs`)*.

---

### Q8: "What happens if Pyth is stale or unavailable?"

Sentinel enforces a strict fail-closed security posture: any stale feed, missing account, or wide confidence interval causes an immediate transaction revert. Specifically, `parse_and_verify_pyth_price` checks the Pyth publish timestamp against the Solana Clock sysvar, reverting with `ErrorCode::StaleOracle` if older than 60 seconds, and `ErrorCode::ConfidenceTooWide` if uncertainty exceeds 200 bps tolerance. If Pyth data is unavailable, violation flagging and containment fail closed. *(See `CLAIMS.md` §3 & `programs/sentinel/src/lib.rs`)*.

---

### Q9: "How does this relate to Solana's Alpenglow upgrade?"

Sentinel is an application-layer risk engine and does not depend on Alpenglow today—it runs on the standard SVM transaction model on Devnet. However, Alpenglow's target of ~150 ms finality will make human-in-the-loop approvals impossible at high frequency, dramatically amplifying the blast radius of autonomous agent actions. Sentinel provides the deterministic, sub-second portfolio safety firewall required for autonomous agents to trade safely in the Alpenglow era. *(See `CLAIMS.md` §7 & `README.md`)*.
