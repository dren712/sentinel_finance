# Sentinel Finance — Architecture Specification

## 1. Executive Summary & Vision

**Sentinel Finance (Sentinel Robo)** is an autonomous robo-advisory and investment platform built on Solana for 24/7 trading of tokenized equities, pre-IPO shares, and index assets.

Sentinel solves the fundamental delegation problem in autonomous AI finance:
> **Traditional authorization tells an agent what instructions it can submit. Sentinel guarantees what financial state results.**

If an autonomous model hallucinates, suffers prompt injection, or drifts under market volatility, **Sentinel's on-chain postcondition enforcement layer authoritatively reverts the transaction before state commitment**, preventing capital loss.

---

## 2. Technical Truth & Deployment Status

```
[LIVE ON SOLANA DEVNET]
Program ID: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
IDL Account: H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6
Policy PDA:  3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh
Agent PDA:   62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ
Vault PDA:   7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y
Solana Explorer: https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet
```

### Definition of Truth Matrix

| Metric / Concept | Concrete Source of Truth | Verification Method | UI Badge / Representation |
| :--- | :--- | :--- | :--- |
| **Wallet Balance** | Solana SPL Token Account / System Account | Direct RPC account query via `@solana/web3.js` | `[DEVNET]` or `[SIMULATION]` |
| **Stock / Asset Price** | Pyth Network Price Feed (Dual-feed) | Pyth SDK deserialization + staleness & confidence bounds check | `[LIVE PYTH]` or `[SIMULATION PRICE]` |
| **Portfolio Allocation** | $\sum(\text{Balance} \times \text{Pyth Price})$ | Computed portfolio valuation engine (`SentinelValuationEngine`) | `[DERIVED METRIC]` |
| **Trade Approved / Rejected** | Sentinel Anchor `execute_guarded_trade` instruction | On-chain execution simulation or confirmed transaction signature | `[PROGRAM CONFIRMED]` |
| **Transaction Status** | Solana RPC Cluster | Block commitment level (`confirmed` / `finalized`) | `[TX PENDING/CONFIRMED/FAILED]` |
| **Venue Liquidity** | Meteora DBC / AMM Pool State | On-chain pool account reserves & invariant checks | `[LIVE VENUE]` or `[ADAPTER VERIFIED]` |
| **Financial Evidence** | PROVN Cryptographic Commitment | On-chain event log / Deterministic SHA-256 preimage | `[CRYPTOGRAPHIC PROOF]` |
| **Offline Test Scenarios** | Local deterministic scenario fixture | Evaluated in memory; badge clearly displayed | `[SIMULATION MODE]` |

---

## 3. Permanent Architectural Principles

1. **The Smallest Implementation Rule (Modular Monolith)**:
   - We avoid distributed infrastructure bloat (no external message queues, no separate microservices, no unnecessary databases).
   - Core domain verification, SDK orchestration, Anchor contracts, and Next.js frontend reside in a single high-cohesion TypeScript/Rust monorepo.
2. **The Anti-Churn Rule**:
   - Zero framework churn. Code stability, rigorous type-safety, and invariant math are prioritized over superficial library upgrades.
3. **Defense-in-Depth Postcondition Boundary**:
   - **Layer 1 (Client Pre-Flight)**: Instant feedback in the Next.js UI using in-browser domain rules.
   - **Layer 2 (SWARM-Lite Verifier Consensus)**: Independent verification engines (`RiskVerifier`, `BalanceVerifier`, `PriceIntegrityVerifier`, `LiquidityVerifier`, `PortfolioVerifier`, `PolicyVerifier`) producing cryptographic consensus.
   - **Layer 3 (On-Chain Solana Anchor Boundary)**: Authoritative `execute_guarded_trade` instruction executing exact `u128` integer math on `PortfolioVault` balances. Any invariant breach aborts the transaction atomically on Solana.
4. **Two-Tier Institutional PROVN Receipts**:
   - **Tier 1 (Investor View)**: Human-readable status badges ("✓ Protected on Solana", "Passed 4 / 4 Guarantees").
   - **Tier 2 (Forensic Auditor View)**: Cryptographic slide-over drawer displaying deterministic SHA-256 pre-state hash, post-state hash, trade intent hash, policy hash, Solana slot, and PDA addresses.

---

## 4. System Topology Diagram

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                    │
│  apps/web (Next.js 14, Tailwind, @solana/wallet-adapter-react, Lightweight Charts)│
│                                                                                   │
│   ┌───────────────┐   ┌───────────────┐   ┌────────────────┐   ┌──────────────┐   │
│   │ 1. PORTFOLIO  │   │   2. AGENT    │   │ 3. PROTECTION  │   │ 4. ACTIVITY  │   │
│   │ NAV & Assets  │   │  Robo-01 &    │   │ Boundaries &   │   │ Decisions &  │   │
│   │ 4/4 Health    │   │  10-Stage Loop│   │ PDA Guarantees │   │ PROVN Drawer │   │
│   └───────┬───────┘   └───────┬───────┘   └────────┬───────┘   └──────┬───────┘   │
└───────────┼───────────────────┼────────────────────┼──────────────────┼───────────┘
            │                   │                    │                  │
            ▼                   ▼                    ▼                  ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             SDK & ORCHESTRATION LAYER                             │
│  packages/sdk (SentinelClient, ExecutionAdapters, AutonomousRoboAgent)            │
│                                                                                   │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐   │
│  │ AutonomousRoboAgent   │   │ Decision Cycle        │   │ Execution Adapters │   │
│  │ • 10-Stage Loop       │──►│ • Pre-Flight Engine   │──►│ • Meteora DBC      │   │
│  │ • Ed25519 Signer      │   │ • Auto-Adaptation     │   │ • PreStocks Sec.   │   │
│  └───────────────────────┘   └───────────────────────┘   │ • SimulatedAdapter │   │
│                                                          └─────────┬──────────┘   │
└────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                     │
            ┌────────────────────────────────────────────────────────┘
            ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          DOMAIN & VERIFICATION LAYER                              │
│  packages/domain (PolicyEngine, SWARM-Lite Verifiers, PROVN Receipts)             │
│                                                                                   │
│  ┌──────────────────┐   ┌─────────────────────┐   ┌───────────────────────────┐   │
│  │ AssetRegistry    │   │ SWARM-Lite Engine   │   │ PROVN Evidence Receipts   │   │
│  │ • NVDAx, AAPLx   │   │ • RiskVerifier      │   │ • Canonical JSON Hashing  │   │
│  │ • SPYx, USDC     │   │ • BalanceVerifier   │   │ • Pre/Post SHA-256 Proofs │   │
│  │ • PreStocks Uni  │   │ • PriceIntegrity    │   │ • Two-Tier Drawer Output  │   │
│  └──────────────────┘   └─────────────────────┘   └───────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        ON-CHAIN ENFORCEMENT BOUNDARY                              │
│  programs/sentinel (Solana Anchor Program: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9k)│
│                                                                                   │
│   Account Context: execute_guarded_trade                                          │
│   1. [mut]     promise:   PromiseAccount PDA                                      │
│   2. [mut]     vault:     PortfolioVault PDA                                      │
│   3. [non-mut] agent:     AgentAccount PDA                                        │
│   4. [non-mut] policy:    PolicyAccount PDA                                       │
│   5. [signer]  authority: Signer (Agent Keypair or Owner)                         │
│                                                                                   │
│   Postcondition Checks (u128 Arithmetic):                                         │
│   ├── require!(target_exposure_bps <= policy.max_single_asset_bps)                │
│   ├── require!(reserve_exposure_bps >= policy.min_stablecoin_bps)                 │
│   ├── require!(trade_amount_cents <= policy.max_trade_value_usd * 100)            │
│   └── require!(slippage_bps <= policy.max_slippage_bps)                           │
│                                                                                   │
│   Result:                                                                         │
│   ├── PASS: Mutates vault ledger & records settlement                             │
│   └── FAIL: ATOMIC REVERT — 0 tokens transferred, 0 capital loss                  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. The Flagship 5-Step "Aha!" Demo Flow

```
1. Connect & Portfolio Overview
   - NAV: $124,382.18
   - Status: Active (4 / 4 Guarantees Healthy)
   - Holdings: NVDAx, AAPLx, SPYx, SPACEXx, USDC
   
2. Autonomous Agent Proposes Violating Trade
   - Agent observes momentum in NVDAx
   - Intent submitted: BUY NVDAx $15,000
   
3. Postcondition Rejection & Invariant Telemetry
   - Sentinel program evaluates prospective state:
     * NVDAx Exposure: 35.00% > 25.00% [REJECTED]
     * USDC Reserve:   10.00% < 20.00% [REJECTED]
     * Trade Sizing:  $15,000 > $10,000 [REJECTED]
   - Transaction aborts on-chain; 0 tokens move.
   
4. Autonomous Reactive Adaptation
   - Agent receives rejection telemetry and solves maximum compliant size:
     * max_compliant_size = $5,000
   - Intent re-submitted: BUY NVDAx $5,000
   
5. Settlement & Two-Tier PROVN Receipt
   - All 4 invariants pass (25.00% / 20.00% / $5,000 / 0.12%)
   - Trade settles; state commitments updated.
   - User sees: "✓ Protected on Solana"
   - Auditor opens technical drawer: SHA-256 commitments, slot, PDA, and failure-free verdict.
```

---

## 6. Package Layout & Responsibilities

| Package / Directory | Purpose | Verified Tests |
| :--- | :--- | :--- |
| `programs/sentinel` | Authoritative Anchor program with `u128` invariant checks and PDA state vaults. | 9 Rust integration tests |
| `packages/domain` | Pure TypeScript business logic: basis point math, 6-verifier SWARM, PROVN evidence receipts. | 39 unit tests |
| `packages/sdk` | Client SDK: `SentinelClient`, 10-stage autonomous reactive loop, Meteora & PreStocks adapters. | 55 unit & integration tests |
| `tests/integration` | End-to-end multi-step autonomous scenario test. | 1 integration test |
| `apps/web` | Institutional Next.js 14 Web Application (Portfolio, Agent, Protection, Activity). | Production build passing |
