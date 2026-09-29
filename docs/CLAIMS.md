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
| **On-Chain Pyth Read (`PriceUpdateV2`)** | Anchor Program + Devnet/Localnet Account | Program verifies feed ID, timestamp, and confidence bound | `programs/sentinel/src/lib.rs:572-620` |
| **Stale Price Rejection (`StaleOraclePrice` 6019)** | Anchor Localnet Test & Rust Test | Test 13 in `tests/sentinel-localnet.test.ts` | Quotes older than 60s fail closed |
| **Wide Confidence Bound (`WideConfidenceInterval` 6020)** | Anchor Localnet Test & Rust Test | Test 14 in `tests/sentinel-localnet.test.ts` | Confidence > 200 bps (2%) fails closed |
| **Oracle Benchmark Slippage (`SlippageExceeded` 6007)** | Anchor Localnet Test & Rust Test | Test 15 in `tests/sentinel-localnet.test.ts` | Untrusted caller quote ignored; benchmark read from Pyth |
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
