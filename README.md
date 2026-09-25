<p align="center">
  <img src="./docs/assets/Sentinel_logo.png" alt="Sentinel Robo" width="300" />
</p>

<h1 align="center">Sentinel Robo</h1>

<p align="center">
  <strong>Outcome-bounded autonomy for tokenized portfolios on Solana.</strong><br>
  <em>AI agents can decide what to trade. Sentinel decides whether the resulting portfolio state is allowed.</em>
</p>

<p align="center">
  <a href="https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet"><img src="https://img.shields.io/badge/Solana-Devnet_Live-9945FF?logo=solana&logoColor=white" alt="Solana Devnet"></a>
  <a href="https://pyth.network"><img src="https://img.shields.io/badge/Pyth_Hermes-Dual--Feed_Live-E6DAFE?logo=pyth&logoColor=black" alt="Pyth Network"></a>
  <a href="./docs/SPONSORS.md#2-prestocks-prestocksapiclient--pre-ipo-exposure-ceiling"><img src="https://img.shields.io/badge/PreStocks-Certified_Pre--IPO-8A2BE2" alt="PreStocks"></a>
  <a href="./docs/SPONSORS.md#3-meteora-meteoradbcmarketqualityverifier--pool-pda-derivation"><img src="https://img.shields.io/badge/Meteora-DBC_Pool_PDAs-FE5F55" alt="Meteora"></a>
  <a href="./docs/VERIFICATION.md"><img src="https://img.shields.io/badge/PROVN-Two--Tier_Receipts-00C49F" alt="PROVN"></a>
  <a href="./docs/SECURITY.md"><img src="https://img.shields.io/badge/Security-11_Vectors_Enforced-2563EB" alt="Security Matrix"></a>
</p>

<p align="center">
  <code>Agent intent → Promise → Post-state projection → Financial invariants → Block / Settle → Adapt → Cryptographic evidence</code>
</p>

<p align="center">
  <a href="./docs/TECHNICAL.md">Technical Docs</a> ·
  <a href="./docs/DEMO.md">Demo Walkthrough</a> ·
  <a href="https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet">Solana Explorer</a> ·
  <a href="./docs/VERIFICATION.md">Verification Gate</a> ·
  <a href="./docs/SECURITY.md">Security Matrix</a> ·
  <a href="./docs/SPONSORS.md">Sponsor Integrations</a>
</p>

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
**`✕ BLOCKED`** — Transaction reverts before capital moves ([Devnet TX `2haBLUK...`](https://explorer.solana.com/tx/2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD?cluster=devnet)).

`Robo-01` reads the structured rejection, recalculates exact compliant headroom, and adapts to:
`BUY NVDAx $5,000` (`NVDAx 20% → 25.0%`, `USDC 25% → 20.0%`).

**`✓ APPROVED & SETTLED`** — State transition commits on Solana Devnet with a PROVN SHA-256 receipt ([Devnet TX `59KCBronda...`](https://explorer.solana.com/tx/59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd?cluster=devnet)).

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
                        │  Next.js UI + BFF REST API  │
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
  - Anchor `execute_trade` verifies postconditions on-chain and mutates `VaultAccount` + `PromiseAccount` state on Solana Devnet, followed by `record_evidence` (`EvidenceAccount` PDA).
- **`TARGET ARCHITECTURE` (Post-Hackathon Roadmap)**:
  - Direct on-chain Cross-Program Invocation (CPI) from Sentinel `execute_trade` into Meteora DBC / PreStocks secondary liquidity pools with post-CPI SPL token vault balance assertions.

---

## What's Real on Devnet

| Artifact | On-Chain Address / Signature | Explorer |
| :--- | :--- | :--- |
| **Sentinel Anchor Program** | `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` | [Program](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet) |
| **PolicyAccount PDA** | `3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh` | [Policy PDA](https://explorer.solana.com/address/3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh?cluster=devnet) |
| **AgentAccount PDA (`robo-01`)** | `62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ` | [Agent PDA](https://explorer.solana.com/address/62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ?cluster=devnet) |
| **VaultAccount PDA** | `7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y` | [Vault PDA](https://explorer.solana.com/address/7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y?cluster=devnet) |
| **Rejected `$15K` Trade Proof TX** | `2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD` | [View TX](https://explorer.solana.com/tx/2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD?cluster=devnet) |
| **Settled `$5K` Adapted Trade TX** | `59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd` | [View TX](https://explorer.solana.com/tx/59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd?cluster=devnet) |
| **PROVN Evidence Anchor TX** | `3pvsnpVZ7A2f2ESd8jeHjbMbTYFsPv7g7RstKnNzBRpiR4mdUtCkQY5RQEPSb1fL8934sArLRp9KRDNXzFfT19Lw` | [View TX](https://explorer.solana.com/tx/3pvsnpVZ7A2f2ESd8jeHjbMbTYFsPv7g7RstKnNzBRpiR4mdUtCkQY5RQEPSb1fL8934sArLRp9KRDNXzFfT19Lw?cluster=devnet) |

---

## Sponsor Integrations

| Sponsor | Integration Summary | Deep Dive |
| :--- | :--- | :--- |
| **Pyth Network** | `PythLivePriceProvider` fetches live Hermes v2 prices/confidence/age (`NVDAx`/`NVDA`, `AAPLx`/`AAPL`, `SPYx`/`SPY`) and enforces fail-closed staleness (`≤ 60s`) & dual-feed peg deviation (`≤ 100 bps`) guards. | [docs/SPONSORS.md](./docs/SPONSORS.md#1-pyth-network-pythlivepriceprovider--dual-feed-tracking) |
| **PreStocks** | Server-side `PreStocksApiClient` normalizes certified Pre-IPO assets (`OPENAIx`, `SPACEXx`, `STRIPEx`, `ANTHROPICx`) into an isolated universe and enforces the `Pre-IPO ≤ 20%` portfolio exposure ceiling. | [docs/SPONSORS.md](./docs/SPONSORS.md#2-prestocks-prestocksapiclient--pre-ipo-exposure-ceiling) |
| **Meteora** | Derives canonical Meteora DBC pool PDAs (`4bHACh...`) and verifies pool liquidity depth (`≥ $25,000`) and price impact (`≤ 200 bps`) before Sentinel authorizes execution. | [docs/SPONSORS.md](./docs/SPONSORS.md#3-meteora-meteoradbcmarketqualityverifier--pool-pda-derivation) |

---

## Tech Stack & Quick Start

- **On-Chain**: Rust, Anchor (`0.30.1`), Solana Web3.js (`@solana/web3.js`).
- **Packages**: `@sentinel/domain` (policy/valuation/PROVN), `@sentinel/sdk` (agent loop, LLM tool dispatcher, adapters), `@sentinel/web` (Next.js 14 App Router, Tailwind CSS, PostgreSQL `pg` read index).

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

## Testing & Verification (`120 Automated Tests + Devnet Gate`)

```bash
# Run all 120 unit & 11-vector adversarial security tests
pnpm test

# Run live Solana Devnet P22/P23 verification gate
node packages/sdk/scripts/verify-p22-p23-devnet.mjs
```

---

## Documentation Links

- [Technical Architecture & Anchor Lifecycle](./docs/TECHNICAL.md)
- [Sponsor Integrations (`Pyth`, `PreStocks`, `Meteora`)](./docs/SPONSORS.md)
- [Flagship Demo & Narration Guide](./docs/DEMO.md)
- [11-Vector Adversarial Security Matrix](./docs/SECURITY.md)
- [Full Devnet Verification Gate & Proofs](./docs/VERIFICATION.md)
