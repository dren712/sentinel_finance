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

Sentinel enforces internal portfolio ledger state transitions (`PortfolioVault.usdc_balance_cents` and `AssetPosition[]`) directly on-chain without executing CPIs to the SPL Token Program on Devnet. This architecture was chosen deliberately to isolate and formally prove atomic postconditions, benchmark slippage checks, and cryptographic receipts without dependency on illiquid Devnet token pools. We label this transparently throughout the UI with persistent `"LEDGER-ONLY SETTLEMENT — NO SPL TRANSFERS"` badges, and document the production CPI token vault adapter in `docs/ARCHITECTURE.md`. *(See `CLAIMS.md` §4)*.

---

### Q4: "Can someone front-run evidence or squat on promise accounts?"

No. The `RecordEvidence` instruction strictly constrains the agent signer to match the promise record (`promise.agent == agent.key()`), preventing unauthenticated third parties from recording evidence for another agent's promise. Furthermore, `record_evidence` verifies that `verification_result` matches `promise.status` (3 for settled, 4 for rejected) and computes SHA-256 state hashes on-chain. Any attempt to front-run, squat, or submit mismatched evidence reverts with `VerificationMismatch` or Anchor seed constraint errors. *(See `CLAIMS.md` §2 & `programs/sentinel/src/lib.rs`)*.

---

### Q5: "What happens if Pyth is stale or unavailable?"

Sentinel enforces a strict fail-closed security posture: any stale feed, missing account, or wide confidence interval causes an immediate transaction revert. Specifically, `check_pyth_freshness` checks the Pyth publish timestamp against the Solana Clock sysvar, reverting with `ErrorCode::PythPriceStale` if older than 60 seconds, and `ErrorCode::PythConfidenceTooWide` if uncertainty exceeds tolerance. If the off-chain Pyth Hermes oracle is unreachable, the off-chain guard rejects trade dispatch and logs an on-chain `reject_promise` transaction with failure evidence. *(See `CLAIMS.md` §3 & `scripts/preflight.mjs`)*.

---

### Q6: "How does this relate to Solana's Alpenglow upgrade?"

Sentinel is an application-layer postcondition engine and does not depend on Alpenglow today—it runs on the standard SVM transaction model on Devnet. However, Alpenglow's target of ~150 ms finality will make human-in-the-loop approvals impossible at high frequency, dramatically amplifying the blast radius of rogue agent actions. Sentinel provides the deterministic, sub-second portfolio safety firewall required for autonomous agents to trade safely in the Alpenglow era. *(See `CLAIMS.md` §7 & `README.md`)*.
