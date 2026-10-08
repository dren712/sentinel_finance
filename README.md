<p align="center">
  <img src="./docs/assets/Sentinel_logo.png" alt="Sentinel Robo" width="300" />
</p>

<h1 align="center">Sentinel Finance — Recovery Layer for Autonomous Capital</h1>

<p align="center">
  <strong>Programmable containment and permissionless recovery for autonomous agents on Solana.</strong><br>
  <em>When autonomous trading agents breach portfolio risk invariants, Sentinel quarantines execution authority and enables permissionless solvers to rebalance the vault via real SPL token custody containment.</em>
</p>

<p align="center">
  <a href="https://sentinel-finance-production-4560.up.railway.app/"><img src="https://img.shields.io/badge/Live_App-Railway_Production-00C49F?logo=railway&logoColor=white" alt="Live App"></a>
  <a href="https://sentinel-finance-production-4560.up.railway.app/lab"><img src="https://img.shields.io/badge/Devnet_Lab-Faucets_&_Simulator-FF5C00" alt="Devnet Lab"></a>
  <a href="https://sentinel-finance-production-4560.up.railway.app/quarantine"><img src="https://img.shields.io/badge/Quarantine_Terminal-Live-E63946" alt="Quarantine Terminal"></a>
  <a href="https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet"><img src="https://img.shields.io/badge/CWF_Program-3TVEhBHw...-9945FF?logo=solana&logoColor=white" alt="CWF Devnet Program"></a>
  <a href="https://pyth.network"><img src="https://img.shields.io/badge/Pyth_Oracle-PriceUpdateV2_Verified-E6DAFE?logo=pyth&logoColor=black" alt="Pyth Network"></a>
  <a href="./docs/cwf/SUBMISSION_CWF.md"><img src="https://img.shields.io/badge/CWF-Submission_Doc-00C49F" alt="CWF Submission"></a>
  <a href="./docs/cwf/STATE_MACHINE.md"><img src="https://img.shields.io/badge/State_Machine-Quarantine_&_Recovery-2563EB" alt="State Machine"></a>
</p>

<p align="center">
  <code>AUTHORIZED → UNSAFE → PROVEN → QUARANTINED → RECOVERED → EXPIRED</code>
</p>

<p align="center">
  <a href="https://sentinel-finance-production-4560.up.railway.app/lab">Devnet Lab (Faucets &amp; Sandbox)</a> ·
  <a href="https://sentinel-finance-production-4560.up.railway.app/quarantine">Quarantine &amp; Recovery Terminal</a> ·
  <a href="https://sentinel-finance-production-4560.up.railway.app/">Portfolio Dashboard</a> ·
  <a href="./docs/cwf/SUBMISSION_CWF.md">CWF Submission</a> ·
  <a href="./docs/cwf/STATE_MACHINE.md">State Machine</a> ·
  <a href="./docs/cwf/DISCLOSURE.md">Disclosure &amp; Provenance</a> ·
  <a href="https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet">Solana Explorer (CWF)</a> ·
  <a href="./docs/TECHNICAL.md">Technical Docs</a>
</p>

---

## About Sentinel

**Sentinel is the programmable control and recovery layer for autonomous capital on Solana.**

While AI agents formulate trades and react to market signals, they operate in probabilistic space. Fine-tuning and off-chain safeguards cannot provide mathematical guarantees against catastrophic risk. Sentinel places a deterministic, on-chain state-transition boundary between agent intelligence and financial settlement:

- **Autonomous Intelligence:** The agent proposes portfolio allocations across volatile assets and stablecoins.
- **Deterministic Guards:** Proposed trades are bounded by on-chain portfolio invariants (`max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`) verified against an authenticated Pyth oracle feed (`PriceUpdateV2`).
- **Hysteresis Quarantine:** If market shifts or invalid states cause invariant breaches, permissionless watchers flag the vault into `Quarantined`, immediately locking out the agent's trading authority (`VaultNotActive`).
- **Permissionless Custody Recovery:** Any external solver can permissionlessly call `recover()` during the recovery window. The contract executes a real SPL Token / Token-2022 CPI `transfer_checked_signed` to the owner's `safe_destination`, enforcing value conservation and oversell guards before restoring the vault to `Active`.

---

## The 30-Second Demo

`Robo-01` proposes:
`BUY NVDAx $15,000`

Sentinel projects post-state invariants:
```text
NVDAx    20% → 35%      LIMIT 25%   ✕
USDC     25% → 10%      MIN   20%   ✕
Trade    —   → $15K     MAX   $10K  ✕
```
**`✕ BLOCKED`** — Transaction reverts before capital moves ([Devnet TX `Yj4VQjWB...`](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet)).

`Robo-01` reads the structured rejection, recalculates exact compliant headroom, and adapts to:
`BUY NVDAx $5,000` (`NVDAx 20% → 25.0%`, `USDC 25% → 20.0%`).

**`✓ APPROVED & SETTLED`** — Sentinel's on-chain `VaultAccount` state transition commits on Solana Devnet with a PROVN SHA-256 receipt ([Devnet TX `424aJbYW...`](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet)). Sentinel's PortfolioVault is an on-chain ledger that tracks balances and enforces invariants. Token settlement is simulated; tokens do not move between SPL accounts.

---

## Real on Devnet vs. Demo / Simulation

To provide complete technical transparency for judges, code auditors, and reviewers:

| Dimension | Real On Solana Devnet (Authoritative) | Interactive Demo / Simulation Layer |
| :--- | :--- | :--- |
| **Anchor Program** | Deployed Solana program (`3gh1Cc2Q...`) enforcing `execute_guarded_trade` atomic postconditions | Client-side what-if projection simulator on Overview |
| **Account State** | On-chain `PolicyAccount`, `AgentAccount`, `VaultAccount`, `PromiseAccount`, `EvidenceAccount` PDAs | Simulated preview headroom calculations |
| **Policy Updates** | Signed by user's browser wallet (Phantom/Solflare) committing on Devnet RPC via Anchor | Local UI candidate state prior to on-chain signing |
| **Flagship Rejection** | Real rejected $15K Devnet transaction ([TX `Yj4VQjWB...`](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet)) | Preflight client-side rejection preview |
| **Flagship Settlement** | Real $5K guarded `VaultAccount` state transition ([TX `424aJbYW...`](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet)). Ledger-only settlement; tokens do not move between SPL accounts | Target allocation slider projection curves |
| **Evidence Proofs** | PROVN SHA-256 on-chain evidence transaction ([TX `hZFTL14Y...`](https://explorer.solana.com/tx/hZFTL14Y17EQx44JskkbPMXEivsSWLDsaUfDtC6cAnmFAo84guhBLQ1ap2VV9ZQXbX334PdYiWfLmXxKjH1MNoF?cluster=devnet)) | Two-tier evidence receipt inspection drawer |
| **Price Feeds** | Pyth Hermes v2 sub-second price streaming in `LIVE` mode (`https://hermes.pyth.network`) | Injected 140s stale-quote demo scenario |
| **Sponsor Scenarios** | Meteora DBC deterministic pool PDA derivations; PreStocks 409A NAV normalization | Simulated shallow DBC pool impact (`1.7% > 1.0%`) & $30K OPENAIx breach |
| **LLM Provider** | OpenAI GPT-4o function-calling supported when `OPENAI_API_KEY` is configured | Deterministic `DemoProvider` running on the hosted deployment |
| **Persistence** | Railway Managed PostgreSQL read model (`agent_runs`, `decisions`, `executions`, `evidence_index`) | In-memory read model fallback when running locally without a database |

---

## Three Failure Modes Sentinel Enforces

| Threat | Example Trigger | Sentinel Outcome |
| :--- | :--- | :--- |
| **1. Untrusted Agent** | `BUY $15K NVDAx` (`35% > 25%` cap, `USDC 10% < 20%` floor) or `BUY $30K OPENAIx` (`Pre-IPO > 20%`) | Atomically blocked (`ERR_CONCENTRATION_LIMIT` / `ERR_PRE_IPO_EXPOSURE`); agent adapts to exact headroom (`$5K` / `$2K`). |
| **2. Untrusted Data** | Pyth oracle quote is stale (`140s > 60s`) or Hermes is unreachable in `LIVE` mode | Fail-closed (`ERR_QUOTE_STALE` / `NO EXECUTION`); never falls back to synthetic prices in `DEVNET LIVE`. |
| **3. Untrusted Market** | Meteora DBC pool depth is shallow (`$12K < $25K` floor) or spread exceeds `200 bps` | Blocked pre-execution by `LiquidityVerifier` (`MARKET_QUALITY_FAILURE`). |

---

## Architecture (`CURRENT DEVNET` vs. `TARGET ARCHITECTURE`)

```text
                        ┌─────────────────────────────┐
                        │     SENTINEL WEB (Docker)   │
                        │  Next.js 15 UI + BFF API    │
                        │  @sentinel/sdk & @domain    │
                        └──────┬───────────────┬──────┘
                                │               │
           SOLANA_RPC_URL       ▼               ▼       DATABASE_URL
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │      SOLANA DEVNET (TRUTH)    │       │   POSTGRESQL (READ HISTORY)   │
    │  Program: 3gh1Cc...WEvAJK     │       │  1. agent_runs                │
    │  • PolicyAccount PDA          │       │  2. decisions                 │
    │  • AgentAccount PDA           │       │  3. executions                │
    │  • VaultAccount PDA           │       │  4. portfolio_snapshots       │
    │  • PromiseAccount PDA         │       │  5. evidence_index            │
    │  • EvidenceAccount PDA        │       └───────────────────────────────┘
    └───────────────────────────────┘
```

- **`CURRENT DEVNET` (Implemented & Live)**:
  - Browser wallet signs `PolicyAccount` PDA updates (`POST /api/policy/:wallet` prepares unsigned Anchor tx; server never signs user policy changes).
  - `PythLivePriceProvider` queries Pyth Hermes v2 (`https://hermes.pyth.network`); `PreStocksApiClient` normalizes Pre-IPO NAVs server-side; `MeteoraDBCMarketQualityVerifier` validates deterministic pool PDAs pre-trade.
  - Anchor `execute_guarded_trade` verifies postconditions on-chain and mutates `VaultAccount` + `PromiseAccount` state on Solana Devnet, followed by `record_evidence` (`EvidenceAccount` PDA).
  - Current Devnet settlement: Sentinel's PortfolioVault is an on-chain ledger that tracks balances and enforces invariants. Token settlement is simulated; tokens do not move between SPL accounts. No external DEX swap or SPL token transfer is claimed or performed.
- **`TARGET ARCHITECTURE` (Post-Hackathon Roadmap)**:
  - Direct on-chain Cross-Program Invocation (CPI) from Sentinel `execute_guarded_trade` into Meteora DBC / PreStocks secondary liquidity pools with post-CPI SPL token vault balance assertions.

---

## Built for Solana's Next Consensus Era

Sentinel is an application-layer enforcement system: the agent proposes, Sentinel evaluates the projected portfolio state, and the on-chain Solana program enforces the resulting constraints.

Solana's upcoming **Alpenglow** consensus upgrade targets sub-second (~150 ms) finality while leaving SVM transaction execution unchanged. Sentinel does not depend on Alpenglow today, but its policy-bound execution model is designed to benefit from Solana's continued improvements in confirmation and finality.

```text
Agent Intelligence ➔ Sentinel Policy Postconditions ➔ SVM Execution ➔ Solana Consensus / Finality ➔ PROVN Evidence Index
```

- **Today:** Sentinel runs on Solana Devnet with real on-chain policy enforcement (`execute_guarded_trade`), state transitions on `VaultAccount` PDAs, and PROVN cryptographic evidence.
- **Direction:** As Solana moves toward lower-latency finality, Sentinel's policy-bound execution model can support increasingly responsive autonomous workflows without requiring redesign of the core policy logic.

---

## What's Real on Devnet

| Artifact | On-Chain Address / Signature | Explorer |
| :--- | :--- | :--- |
| **Sentinel Anchor Program** | `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` | [Program](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet) |
| **Live Railway Deployment** | `sentinel-finance-production-4560.up.railway.app` | [Live Production App](https://sentinel-finance-production-4560.up.railway.app/) |
| **PolicyAccount PDA** | `3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh` | [Policy PDA](https://explorer.solana.com/address/3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh?cluster=devnet) |
| **AgentAccount PDA (`robo-01`)** | `G9MwRFgstx8Ee4dC6CYLb4CuwhR5YXXpYUhbyHrsxSpv` *(Live/Hosted)* <br>`62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ` *(Test Harness)* | [Live Agent PDA](https://explorer.solana.com/address/G9MwRFgstx8Ee4dC6CYLb4CuwhR5YXXpYUhbyHrsxSpv?cluster=devnet) · [Test PDA](https://explorer.solana.com/address/62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ?cluster=devnet) |
| **VaultAccount PDA** | `7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y` | [Vault PDA](https://explorer.solana.com/address/7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y?cluster=devnet) |
| **Rejected `$15K` Trade Proof TX** | `Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB` | [View TX](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet) |
| **Settled `$5K` Adapted Trade TX** | `424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU` | [View TX](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet) |
| **PROVN Evidence Anchor TX** | `hZFTL14Y17EQx44JskkbPMXEivsSWLDsaUfDtC6cAnmFAo84guhBLQ1ap2VV9ZQXbX334PdYiWfLmXxKjH1MNoF` | [View TX](https://explorer.solana.com/tx/hZFTL14Y17EQx44JskkbPMXEivsSWLDsaUfDtC6cAnmFAo84guhBLQ1ap2VV9ZQXbX334PdYiWfLmXxKjH1MNoF?cluster=devnet) |

---

## Sponsor Integrations

| Sponsor | Integration Summary | Deep Dive |
| :--- | :--- | :--- |
| **Pyth Network** | `PythLivePriceProvider` fetches live Hermes v2 prices/confidence/age (`NVDAx`/`NVDA`, `AAPLx`/`AAPL`, `SPYx`/`SPY`) and enforces fail-closed staleness (`≤ 60s`) & dual-feed peg deviation (`≤ 100 bps`) guards. | [docs/SPONSORS.md](./docs/SPONSORS.md#1-pyth-network-pythlivepriceprovider--dual-feed-tracking) |
| **PreStocks** | Server-side `PreStocksApiClient` normalizes certified Pre-IPO assets (`OPENAIx`, `SPACEXx`, `STRIPEx`, `ANTHROPICx`) into an isolated universe and enforces the `Pre-IPO ≤ 20%` portfolio exposure ceiling. | [docs/SPONSORS.md](./docs/SPONSORS.md#2-prestocks-prestocksapiclient--pre-ipo-exposure-ceiling) |
| **Meteora** | Derives canonical Meteora DBC pool PDAs (`4bHACh...`) and verifies pool liquidity depth (`≥ $25,000`) and price impact (`≤ 200 bps`) before Sentinel authorizes execution. *(Note: Devnet settlement occurs on the Sentinel VaultAccount after pre-trade Meteora verification rather than an on-chain Meteora swap CPI).* | [docs/SPONSORS.md](./docs/SPONSORS.md#3-meteora-meteoradbcmarketqualityverifier--pool-pda-derivation) |

---

## Tech Stack & Quick Start

- **On-Chain**: Rust, Anchor (`0.30.1`), Solana Web3.js (`@solana/web3.js`).
- **Packages**: `@sentinel/domain` (policy/valuation/PROVN), `@sentinel/sdk` (agent loop, LLM tool dispatcher, adapters), `@sentinel/web` (Next.js 15.5.25 App Router, Tailwind CSS, PostgreSQL `pg` read model).
- **AI Integration**: OpenAI GPT-4o supported; hosted deployment currently runs `DemoProvider` deterministic fallback unless `OPENAI_API_KEY` is configured.
- **Docker Image**: Multi-arch (`linux/amd64` + `linux/arm64`) image published at [`darshan712/sentinel-finance:latest`](https://hub.docker.com/r/darshan712/sentinel-finance).
- **Live Railway Deployment**: [`https://sentinel-finance-production-4560.up.railway.app/`](https://sentinel-finance-production-4560.up.railway.app/) (Production Next.js 15.5.25 + Managed PostgreSQL 16 read model + Solana Devnet + Pyth Hermes dual feeds).

```bash
# 1. Install, build, and run locally
pnpm install && pnpm build
pnpm --filter @sentinel/web dev

# 2. Or run the canonical single-container Docker deployment (+ optional Postgres)
cp .env.example .env
docker compose up --build -d
curl http://localhost:3000/api/health
```

---

## Testing & Verification (`147 Automated Tests Passing + Solana Devnet Gate`)

```bash
# Run all 108 unit, domain, SDK, watcher/solver, and adversarial security tests
pnpm test

# Run slot-warped Bankrun test suites (26 recovery tests + 13 quarantine tests)
node --test tests/bankrun-recovery.test.ts
node --test tests/bankrun-quarantine.test.ts

# Run live Solana Devnet P22/P23 verification gate
node packages/sdk/scripts/verify-p22-p23-devnet.mjs
```

---

## Documentation Links

- [Quarantine & Recovery Terminal (Live)](https://sentinel-finance-production-4560.up.railway.app/quarantine)
- [CWF Submission Document](./docs/cwf/SUBMISSION_CWF.md)
- [Quarantine State Machine Specification](./docs/cwf/STATE_MACHINE.md)
- [CWF Disclosure & Provenance Log](./docs/cwf/DISCLOSURE.md)
- [Live Production Deployment (Railway)](https://sentinel-finance-production-4560.up.railway.app/)
- [Technical Architecture & Anchor Lifecycle](./docs/TECHNICAL.md)
- [11-Vector Adversarial Security Matrix](./docs/SECURITY.md)
- [Full Devnet Verification Gate & Proofs](./docs/VERIFICATION.md)

