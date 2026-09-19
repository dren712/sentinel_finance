# Sentinel Finance — Sponsor Matrix & Integration Architecture

## 1. Focused Hackathon Strategy (Max 3 Sponsor Bounties)

Sentinel Finance adheres to a focused, high-conviction submission strategy. Rather than claiming superficial integrations across numerous disjointed tracks, Sentinel targets the **Robo-Portfolios Main Track** and **exactly 3 deeply integrated sponsor tracks**:

| Opportunity / Track | Sponsor Role | Concrete Product Capability | Source File & Implementation |
| :--- | :--- | :--- | :--- |
| **Main Track ($100k)** | **Robo-Portfolios** | Autonomous robo-investor for tokenized equities with authoritative on-chain postcondition guarantees. | `programs/sentinel`, `apps/web`, `packages/sdk` |
| **Pyth Network** | **Market Truth & Valuation** | Dual-feed oracle mark-to-market pricing, staleness verification, confidence intervals ($\pm \sigma$), and tracking error checks. | `packages/domain/src/price-provider.ts`, `packages/domain/src/asset-registry.ts` |
| **PreStocks ($10k)** | **Pre-IPO Asset Universe** | Pre-IPO private equity universe (`SPACEXx`, `OPENAIx`, `STRIPEx`), Portfolio Builder, and macro asset class allocation limits (`Pre-IPO ≤ 20%`). | `packages/domain/src/asset-registry.ts`, `packages/sdk/src/adapters/pre-stocks-adapter.ts` |
| **Meteora ($5k)** | **Stock Liquidity Primitive** | Dynamic Bonding Curve (DBC) liquidity verifier ($25k reserve floor, $\le 200\text{ bps}$ price divergence), dynamic fees, and bidirectional market protection. | `packages/domain/src/swarm-verifiers.ts`, `packages/sdk/src/verifiers/meteora-verifier.ts` |

---

## 2. Deep-Dive: Core Sponsor Implementations

### 2.1 Pyth Network — Market Truth & Valuation
- **Strategic Fit**: Accurate pricing is the mathematical foundation of all financial invariants. Sentinel never executes on unverified prices.
- **Sentinel Implementation**:
  - `PythPriceAdapter` feeds verified prices into `SentinelValuationEngine` to perform real-time mark-to-market NAV calculations.
  - Invariant checks enforce Pyth confidence bounds ($\pm \sigma$) and stale-quote rejection (< 60s freshness).
  - Dual-feed pricing compares tokenized equity price against underlying equity index to detect depegging or basis tracking error (> 100 bps).
- **Code Path**:
  - [`packages/domain/src/price-provider.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/price-provider.ts)
  - [`packages/domain/src/valuation-engine.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/valuation-engine.ts)

### 2.2 PreStocks — Pre-IPO Asset Universe & Portfolio Builder
- **Strategic Fit**: PreStocks enables tokenized pre-IPO secondary stock trading. Sentinel provides the institutional risk layer so autonomous agents can safely invest in private markets.
- **Sentinel Implementation**:
  - `AssetRegistry` registers private equities (`SPACEXx`, `OPENAIx`, `STRIPEx`) alongside public equities (`NVDAx`, `AAPLx`).
  - Portfolio Builder supports 3 explicit macro asset classes: Public Equities ($\le 70\%$), Pre-IPO Private Equity ($\le 20\%$), and USDC Reserves ($\ge 10\%$).
  - Autonomous agents automatically calculate maximum compliant pre-IPO trade sizing under the 20% ceiling.
- **Code Path**:
  - [`packages/domain/src/asset-registry.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/asset-registry.ts)
  - [`packages/sdk/src/adapters/pre-stocks-adapter.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/sdk/src/adapters/pre-stocks-adapter.ts)

### 2.3 Meteora — Dynamic Bonding Curve (DBC) & Market Protection
- **Strategic Fit**: Tokenized equities launched on Meteora DBCs require deep liquidity and controlled volatility to be investable by autonomous agents.
- **Sentinel Implementation**:
  - `MeteoraDBCMarketQualityVerifier` inspects DBC pool reserves to verify a minimum liquidity floor of **$25,000 USD** and spot price divergence $\le 2.00\%$.
  - Bidirectional Protection: Sentinel protects investors from rogue agent trades *and* protects Meteora DBC pools from toxic predatory flows by enforcing trade sizing ceilings and slippage bounds.
- **Code Path**:
  - [`packages/domain/src/swarm-verifiers.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/swarm-verifiers.ts)
  - [`packages/sdk/src/verifiers/meteora-verifier.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/sdk/src/verifiers/meteora-verifier.ts)

---

## 3. Explicit Containment: ClawPump & Tessera

To avoid product warping, superficial integration claims, or diluting the primary submission:

1. **ClawPump**:
   - Official ClawPump track requires token launchpad mechanics + Meteora liquidity pairing. Sentinel is an institutional robo-advisor, not a memecoin or launchpad platform.
   - We retain ClawPump purely as an **internal agent wallet identity pattern** (`ClawPumpAgentWallet` with detached Ed25519 signatures over canonical JSON intents). We do **not** submit for the ClawPump bounty.
2. **Tessera**:
   - Tessera provides fractional SPV secondary equity tranches, which overlaps with PreStocks.
   - We retain Tessera data structures internally for SPV series and Carta 409A NAV attestations in the asset drawer, but submit exclusively to PreStocks for the pre-IPO bounty.

---

## 4. Anti-Deception & Technical Truth Standard

1. **No Cosmetic Sponsor Cards**: No fake cards or marketing carousels in the UI. Every sponsor feature is a functional component of the portfolio, risk, or execution engines.
2. **Honest Execution Labeling**: Offline mock fixtures are clearly marked `[SIMULATION]`; live Devnet queries and Solana Anchor program executions are marked `[DEVNET]`.
