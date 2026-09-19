# Sentinel Finance (Sentinel Robo) — Stocklana Hackathon Submission

## 1. Project Overview & Meta Information

- **Project Name**: Sentinel Finance (Sentinel Robo)
- **Tagline**: Autonomous Robo-Portfolio for Tokenized Equities on Solana with Authoritative On-Chain Financial Postcondition Guarantees.
- **Submission Track**: **Investing → Robo-Portfolios ($100,000 Main Track)**
- **Target Sponsor Bounties**:
  1. **Pyth Network (Pyth Pro)**: Dual-feed oracle mark-to-market pricing, staleness protection, confidence intervals ($\pm \sigma$), and tracking error checks.
  2. **PreStocks ($10,000 Bounty)**: Pre-IPO private equity universe (`SPACEXx`, `OPENAIx`, `STRIPEx`), Portfolio Builder, and macro asset class allocation limits (`Pre-IPO ≤ 20%`).
  3. **Meteora ($5,000 Bounty)**: Dynamic Bonding Curve (DBC) liquidity verifier ($25k reserve floor, $\le 200\text{ bps}$ price divergence), dynamic fees, and bidirectional market protection.
- **GitHub Repository**: [https://github.com/dren712/sentinel_finance](https://github.com/dren712/sentinel_finance)
- **Live Solana Devnet Program ID**: [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet)
- **On-Chain IDL Account**: [`H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6`](https://explorer.solana.com/address/H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6?cluster=devnet)

---

## 2. Executive Elevator Pitch

> *"Tokenized stocks already trade 24/7 on Solana. But delegating capital to an autonomous AI agent has always been a dangerous leap of faith: traditional Web3 authorization only checks if an agent has permission to call an instruction, not what financial state results. If the AI model drifts or hallucinates, it can dump your reserves or over-concentrate 90% of your capital into a single equity.*
> 
> *Sentinel Finance introduces **authoritative postcondition guarantees at the state-transition boundary**: the agent can propose any strategy, but the Solana runtime atomically reverts any trade that breaches the user's financial policy (e.g. max single-asset exposure ≤ 25%, min cash reserve ≥ 20%). Combined with autonomous reactive adaptation and two-tier PROVN cryptographic receipts, Sentinel makes AI portfolio management institutional-grade on Solana."*

---

## 3. The Flagship 5-Step "Aha!" Demo Moment

1. **Portfolio Inspection**: User views a diversified portfolio ($124k+ NAV) with `4 / 4 Guarantees Healthy`.
2. **Rogue AI Trade Intent**: Sentinel Robo-01 spots momentum and proposes an aggressive trade: `BUY NVDAx $15,000`.
3. **Atomic Revert on Solana**: Sentinel evaluates prospective state. NVDA would reach 35% (> 25% cap), cash drops to 10% (< 20% floor), and sizing breaches $10,000 limit. The transaction is aborted atomically. Zero tokens move; 100% of capital is safe.
4. **Autonomous Reactive Adaptation**: The agent reads the rejection telemetry, solves the maximum mathematically compliant trade size ($5,000), and auto-adapts its intent: `BUY NVDAx $5,000`.
5. **Settlement & PROVN Receipt**: Trade settles on-chain; balances update; PROVN produces a two-tier financial audit record ("✓ Protected on Solana" for investors; technical drawer with deterministic SHA-256 state commitments, PDA, and slot for auditors).

---

## 4. Technical Architecture: The Modular Monolith

Sentinel avoids distributed infrastructure bloat (no unnecessary message queues, microservices, or complex databases) by organizing into a clean, battle-tested modular monolith:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                              │
│       apps/web (Next.js 14, Tailwind, Solana Wallet Adapter)           │
│   • Portfolio (NAV & Assets)          • Agent (10-Stage Loop)          │
│   • Protection (On-Chain PDA Caps)    • Activity (PROVN Receipts)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SDK & ORCHESTRATION LAYER                        │
│                         packages/sdk                                   │
│   • SentinelClient                    • AutonomousRoboAgent            │
│   • Meteora DBC Adapter               • PreStocks Secondary Adapter    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DOMAIN & VERIFICATION LAYER                       │
│                        packages/domain                                 │
│   • PolicyEngine (Basis Points Math)  • SWARM-Lite 6-Verifier Consensus│
│   • PROVN Evidence & State Hashing    • Asset & SPV Registry           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ON-CHAIN ENFORCEMENT BOUNDARY                      │
│                  programs/sentinel (Anchor on Solana)                  │
│   • Program ID: 3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK           │
│   • u128 Fixed-Point Postcondition Verification                        │
│   • Atomic Reversion upon invariant breach (0 tokens moved)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Sponsor Integration Breakdown

### 5.1 Pyth Network (Pyth Pro Track)
- **Centrality to Product**: Pyth price feeds are the mathematical foundation of all invariant evaluations.
- **Capabilities Delivered**:
  - Dual-feed pricing comparing tokenized stock prices with underlying US equity benchmarks to detect depegging or basis tracking error (> 100 bps).
  - Mark-to-market portfolio NAV updates with confidence intervals ($\pm \sigma$).
  - Staleness guard rejecting quotes older than 60 seconds.

### 5.2 PreStocks ($10,000 Bounty)
- **Centrality to Product**: Broadens Sentinel's tokenized universe beyond public equities into high-demand pre-IPO secondary tech shares.
- **Capabilities Delivered**:
  - Full Asset Universe supporting pre-IPO tech giants (`SPACEXx`, `OPENAIx`, `STRIPEx`).
  - Portfolio Builder with macro asset class policy enforcement (`Public Equities ≤ 70%`, `Pre-IPO ≤ 20%`, `USDC Cash Reserves ≥ 10%`).
  - Autonomous sizing solver respecting private market illiquidity caps.

### 5.3 Meteora ($5,000 Bounty)
- **Centrality to Product**: Ensures agents only route through institutional-quality Dynamic Bonding Curves (DBC).
- **Capabilities Delivered**:
  - `MeteoraDBCMarketQualityVerifier` inspecting curve liquidity depth (≥ $25,000 floor) and price stability (≤ 200 bps divergence from reference index).
  - Bidirectional Protection: Sentinel protects investors from rogue algorithmic executions *and* protects Meteora DBC pools from toxic predatory flows.

---

## 6. Verification & Test Credentials

Sentinel Finance boasts **100% test pass rate** across its entire codebase:

| Suite | Command | Test Count | Result |
| :--- | :--- | :--- | :--- |
| **Rust Anchor Invariant Tests** | `cargo test --manifest-path programs/sentinel/Cargo.toml --lib` | 9 tests | **PASS (0 failures)** |
| **Domain Policy Engine** | `pnpm --filter @sentinel/domain test` | 39 tests | **PASS (0 failures)** |
| **SDK & Agent Simulator** | `pnpm --filter @sentinel/sdk test` | 55 tests | **PASS (0 failures)** |
| **End-to-End Demo Scenario** | `node --test tests/integration/demo-scenario.test.ts` | 1 test | **PASS (0 failures)** |
| **Production Web Build** | `pnpm --filter @sentinel/web run build` | 4/4 static pages | **Exit code 0** |
| **Total Automated Tests** | — | **104 tests** | **104 / 104 passed (100%)** |

---

## 7. Colosseum Graduation Roadmap

1. **Testnet / Mainnet-Beta Tokenized Stock Whitelisting**: Onboard regulated tokenized stock issuers (Backed Finance, Ondo, Dinari).
2. **Permissionless Policy Attestation**: Allow third-party algorithmic agents (ClawPump, Eliza, Autonomous SDKs) to bind to Sentinel vaults via standard CPI.
3. **Institutional Multi-Sig Delegation**: Support Squads v4 multi-sig governance for institutional fund managers delegating sub-vaults to automated strategies.
