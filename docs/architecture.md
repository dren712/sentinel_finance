# Sentinel Finance — Architecture Specification

## 1. System Overview

Sentinel Finance is an autonomous robo-portfolio for tokenized equities on Solana that enforces user-defined financial postconditions at the transaction / state-transition layer.

### Core Mechanism: Controlled Autonomy
Delegating portfolio management to an autonomous agent creates a fundamental trust problem:
- **Authorization Layer**: Tells an autonomous agent what instructions it may attempt.
- **Sentinel Promise Layer**: Verifies whether the resulting financial state satisfies the user's explicit guarantees before commit.

```text
USER / WALLET
      │
      ▼
CONNECT & DEFINE FINANCIAL POLICY (PolicyAccount PDA)
      │
      ▼
AUTONOMOUS AGENT (ClawPump Identity / AgentAccount PDA)
      │
      ▼
TRADE INTENT (Direction, Asset, Amount, Rationale)
      │
      ▼
PROMISE COMMITMENT (PromiseAccount PDA)
      │
      ▼
PTA (Postcondition-Transaction-Acceptance) ENGINE
      │
      ├── 1. Max Single-Asset Exposure Check (BPS)
      ├── 2. Min Stablecoin Reserve Floor Check (BPS)
      ├── 3. Max Trade Sizing Limit Check (USD)
      └── 4. Max Price Slippage Tolerance (BPS)
      │
      ├── PASS ────► COMMIT TRANSACTION (Status: SETTLED)
      │
      └── FAIL ────► ATOMIC ABORT (Status: REJECTED, State Preserved)
      │
      ▼
PROVN EVIDENCE LAYER (Immutable Cryptographic Anchor)
```

---

## 2. On-Chain Program Accounts (Anchor)

Program ID: `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`

### 2.1 `AgentAccount`
Seeds: `[b"agent", owner.key().as_ref(), agent_id.as_bytes()]`
- `owner: Pubkey`: User controller key
- `agent_authority: Pubkey`: Dedicated autonomous wallet keypair
- `agent_id: String`: Unique agent identifier
- `portfolio_id: String`: Associated portfolio reference
- `is_active: bool`: Emergency pause status
- `bump: u8`

### 2.2 `PolicyAccount`
Seeds: `[b"policy", owner.key().as_ref()]`
- `owner: Pubkey`: User authority key
- `max_single_asset_bps: u16`: Maximum single equity exposure (e.g. `2500` for 25.00%)
- `min_stablecoin_bps: u16`: Minimum stablecoin reserve (e.g. `2000` for 20.00%)
- `max_trade_value_usd: u64`: Maximum single trade value (e.g. `10000` for $10,000)
- `max_slippage_bps: u16`: Maximum slippage tolerance (e.g. `100` for 1.00%)
- `policy_version: u32`: Increments on each update to reject stale policies
- `is_active: bool`
- `bump: u8`

### 2.3 `PromiseAccount`
Seeds: `[b"promise", agent.key().as_ref(), promise_id.as_bytes()]`
- `promise_id: String`: Deterministic identifier
- `agent: Pubkey`: Agent account reference
- `policy: Pubkey`: Policy account reference
- `intent_hash: [u8; 32]`: SHA-256 hash of proposed trade intent
- `trade_asset_mint: Pubkey`: SPL Token Mint of the stock
- `trade_direction: u8`: 0 = BUY, 1 = SELL
- `trade_amount_usd: u64`: Intended volume in USD
- `status: u8`: 0 = Created, 1 = Promised, 2 = Validating, 3 = Settled, 4 = Rejected
- `bump: u8`

### 2.4 `EvidenceAccount`
Seeds: `[b"evidence", promise.key().as_ref()]`
- `evidence_id: String`: Unique record identifier
- `promise: Pubkey`: Promise account reference
- `pre_state_hash: [u8; 32]`: SHA-256 state commitment before action
- `post_state_hash: [u8; 32]`: SHA-256 state commitment after action
- `verification_result: u8`: 3 = Settled, 4 = Rejected
- `failure_code: u16`: Specific reason code on rejection
- `timestamp: i64`: Unix timestamp
- `bump: u8`

---

## 3. PTA State Machine

```text
  CREATED
     │
     ▼
  PROMISED (Locked to specific trade parameters)
     │
     ▼
  VALIDATING (Integer postcondition evaluation)
     │
     ├──────── ALL PASS ────────► SETTLED (Committed to ledger)
     │
     └──────── ANY FAIL ────────► REJECTED (Atomic abort)
```

---

## 4. PROVN Cryptographic Evidence Layer

Every decision evaluates deterministic canonical hashes:
- `preStateHash = SHA-256(canonical(preState))`
- `postStateHash = SHA-256(canonical(postState))`
- `intentHash = SHA-256(canonical(intent))`
- `policyHash = SHA-256(canonical(policy, version))`

If rejected, the transaction signature records `TRANSACTION_ABORTED_ON_CHAIN_REJECTION` and binds the failure code (`ERR_EXPOSURE_EXCEEDED`, `ERR_STABLECOIN_RESERVE_BREACHED`, `ERR_TRADE_SIZE_EXCEEDED`).

---

## 5. SWARM-Lite Verification Architecture

Three independent verifier modules run concurrently:
1. **`RiskVerifier`**: Analyzes single-asset exposure ceiling and portfolio concentration risk.
2. **`BalanceVerifier`**: Analyzes stablecoin reserve floor, trade sizing limits, and solvency.
3. **`PolicyVerifier`**: Analyzes policy freshness, active status, and slippage tolerances.
