# Sentinel Finance — Hackathon Submission Form Responses

## 1-Sentence Elevator Pitch
Sentinel is an outcome-bounded execution firewall on Solana that deterministically guarantees autonomous AI agents cannot breach user portfolio risk caps, reserve floors, or oracle bounds.

---

## 50-Word Project Description
Sentinel Robo is an autonomous investment manager for tokenized equities on Solana. While AI agents propose trades, Sentinel's on-chain Anchor program intercepts execution, projecting post-state against deterministic policy bounds. Non-compliant trades atomically revert, allowing the agent to read on-chain telemetry, adapt order sizing to compliant headroom, and settle with cryptographic receipts.

---

## Track Selection
- **Primary Track**: Investing → Robo-Portfolios ($100,000 Main Track)
- **Deployment**: Live on Solana Devnet (`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`) and hosted on Railway (`https://sentinel-finance-production-4560.up.railway.app/`).

---

## Sponsor Paragraphs

### Pyth Network (Authoritative Security Input)
Sentinel integrates Pyth not merely for pricing, but as an on-chain security input where bad data halts execution. The Anchor program reads Pyth `PriceUpdateV2` on-chain, enforcing a strict 60-second staleness ceiling and 200 bps confidence interval. Rather than trusting untrusted caller-supplied quotes, Sentinel derives benchmark prices directly from Pyth, atomically reverting trades if execution deviates beyond policy slippage tolerance.

### PreStocks (Asset Class Concentration Invariants)
Sentinel secures allocations into tokenized private technology equity (`OPENAIx`, `SPACEXx`, `STRIPEx`). Beyond single-asset caps, Sentinel enforces macro asset-class boundaries (`Pre-IPO ≤ 20%`). When an agent proposes an allocation that pushes Pre-IPO holdings past risk thresholds, Sentinel blocks execution; the agent reads the rejection telemetry and auto-adapts order size to exact compliant headroom.

### Meteora (Dynamic Bonding Curve Quality Guard)
Sentinel pairs portfolio safety with Meteora Dynamic Bonding Curve (DBC) market quality verification. Before proposing execution, the agent evaluates deterministic pool PDAs against user slippage limits and pool depth reserves ($25,000 floor). If shallow liquidity causes excessive curve impact, execution halts before capital is risked, prompting the agent to resize trades along the bonding curve.

---

## Key Links & Devnet Proofs
- **Live App**: [https://sentinel-finance-production-4560.up.railway.app/](https://sentinel-finance-production-4560.up.railway.app/)
- **Program ID**: [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet)
- **Devnet Rejection**: [`Yj4VQjWB...`](https://explorer.solana.com/tx/Yj4VQjWBtjhYZZpUvKeeuoWRL674jDawZ3HKk4rysriGPumK1Mqz7sLuB59dGD8nk4L5z7aWe27nqqnTt1G91AB?cluster=devnet)
- **Devnet Settlement**: [`424aJbYW...`](https://explorer.solana.com/tx/424aJbYWGVFs6o8tDttYURYnZdBiFXtcbCGtHewF6uRBaj2oZ8sZmSDs25ws8r5dmMBH8fZGCw9w7Z8yTMj6mZvU?cluster=devnet)
- **Devnet Evidence**: [`hZFTL14Y...`](https://explorer.solana.com/tx/hZFTL14Y17EQx44JskkbPMXEivsSWLDsaUfDtC6cAnmFAo84guhBLQ1ap2VV9ZQXbX334PdYiWfLmXxKjH1MNoF?cluster=devnet)
