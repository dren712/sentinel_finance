# Sentinel Finance — Architecture Specification

## 1. Executive Summary & Vision

**Sentinel Finance (Sentinel Robo)** is an autonomous robo-advisory and investment platform built on Solana for 24/7 trading of tokenized equities, pre-IPO shares, and index assets.

Sentinel solves the fundamental delegation problem in autonomous AI finance:
> **Traditional authorization tells an agent what instructions it can submit. Sentinel guarantees what financial state results.**

If an autonomous model hallucinates, suffers prompt injection, or drifts under market stress, **Sentinel's on-chain postcondition enforcement layer (PTA) authoritatively reverts the transaction before state commitment**, preventing capital loss.

---

## 2. System Topology & Component Diagram

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                    │
│  apps/web (Next.js 14, Tailwind, @solana/wallet-adapter-react, Lightweight Charts)│
│                                                                                   │
│   ┌───────────────┐   ┌───────────────┐   ┌────────────────┐   ┌──────────────┐   │
│   │ 1. PORTFOLIO  │   │   2. AGENT    │   │ 3. PROTECTION  │   │ 4. ACTIVITY  │   │
│   │ NAV & Assets  │   │  Robo-01 &    │   │ Your & Sentinel│   │ Decisions &  │   │
│   │ 4/4 Health    │   │  Pre-Flight   │   │   Guarantees   │   │ PROVN Proofs │   │
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
│  │ • ClawPump Keypair    │──►│ • Pre-Flight Engine   │──►│ • SimulatedAdapter │   │
│  │ • Ed25519 Signer      │   │ • Auto-Adaptation     │   │ • LiveExecution    │   │
│  └───────────────────────┘   └───────────────────────┘   └─────────┬──────────┘   │
└────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                     │
            ┌────────────────────────────────────────────────────────┘
            ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                          DOMAIN & VERIFICATION LAYER                              │
│  packages/domain (PolicyEngine, SwarmVerifiers, PROVN Evidence, AssetRegistry)   │
│                                                                                   │
│  ┌──────────────────┐   ┌─────────────────────┐   ┌───────────────────────────┐   │
│  │ AssetRegistry    │   │ SWARM-Lite Verifiers│   │ PROVN Commitments         │   │
│  │ • NVDAx, AAPLx   │   │ • RiskVerifier      │   │ • Canonical JSON Hashing  │   │
│  │ • SPYx, USDC     │   │ • BalanceVerifier   │   │ • Pre/Post State SHA-256  │   │
│  │ • PreStocks Uni  │   │ • PolicyVerifier    │   │ • Verifier Consensus      │   │
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

## 3. Core Architectural Principles

1. **Defense-in-Depth Enforcement**:
   - **Layer 1 (Off-Chain Client Pre-Flight)**: Computes prospective portfolio state in the UI to give instant user feedback before signing.
   - **Layer 2 (Off-Chain SWARM-Lite Consensus)**: Multi-verifier independent evaluation (`RiskVerifier`, `BalanceVerifier`, `PolicyVerifier`) producing cryptographically bound verdicts.
   - **Layer 3 (On-Chain Anchor Transaction Boundary)**: The authoritative on-chain program checks exact `u128` integer postconditions on the real `PortfolioVault` balance. If violated, the instruction fails with a typed error and the transaction reverts atomically.

2. **Zero Fabricated Transactions**:
   - Simulation mode is explicitly labeled as `SIMULATION`, with simulated signatures prefix-coded `sim_tx_`.
   - Live mode requires real keypairs, queries live blockhashes, passes all 5 Anchor accounts, and confirms on Solana RPC.

3. **Deterministic Canonical State Representation**:
   - All portfolio state snapshots, trade intents, and financial policies are serialized via deterministic key-sorted JSON before SHA-256 hashing.
   - Pre-state and post-state commitments form an immutable, auditable PROVN trail.

---

## 4. Package Structure & Responsibilities

| Package / Directory | Purpose | Dependencies |
| :--- | :--- | :--- |
| `programs/sentinel` | Authoritative Solana Anchor program holding vaults, policies, promises, and evidence. | Anchor 0.30.1, Solana Program SDK |
| `packages/domain` | Pure TypeScript business logic: invariants, policy engine, SWARM-Lite verifiers, PROVN commitments, Asset Registry, Price Providers. | Zero runtime dependencies (Node `crypto` only) |
| `packages/sdk` | High-level client SDK: `SentinelClient`, `AutonomousRoboAgent`, `SimulatedExecutionAdapter`, `LiveExecutionAdapter`. | `@sentinel/domain`, `@solana/web3.js`, `@solana/spl-token`, `tweetnacl` |
| `apps/web` | Institutional Next.js 14 Web Application structured into the 4 Pillars (Portfolio, Agent, Protection, Activity). | `@sentinel/domain`, `@sentinel/sdk`, Tailwind CSS, `lightweight-charts`, Solana Wallet Adapter |
| `docs/` | Authoritative frozen architecture, security, execution, data model, sponsor matrix, and demo documentation. | Markdown |

---

## 5. Security & Trust Boundaries

```text
┌───────────────────────────┐      ┌───────────────────────────┐
│     Autonomous Agent      │      │    Owner / Investor       │
│  (ClawPump Keypair Wallet)│      │  (Hardware / Web3 Wallet) │
└─────────────┬─────────────┘      └─────────────┬─────────────┘
              │ Can only submit                  │ Sets & updates
              │ bounded trade intents            │ PolicyAccount
              ▼                                  ▼
      ┌──────────────────────────────────────────────────┐
      │           Solana On-Chain Anchor Program         │
      │   Enforces PolicyAccount on all State Transitions│
      └──────────────────────────────────────────────────┘
```

- **Owner Authority**: Only the owner wallet can create or mutate `PolicyAccount` and initialize `PortfolioVault`.
- **Agent Authority**: The agent holds an operational keypair authorized only to propose trades into `PromiseAccount` and invoke `execute_guarded_trade`. It cannot withdraw liquidity or loosen policy parameters.
- **Atomic Reversibility**: Solana guarantees that if an Anchor instruction returns an `Err(SentinelError::...)`, the runtime discards all state changes in that transaction.
