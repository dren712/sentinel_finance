# Sentinel Finance — Sponsor Matrix & Integration Architecture

## 1. Executive Matrix: Authentic Technical Capabilities

To prevent architectural drift and superficial "hackathon cards", **every sponsor listed corresponds to a genuine, concrete product capability in Sentinel Finance**.

| Opportunity / Track | Sponsor Role | Concrete Product Capability | Source File & Implementation |
| :--- | :--- | :--- | :--- |
| **Main Hackathon Track ($100k)** | **Sentinel Robo** | Autonomous robo-investor for tokenized stocks on Solana with mathematically enforceable on-chain postconditions. | `programs/sentinel`, `apps/web`, `packages/sdk` |
| **Meteora DBC** | **Stock Liquidity Primitive** | Dynamic Bonding Curve (DBC) market-quality verifier evaluating liquidity depth ($25k floor) and price stability (≤ 200 bps deviation) before trade commitment. | `packages/domain/src/swarm-verifiers.ts`, `packages/sdk/src/verifiers/` |
| **PreStocks** | **Pre-IPO Asset Universe** | Expansion of the tokenized equity registry to include high-demand pre-IPO tech companies (SpaceX, OpenAI, Stripe) governed by concentration caps. | `packages/domain/src/asset-registry.ts` |
| **Pyth Network** | **Market Truth & Valuation** | High-fidelity price oracle feeds with confidence intervals ($\sigma$) and staleness verification for NAV mark-to-market and slippage checks. | `packages/domain/src/price-provider.ts`, `packages/domain/src/asset-registry.ts` |
| **ClawPump** | **Autonomous Economic Identity** | Autonomous agent keypair wallet pattern with detached Ed25519 intent signing bounded by on-chain Sentinel policies. | `packages/sdk/src/adapters/clawpump-adapter.ts`, `packages/domain/src/provn.ts` |
| **Tessera** | **Pre-IPO Expansion Layer** | Fractional private equity and structured secondary market liquidity layer expanding tokenized private market access. | `packages/domain/src/asset-registry.ts` |

---

## 2. Deep-Dive: Individual Sponsor Implementations

### 2.1 Meteora DBC — Actual Stock-Market Liquidity Primitive
- **Official Sponsor Requirement**: Meteora specifically looks for working Dynamic Bonding Curve (DBC) integration and values working code over conceptual slides.
- **Sentinel Implementation**:
  - In a 24/7 tokenized stock market on Solana, autonomous agents need deep liquidity to avoid predatory slippage. Sentinel integrates the **Meteora Dynamic Bonding Curve** model as an automated pre-flight market quality verifier.
  - The `MeteoraDBCMarketQualityVerifier` inspects:
    1. **Curve Liquidity Depth**: Verifies that the pool maintains at least **$25,000 USD** equivalent in reserve assets.
    2. **Price Deviation**: Calculates the basis-point divergence between the DBC spot price and the benchmark oracle price, rejecting trades if divergence exceeds **200 bps (2.00%)**.
  - **Code Path**: Implemented in [`packages/domain/src/swarm-verifiers.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/swarm-verifiers.ts) and [`packages/sdk/src/verifiers/meteora-verifier.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/sdk/src/verifiers/meteora-verifier.ts).

### 2.2 PreStocks — Pre-IPO Asset Universe
- **Official Sponsor Requirement**: PreStocks evaluates creativity, integration depth, and product quality in enabling pre-IPO stock ownership on Solana.
- **Sentinel Implementation**:
  - Today, retail and on-chain investors are locked out of private tech giants before they IPO. PreStocks solves issuance; Sentinel solves **risk-managed portfolio allocation**.
  - Sentinel's `ASSET_REGISTRY` natively supports pre-IPO equities (`SPACEXx`, `OPENAIx`, `STRIPEx`) alongside public equities (`NVDAx`, `AAPLx`).
  - Sentinel's `PolicyEngine` enforces specific **Pre-IPO Concentration Caps** (e.g., maximum 15.00% across all illiquid private assets), guaranteeing the robo-agent does not over-allocate into illiquid secondary assets.
  - **Code Path**: Implemented in [`packages/domain/src/asset-registry.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/asset-registry.ts).

### 2.3 Pyth Network — Market Truth & Valuation
- **Official Sponsor Requirement**: Pyth judges how central price data is to the application, technical integration soundness, and long-term utility.
- **Sentinel Implementation**:
  - Price feeds are not an afterthought in Sentinel—they are the **mathematical bedrock** of all invariant checks.
  - The `PriceProvider` interface powers:
    1. **Mark-to-Market Portfolio NAV**: Real-time valuation of tokenized equities to compute accurate portfolio percentage weights.
    2. **Confidence-Bound Slippage Checks**: Evaluates execution price against Pyth price $\pm$ confidence interval ($\sigma$), ensuring trades do not execute at distorted off-market levels.
    3. **Staleness Protection**: Invariant checks reject trades if the oracle timestamp exceeds the staleness threshold.
  - **Code Path**: Implemented in [`packages/domain/src/price-provider.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/price-provider.ts).

### 2.4 ClawPump — Autonomous Economic Identity
- **Official Sponsor Requirement**: Autonomous economic agent identity and execution tooling on Solana.
- **Sentinel Implementation**:
  - Sentinel implements the **ClawPump-compatible wallet pattern**: the agent maintains its own dedicated Solana keypair (`ClawPumpAgentWallet`).
  - Every trade intent is cryptographically signed using real **Ed25519 detached signatures** over canonical JSON intent bytes.
  - The Anchor on-chain program verifies that the signer matches `agent.agent_authority`, ensuring that only the authorized AI model can propose trades, while keeping all mutations strictly bounded by user policies.
  - **Code Path**: Implemented in [`packages/sdk/src/adapters/clawpump-adapter.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/sdk/src/adapters/clawpump-adapter.ts) and [`packages/domain/src/provn.ts`](file:///Users/darshangaikwad/Desktop/stocklana/packages/domain/src/provn.ts).

### 2.5 Tessera — Pre-IPO Expansion Layer
- **Official Sponsor Requirement**: Fractional private equity asset distribution and secondary market liquidity.
- **Sentinel Implementation**:
  - Tessera tokenizes fractional private shares. Sentinel acts as the **automated portfolio custodian and risk engine** for these assets, enabling automated rebalancing and secondary exit liquidity when target valuation multiples are reached.

---

## 3. Strict Anti-Deception Standard

1. **No Fake Sponsor Cards**: The frontend navigation does not contain a vanity "Sponsors" tab with static promotional cards.
2. **First-Class Architectural Capabilities**: Each sponsor is referenced where it functionally belongs:
   - Meteora DBC in **Execution & SWARM Verifiers**
   - Pyth in **Pricing & Valuation**
   - PreStocks & Tessera in **Asset Registry & Portfolio**
   - ClawPump in **Agent Identity & Keypair Authority**
