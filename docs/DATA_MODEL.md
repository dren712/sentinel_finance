# Sentinel Finance — Data Model Specification

## 1. Mathematical Units & Precision Standards

To eliminate floating-point non-determinism across platforms and environments:

1. **Currency (USD)**: Denominated internally in integer **USD cents** (`u64`).
   - `$100.00` = `10,000` cents
   - `$15,000.00` = `1,500,000` cents
2. **Basis Points (BPS)**: Denominated internally in integer **basis points** (`u16` / `u128`).
   - `1 bp` = `0.01%` (`0.0001`)
   - `100 bps` = `1.00%` (`0.01`)
   - `2,500 bps` = `25.00%` (`0.25`)
   - `10,000 bps` = `100.00%` (`1.00`)
3. **SPL Token Decimals**: Tokenized stocks and USD Coin utilize **6 decimal places** (`1_000_000` raw units = 1.000000 token).
4. **Intermediate Arithmetic**: All fractional multiplications and divisions in Rust and TypeScript execute in **`u128`** checked arithmetic:
   $$\text{exposureBps} = \frac{\text{positionValueCents} \times 10,000}{\text{totalPortfolioValueCents}}$$

---

## 2. On-Chain Anchor Account Schemas

Program ID: `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`

### 2.1 `PolicyAccount`
Stores user-configured financial invariants. Seeded by owner wallet.
- **Seeds**: `[b"policy", owner.key().as_ref()]`
- **Fields**:
  - `owner: Pubkey` (32 bytes): User authority who initialized the policy.
  - `max_single_asset_bps: u16` (2 bytes): Maximum exposure ceiling for any single equity (e.g., `2500` for 25%).
  - `min_stablecoin_bps: u16` (2 bytes): Minimum liquidity floor for stablecoin reserve (e.g., `2000` for 20%).
  - `max_trade_value_usd: u64` (8 bytes): Maximum single trade value (e.g., `10000` for $10,000).
  - `max_slippage_bps: u16` (2 bytes): Maximum allowable slippage (e.g., `100` for 1.00%).
  - `policy_version: u32` (4 bytes): Increments on each update to invalidate stale in-flight promises.
  - `is_active: bool` (1 byte): Master switch for automated trading.
  - `bump: u8` (1 byte): PDA bump seed.
- **Total Space**: `8 + 32 + 2 + 2 + 8 + 2 + 4 + 1 + 1 = 60 bytes`

### 2.2 `PortfolioVault`
The authoritative on-chain balance ledger holding tokenized stock positions and cash reserves.
- **Seeds**: `[b"vault", owner.key().as_ref()]`
- **Fields**:
  - `owner: Pubkey` (32 bytes): Vault owner.
  - `policy: Pubkey` (32 bytes): Associated `PolicyAccount` PDA.
  - `usdc_balance_cents: u64` (8 bytes): Liquid stablecoin reserve balance in cents.
  - `positions: Vec<PortfolioPosition>`: Array of active stock positions (max 8 positions).
  - `bump: u8` (1 byte): PDA bump seed.
- **`PortfolioPosition` Struct**:
  - `mint: Pubkey` (32 bytes): SPL token mint of the tokenized equity.
  - `symbol: String` (4 + 12 = 16 bytes): Ticker symbol (`NVDAx`, `AAPLx`, etc.).
  - `amount_units: u64` (8 bytes): Token quantity in microunits (6 decimals).
  - `price_cents: u64` (8 bytes): Reference mark-to-market price in USD cents.

### 2.3 `AgentAccount`
Defines the autonomous AI trading identity authorized to submit trades.
- **Seeds**: `[b"agent", owner.key().as_ref(), agent_id.as_bytes()]`
- **Fields**:
  - `owner: Pubkey` (32 bytes): User who created the agent.
  - `agent_authority: Pubkey` (32 bytes): Operational keypair used by the agent (ClawPump pattern).
  - `agent_id: String` (4 + 32 = 36 bytes): Unique identifier string (e.g., `"sentinel-robo-01"`).
  - `portfolio_id: String` (4 + 32 = 36 bytes): Associated portfolio reference.
  - `is_active: bool` (1 byte): Pause / unpause state.
  - `bump: u8` (1 byte): PDA bump seed.

### 2.4 `PromiseAccount`
Cryptographically locks a specific trade intent prior to execution.
- **Seeds**: `[b"promise", agent.key().as_ref(), promise_id.as_bytes()]`
- **Fields**:
  - `promise_id: String` (4 + 32 = 36 bytes): Unique promise identifier.
  - `agent: Pubkey` (32 bytes): Agent who created the promise.
  - `policy: Pubkey` (32 bytes): Policy snapshot to evaluate against.
  - `intent_hash: [u8; 32]` (32 bytes): SHA-256 hash of the canonical trade intent.
  - `trade_asset_mint: Pubkey` (32 bytes): Token mint of the stock to trade.
  - `trade_direction: u8` (1 byte): `0 = BUY`, `1 = SELL`.
  - `trade_amount_usd: u64` (8 bytes): Intended trade size in USD.
  - `status: u8` (1 byte): `0 = Created`, `1 = Promised`, `2 = Validating`, `3 = Settled`, `4 = Rejected`.
  - `bump: u8` (1 byte): PDA bump seed.

### 2.5 `EvidenceAccount`
Immutable on-chain anchor recording verification results and state commitments.
- **Seeds**: `[b"evidence", promise.key().as_ref()]`
- **Fields**:
  - `evidence_id: String` (4 + 32 = 36 bytes): Record identifier.
  - `promise: Pubkey` (32 bytes): Associated `PromiseAccount` PDA.
  - `pre_state_hash: [u8; 32]` (32 bytes): Deterministic canonical SHA-256 hash of pre-trade portfolio.
  - `post_state_hash: [u8; 32]` (32 bytes): Deterministic canonical SHA-256 hash of post-trade portfolio.
  - `verification_result: u8` (1 byte): `3 = Settled`, `4 = Rejected`.
  - `failure_code: u16` (2 bytes): Machine-readable failure code if rejected.
  - `timestamp: i64` (8 bytes): Unix epoch timestamp.
  - `bump: u8` (1 byte): PDA bump seed.

---

## 3. Off-Chain Domain Data Model (`@sentinel/domain`)

### 3.1 Tokenized Asset Registry (`ASSET_REGISTRY`)
Authoritative registry defining supported tokenized equities, indices, pre-IPO stocks, and reserves:

```typescript
export interface TokenizedAssetMetadata {
  symbol: string;
  name: string;
  mintDevnet: string;
  decimals: number;
  assetClass: 'EQUITY' | 'INDEX' | 'STABLECOIN' | 'PRE_IPO';
  isStablecoin: boolean;
  isIndex?: boolean;
  basePriceUsd: number;
  colorHex: string;
  description: string;
}
```

### 3.2 Canonical PROVN Evidence Record
```typescript
export interface EvidenceRecord {
  id: string;
  agentId: string;
  promiseId: string;
  policyVersion: number;
  policyHash: string;
  intentHash: string;
  transactionSignature: string;
  preStateHash: string;
  postStateHash: string;
  verificationResult: 'SETTLED' | 'REJECTED';
  failureCode?: FailureCode;
  failureReason?: string;
  swarmSummary: SwarmVerificationSummary;
  checks: PostconditionCheckResult[];
  timestamp: number;
  isSimulation: boolean;
}
```
