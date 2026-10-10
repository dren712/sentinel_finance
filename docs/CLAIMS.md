# Sentinel Finance — Verifiable Fact & Claims Matrix

Every technical claim made by Sentinel Finance is mapped directly to an on-chain Solana Devnet transaction signature or an automated test in the repository. Unverified claims have been eliminated.

---

## 1. On-Chain Invariant Enforcement (Anchor Program)

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **Deterministic Reversion on Breach** | Solana Devnet Transaction | TX [`Yj4VQjWB...`](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet) | `programs/sentinel/src/lib.rs:250` |
| **Single-Asset Cap Breach (`ExposureExceeded` 6005)** | Anchor Localnet Test | Test 6 in `tests/sentinel-localnet.test.ts` | Error code `6005` asserted |
| **Cash Reserve Floor Breach (`StablecoinReserveBreached` 6006)** | Anchor Localnet Test | Test 7 in `tests/sentinel-localnet.test.ts` | Error code `6006` asserted |
| **Trade Size Cap Breach (`TradeSizeExceeded` 6000)** | Anchor Localnet Test | Test 8 in `tests/sentinel-localnet.test.ts` | Error code `6000` asserted |
| **Promise Expiry (`PromiseExpired` 6004)** | Anchor Localnet Test | Test 10 in `tests/sentinel-localnet.test.ts` | 5s TTL enforced; error `6004` |
| **Strict Cents Currency Units (`TradeAmountMismatch` 6009)** | Anchor Localnet Test | Test 2 in `tests/sentinel-localnet.test.ts` | Dollar vs cents rejection `6009` |
| **Emergency Pause (`AgentInactive` 6002)** | Anchor Localnet Test | Test 9 in `tests/sentinel-localnet.test.ts` | Kill-switch sets `is_active=false` |

---

## 2. On-Chain Pyth Oracle Integration

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **On-Chain Pyth Read (`PriceUpdateV2`)** | YES — Verified by 6 Anchor Localnet Tests | Tests 13, 14, 16, 17, 18, 19 in `tests/sentinel-localnet.test.ts`:<br>• `16. Phase A: price account owned by program -> UnverifiedPrice (6024)`<br>• `17. Phase A: price account with wrong feed_id -> FeedMismatch (6021)`<br>• `18. Phase A: price account with verification_level != Full -> UnverifiedPrice (6024)`<br>• `13. stale Pyth price (>60s) -> StaleOracle (6022)`<br>• `14. wide Pyth confidence (>2%) -> ConfidenceTooWide (6023)`<br>• `19. Phase A: valid Pyth fixture -> trade proceeds successfully` | `programs/sentinel/src/lib.rs:604-636` |
| **Stale Price Rejection (`StaleOracle` 6022)** | Anchor Localnet Test & Rust Test | Test 13 in `tests/sentinel-localnet.test.ts` | Quotes older than 60s fail closed |
| **Wide Confidence Bound (`ConfidenceTooWide` 6023)** | Anchor Localnet Test & Rust Test | Test 14 in `tests/sentinel-localnet.test.ts` | Confidence > 200 bps (2%) fails closed |
| **Oracle Benchmark Slippage (`SlippageExceeded` 6007)** | NOT ENFORCED until a realized-price check exists | After Phase A oracle hardening, execution price == benchmark == Pyth, so `check_benchmark_slippage` compares Pyth price to itself. Slippage protection is not enforced until a realized-price DEX swap receipt check exists. | `programs/sentinel/src/lib.rs:303` |
| **Anti-Price-Deflation Protection** | Anchor Localnet Test & Rust Test | Test 1 in `tests/sentinel-localnet.test.ts` | Target position stored price protected against artificial devaluation |

---

## 3. Key Separation & Security Domain

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **Owner vs Agent Key Partition** | SDK Suite (`packages/sdk/tests/split-keys.test.ts`) | Tests 1–4 pass (`pnpm -r test`) | `packages/sdk/src/split-keys.ts` |
| **Unauthorized Sync Vault Fails** | Anchor Localnet Test | Test 11 in `tests/sentinel-localnet.test.ts` | Non-owner cannot mutate vault balances |
| **Foreign Agent Account Rejection (`UnauthorizedAgent` 6010)** | Anchor Localnet Test | Test 3 in `tests/sentinel-localnet.test.ts` | Evidence PDA requires `promise.agent == agent` |
| **Evidence Lifecycle Binding (`InvalidPromiseStatus` 6012)** | Anchor Localnet Test | Tests 4 & 5 in `tests/sentinel-localnet.test.ts` | `verification_result == promise.status` strictly required |

---

## 4. Ledger-Only Settlement & Evidence Anchoring

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **On-Chain State Transition** | Solana Devnet Transaction | TX [`424aJbYW...`](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet) | Vault balances updated on-chain |
| **Ledger-Only Settlement Transparency** | UI & Documentation Notice | "LEDGER-ONLY SETTLEMENT -- NO SPL TRANSFERS" | `README.md`, `TECHNICAL.md`, `DEMO.md`, `AgentView.tsx` |
| **Evidence PDA Root Anchoring** | Solana Devnet Transaction | TX [`hZFTL14Y...`](https://explorer.solana.com/tx/hZFTL14Y17EQx44JskkbPMXEivsSWLDsaUfDtC6cAnmFAo84guhBLQ1ap2VV9ZQXbX334PdYiWfLmXxKjH1MNoF?cluster=devnet) | 32-byte SHA-256 evidence anchored |
| **Happy Path Settlement Balance Update** | Anchor Localnet Test | Test 12 in `tests/sentinel-localnet.test.ts` | USDC deducted, token units incremented, benchmark preserved |

---

## 5. Autonomous Adaptation & Real LLM Connector

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **10-Stage Autonomous Adaptation Loop** | SDK Automated Test Suite | P10 & P11 tests in `packages/sdk/tests/sdk.test.ts` | Resizes $15,000 proposal to $5,000 compliant headroom |
| **OpenAI GPT-4o Tool Dispatcher** | SDK Test & Provider Abstraction | 6 sandboxed tools (`getPortfolio`, `getPolicy`, `getMarketPrice`, etc.) | `packages/sdk/src/llm-provider.ts:59-130` |
| **Deterministic Fallback & Banner** | Next.js Web Application Component | Displays "DEMO MODE: Using scripted agent proposals" when `OPENAI_API_KEY` is unset | `apps/web/src/components/AgentView.tsx` |
| **Raw Prompt & Response Inspection** | Web UI Expandable Connector | Tabbed viewer rendering raw prompt context and structured LLM responses | `apps/web/src/components/AgentView.tsx` |

---

## 6. Quarantine State Machine (Phase B)

*Scope Notice: MVP scope covers vaults holding ONE volatile asset + USDC.*

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **No Violation Clean State (`NoViolation` 6027)** | Bankrun Test (Slot-Warped) | Test 1 in `tests/bankrun-quarantine.test.ts` (`1. no violation, pending == 0 -> NoViolation (6027)`) | `programs/sentinel/src/lib.rs:550` |
| **First Violation Sets Pending (`ViolationPendingEvent`)** | Bankrun Test & Devnet TX | Test 2 in `tests/bankrun-quarantine.test.ts` & Devnet TX [`5TKzuF21...`](https://explorer.solana.com/tx/5TKzuF21Xn388WzuUso1sncDVmL2EyydqPae126LKrTNNtbWHVtTHmvhjDX5gTXdQfxCkZ3kxKricD2JNWaG8SPV?cluster=devnet) | `programs/sentinel/src/lib.rs:555-561` |
| **Hysteresis Enforcement (`ViolationNotConfirmed` 6028)** | Bankrun Test (Slot-Warped) | Test 3 in `tests/bankrun-quarantine.test.ts` (`3. second flag before confirm_slots -> ViolationNotConfirmed (6028)`) | `programs/sentinel/src/lib.rs:563-566` |
| **Quarantine Transition After Hysteresis (`VaultQuarantinedEvent`)** | Bankrun Test & Devnet TX | Test 4 in `tests/bankrun-quarantine.test.ts` & Devnet TX [`5ATh9Gpt...`](https://explorer.solana.com/tx/5ATh9GptcACZArsiq2ELbBvG3KKmAwtEHWyDVYFNvRhzSixLhYSuNbkuMHGsqNpEUHzZog4NbM6KvWsypjoyzTdK?cluster=devnet) | `programs/sentinel/src/lib.rs:567-584` |
| **Price Recovery Clears Pending (`ViolationClearedEvent`)** | Bankrun Test (Slot-Warped) | Test 5 in `tests/bankrun-quarantine.test.ts` (`5. price recovers before confirm, flag called -> pending cleared`) | `programs/sentinel/src/lib.rs:545-549` |
| **Trade Execution Gated When Quarantined (`VaultNotActive` 6025)** | Bankrun Test | Test 6 in `tests/bankrun-quarantine.test.ts` (`6. execute_guarded_trade while Quarantined -> VaultNotActive (6025)`) | `programs/sentinel/src/lib.rs:324` |
| **Promise Creation Gated When Quarantined (`VaultNotActive` 6025)** | Bankrun Test | Test 7 in `tests/bankrun-quarantine.test.ts` (`7. create_promise while Quarantined -> VaultNotActive (6025)`) | `programs/sentinel/src/lib.rs:260` |
| **Unauthorized Owner Release Fails (`ConstraintHasOne` 2001)** | Bankrun Test | Test 8 in `tests/bankrun-quarantine.test.ts` (`8. owner_release by non-owner -> fails; by owner -> Active`) | `programs/sentinel/src/lib.rs:1074` |
| **Owner Release Restores Active Status (`VaultReleasedEvent`)** | Bankrun Test & Devnet TX | Test 8 in `tests/bankrun-quarantine.test.ts` & Devnet TX [`2tQQYGDp...`](https://explorer.solana.com/tx/2tQQYGDpnBqttytdnYQ9JoFsVZMAbi2bLvgyKzamYUgE7oYha7PP9Cf59uTiEYxQ73Mxg5rbZtwCELqYzurktEZd?cluster=devnet) | `programs/sentinel/src/lib.rs:589-601` |
| **Early Expiration Rejection (`RecoveryNotExpired` 6029)** | Bankrun Test (Slot-Warped) | Test 9 in `tests/bankrun-quarantine.test.ts` (`9. expire_quarantine before expiry -> rejected (6029)`) | `programs/sentinel/src/lib.rs:608` |
| **Recovery Expiration After Window (`QuarantineExpiredEvent`)** | Bankrun Test (Slot-Warped) | Test 9 in `tests/bankrun-quarantine.test.ts` (`9. expire_quarantine after expiry -> RecoveryExpired (6029)`) | `programs/sentinel/src/lib.rs:610-621` |
| **Forged Price Account Rejected (`UnverifiedPrice` 6024)** | Bankrun Test | Test 10 in `tests/bankrun-quarantine.test.ts` (`10. flag_violation with forged price account -> UnverifiedPrice (6024)`) | `programs/sentinel/src/lib.rs:732` |
| **Stale Price Feed Rejected (`StaleOracle` 6022)** | Bankrun Test | Test 11 in `tests/bankrun-quarantine.test.ts` (`11. flag_violation with stale price -> StaleOracle (6022)`) | `programs/sentinel/src/lib.rs:719` |
| **Wide Confidence Feed Rejected (`ConfidenceTooWide` 6023)** | Bankrun Test | Test 11 in `tests/bankrun-quarantine.test.ts` (`11. flag_violation with wide conf -> ConfidenceTooWide (6023)`) | `programs/sentinel/src/lib.rs:734` |
| **Arbitrary Watcher Signer Permissionless Flag** | Bankrun Test & Devnet TX | Test 12 in `tests/bankrun-quarantine.test.ts` & Devnet TX [`5TKzuF21...`](https://explorer.solana.com/tx/5TKzuF21Xn388WzuUso1sncDVmL2EyydqPae126LKrTNNtbWHVtTHmvhjDX5gTXdQfxCkZ3kxKricD2JNWaG8SPV?cluster=devnet) | `programs/sentinel/src/lib.rs:528` |
| **Redundant Flag on Quarantined Vault Rejected (`VaultNotActive` 6025)** | Bankrun Test | Test 13 in `tests/bankrun-quarantine.test.ts` (`13. vault already Quarantined, flag called -> VaultNotActive (6025)`) | `programs/sentinel/src/lib.rs:536` |

---

## 7. Permissionless Solver Recovery (Phase C)

*Scope Notice: MVP scope covers vaults holding ONE volatile asset + USDC.*

| Claim | Verification Method | Proof / Identifier | Source Reference |
| :--- | :--- | :--- | :--- |
| **Happy Path Recovery: Quarantined ➔ Active** | Bankrun Test & Devnet TX | Test 1 in `tests/bankrun-recovery.test.ts` & Devnet TX [`2zUD46Fq...`](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) | `programs/sentinel/src/lib.rs:638-751` |
| **Recovery while Active Rejected (`VaultNotQuarantined` 6025)** | Bankrun Test | Test 2 in `tests/bankrun-recovery.test.ts` (`2. recover while Active -> VaultNotQuarantined`) | `programs/sentinel/src/lib.rs:647` |
| **Recovery After Window Closed Rejected (`RecoveryWindowClosed` 6030)** | Bankrun Test (Slot-Warped) | Test 3 in `tests/bankrun-recovery.test.ts` (`3. recover after window -> RecoveryWindowClosed`) | `programs/sentinel/src/lib.rs:651` |
| **Stale Recovery Nonce Rejected (`StaleRecoveryNonce` 6031)** | Bankrun Test | Test 4 in `tests/bankrun-recovery.test.ts` (`4. wrong expected_nonce -> StaleRecoveryNonce`) | `programs/sentinel/src/lib.rs:658` |
| **Owner Release Invalidates In-Flight Nonce (`StaleRecoveryNonce` 6031)** | Bankrun Test | Test 5 in `tests/bankrun-recovery.test.ts` (`5. owner_release between flag and recover -> StaleRecoveryNonce`) | `programs/sentinel/src/lib.rs:600, 658` |
| **Replay Protection on Successful Recovery** | Bankrun Test | Test 6 in `tests/bankrun-recovery.test.ts` (`6. replay identical successful tx -> fails`) | `programs/sentinel/src/lib.rs:647, 658` |
| **Undersell Violation Rejection (`PostconditionFailed` 6033)** | Bankrun Test | Test 7 in `tests/bankrun-recovery.test.ts` (`7. sell too little -> PostconditionFailed`) | `programs/sentinel/src/lib.rs:709` |
| **Oversell Guard Rejection (`OversellGuard` 6034)** | Bankrun Test | Test 8 in `tests/bankrun-recovery.test.ts` (`8. sell entire position -> OversellGuard`) | `programs/sentinel/src/lib.rs:720` |
| **Zero or Excessive Units Rejection (`InvalidAmount` 6035)** | Bankrun Test | Test 9 in `tests/bankrun-recovery.test.ts` (`9. sell_units = 0 and sell_units > holdings -> InvalidAmount`) | `programs/sentinel/src/lib.rs:674` |
| **Forged Price Account Rejected (`UnverifiedPrice` 6024)** | Bankrun Test | Test 10 in `tests/bankrun-recovery.test.ts` (`10. forged price account -> UnverifiedPrice`) | `programs/sentinel/src/lib.rs:936` |
| **Feed ID Mismatch Rejected (`FeedMismatch` 6021)** | Bankrun Test | Test 11 in `tests/bankrun-recovery.test.ts` (`11. wrong feed_id -> FeedMismatch`) | `programs/sentinel/src/lib.rs:951` |
| **Stale Price Feed Rejected (`StaleOracle` 6022)** | Bankrun Test | Test 12 in `tests/bankrun-recovery.test.ts` (`12. stale price -> StaleOracle`) | `programs/sentinel/src/lib.rs:884` |
| **Missing Custody Accounts Rejected (`MissingCustodyAccounts` 6045)** | Bankrun Test | Test 13 in `tests/bankrun-recovery.test.ts` (`13. missing custody accounts -> MissingCustodyAccounts (6045)`) | `programs/sentinel/src/lib.rs:688` |
| **Two Solvers Race: First Wins, Second Fails** | Bankrun Test | Test 14 in `tests/bankrun-recovery.test.ts` (`14. two solvers race: first succeeds, second fails`) | Atomic status transition & nonce |
| **Permissionless Solver Execution** | Bankrun Test & Devnet TX | Test 15 in `tests/bankrun-recovery.test.ts` & Devnet TX [`2zUD46Fq...`](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) | Solver wallet `6H5nrFrv...` |
| **Vault Account Immutability** | Bankrun Test | Test 16 in `tests/bankrun-recovery.test.ts` (`16. recover cannot change policy, owner, or any other vault`) | Policy and owner accounts unchanged |
| **Full Lifecycle: Active ➔ Quarantined ➔ Recovered ➔ Trade Resumes** | Bankrun Test | Test 17 in `tests/bankrun-recovery.test.ts` (`17. full lifecycle: Active -> flag -> quarantine -> recover -> Active -> trade works again`) | Agent authority restored post-recovery |
| **Policy Frozen During Recovery (`PolicyFrozenDuringRecovery` 6036)** | Bankrun Test | Test 18 in `tests/bankrun-recovery.test.ts` (`18. policy mutation during quarantine -> PolicyFrozenDuringRecovery`) | `programs/sentinel/src/lib.rs:651` |
| **Inactive Policy Blocks Recovery (`PolicyInactive` 6004)** | Bankrun Test | Test 19 in `tests/bankrun-recovery.test.ts` (`19. inactive policy blocks recovery -> PolicyInactive`) | `programs/sentinel/src/lib.rs:647` |
| **Multi-Position Rejection (`InvalidVolatileAssetConfiguration` 6037)** | Bankrun Test | Test 20 in `tests/bankrun-recovery.test.ts` (`20. multiple volatile positions in sync_vault -> InvalidVolatileAssetConfiguration`) | `programs/sentinel/src/lib.rs:175, 665` |
| **Malformed State Rejection (`MathOverflow` 6008)** | Bankrun Test | Test 21 in `tests/bankrun-recovery.test.ts` (`21. malformed state total_cents = 0 -> MathOverflow`) | `programs/sentinel/src/lib.rs:776` |
| **Real SPL Token Custody (`owner_deposit` & `owner_withdraw`)** | Bankrun Test | Test 22 in `tests/bankrun-recovery.test.ts` (`22. owner_deposit and owner_withdraw transfer real SPL tokens`) | `programs/sentinel/src/custody.rs` |
| **Real SPL Containment Transfer to `safe_destination` via CPI** | Bankrun Test | Test 23 in `tests/bankrun-recovery.test.ts` (`23. real containment recovery executes CPI TransferChecked to safe_destination`) | `programs/sentinel/src/lib.rs:729` |
| **Unauthorized Token Destination Rejected (`DestinationNotSafe` 6041)** | Bankrun Test | Test 24 in `tests/bankrun-recovery.test.ts` (`24. recovery to unauthorized token account -> DestinationNotSafe`) | `programs/sentinel/src/lib.rs:706` |
| **Token Mint Mismatch Rejected (`TokenMintMismatch` 6042)** | Bankrun Test | Test 25 in `tests/bankrun-recovery.test.ts` (`25. token mint mismatch in remaining accounts -> TokenMintMismatch`) | `programs/sentinel/src/lib.rs:700` |
| **Insufficient Sell Amount Postcondition (`PostconditionFailed` 6001)** | Bankrun Test | Test 26 in `tests/bankrun-recovery.test.ts` (`26. insufficient token sell amount -> PostconditionFailed`) | `programs/sentinel/src/lib.rs:797` |
| **Recovery Solver Bounty (`bounty_cap_cents`)** | INFORMATIONAL / NOT PAID On-Chain | Emitted in `RecoveryExecutedEvent` as informational metric (0 in current containment implementation); no SPL disbursement occurs | `programs/sentinel/src/lib.rs:834` |
| **Bounded Containment Scope** | Architectural Boundary | `recover()` executes SPL token transfer out of strategy vault to `safe_destination`; does NOT execute DEX swaps or reverse losses | `docs/POSITIONING.md` |


