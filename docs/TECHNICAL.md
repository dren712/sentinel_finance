# Sentinel Robo — Technical Architecture & State-Transition Boundary

## 1. Why Solana: The State-Transition Boundary

Autonomous AI agents operate in probabilistic space: they ingest signals, reason over portfolios, and propose actions. Financial custody, however, requires deterministic guarantees. Prompt guardrails and off-chain wrappers fail whenever an LLM hallucinates, miscalculates portfolio headroom, or acts on stale oracle quotes.

Sentinel places an **atomic state-transition boundary** between the autonomous agent (`Robo-01`) and capital execution on Solana:

1. **Deterministic Account Locking**: Every portfolio invariant (`PolicyAccount`), vault balance state (`VaultAccount`), agent mandate (`AgentAccount`), and trade commitment (`PromiseAccount`) lives in deterministic Program Derived Addresses (PDAs) owned by the Sentinel Anchor program (`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`).
2. **Pre-State vs. Post-State Invariant Verification**: Sentinel evaluates the *resulting portfolio state* (`post_state`) before any state transition commits. If any single invariant fails (`Concentration > 25%`, `USDC Reserve < 20%`, `Pre-IPO Exposure > 20%`, `Trade Size > $10K`, `Pyth Quote Age > 60s`), the transaction reverts atomically (`0` tokens moved).
3. **Structured Error Feedback for Reactive Adaptation**: Anchor error codes (`6000`–`6009`) and SDK postcondition diagnostics return the exact mathematical headroom (`maxCompliantAmountUsd`) so the agent can adapt (`$15,000 → $5,000`) and settle within the same decision cycle.

---

## 2. Current Devnet vs. Target Production Architecture

To ensure technical accuracy for code reviewers and judges, Sentinel explicitly separates what executes on **Current Devnet** from the **Target Production Architecture**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         CURRENT DEVNET (LIVE)                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Browser Wallet / Next.js BFF                                            │
│   ├─ Browser RPC (NEXT_PUBLIC_SOLANA_RPC): Wallet balances & signing    │
│   ├─ Server RPC (SOLANA_RPC_URL): Agent execution & PDA reconciliation  │
│   ├─ PythLivePriceProvider ➔ Hermes v2 REST (Live price/conf/age)       │
│   ├─ PreStocksApiClient ➔ Server-side Pre-IPO 409A NAV registry         │
│   └─ MeteoraDBCMarketQualityVerifier ➔ Deterministic pool PDA & guard   │
│                                                                         │
│ Solana Devnet Anchor Program (3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK)
│   ├─ PolicyAccount PDA    (initialize_policy / update_policy)           │
│   ├─ AgentAccount PDA     (initialize_agent)                            │
│   ├─ VaultAccount PDA     (initialize_vault / sync_vault)               │
│   ├─ PromiseAccount PDA   (create_promise)                              │
│   ├─ Trade Execution      (execute_trade — enforces postconditions &    │
│   │                        mutates VaultAccount PDA state on-chain)     │
│   └─ EvidenceAccount PDA  (record_evidence — anchors SHA-256 receipt)   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    TARGET PRODUCTION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Direct On-Chain CPI Settlement                                          │
│   └─ Sentinel `execute_trade` invokes Meteora DBC / PreStocks secondary │
│      vault swap via Cross-Program Invocation (CPI) and verifies actual  │
│      SPL token vault balance deltas post-CPI in the same instruction.   │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Important Note on Devnet Settlement**: On Current Devnet, `execute_trade` executes a real Anchor instruction on Solana Devnet that verifies all `PolicyAccount` and `VaultAccount` invariants on-chain and mutates `VaultAccount` + `PromiseAccount` state, after the SDK verifies Meteora DBC pool quality and Pyth Hermes oracle freshness pre-trade. It does **not** perform a live SPL token CPI swap into a Meteora pool on Devnet.

---

## 3. On-Chain Anchor Instruction Lifecycle

The deployed Anchor program (`programs/sentinel/src/lib.rs`) exposes six core instructions:

1. **`initialize_policy` / `update_policy`**:
   - **Signer**: Portfolio Owner Wallet (never signed by the backend server).
   - **State**: Writes `max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`, `max_slippage_bps`, `policy_version`, and `is_active` to `PolicyAccount` (`["policy", owner]`).
2. **`initialize_agent`**:
   - **Signer**: Portfolio Owner Wallet.
   - **State**: Binds `agent_id` (`"robo-01"`) and `agent_signer` public key to `AgentAccount` (`["agent", owner, agent_id]`).
3. **`initialize_vault` / `sync_vault`**:
   - **Signer**: Portfolio Owner / Authorized Signer.
   - **State**: Synchronizes `total_value_usd`, `stablecoin_value_usd`, and per-asset valuations inside `VaultAccount` (`["vault", owner]`).
4. **`create_promise`**:
   - **Signer**: Delegated Agent Signer (`Robo-01`).
   - **State**: Commits `intent_hash`, `policy_hash`, `pre_state_hash`, `proposed_post_state_hash`, `asset_symbol`, `trade_amount_usd`, and `is_buy` into `PromiseAccount` (`["promise", vault, promise_id]`).
5. **`execute_trade`**:
   - **Signer**: Delegated Agent Signer (`Robo-01`).
   - **Verification**: Asserts `policy.is_active`, `agent.is_authorized`, `agent.agent_signer == signer`, `trade_amount_usd <= max_trade_value_usd`, `post_asset_bps <= max_single_asset_bps`, and `post_stablecoin_bps >= min_stablecoin_bps`.
   - **Outcome**: If any check fails, returns `SentinelError` (`6000`–`6009`) and aborts atomically. If all checks pass, updates `VaultAccount` balances and marks `PromiseAccount.status = Executed`.
6. **`record_evidence`**:
   - **Signer**: Delegated Agent Signer (`Robo-01`).
   - **State**: Anchors the 32-byte SHA-256 `evidence_hash` (`sha256(intent_hash || policy_hash || pre_state_hash || post_state_hash)`) in `EvidenceAccount` (`["evidence", promise]`).

---

## 4. PROVN Cryptographic Evidence Specification

Every decision cycle (both `REJECTED` and `SETTLED`) produces a deterministic PROVN receipt:

$$\text{EvidenceHash} = \text{SHA-256}\left(\text{IntentHash} \parallel \text{PolicyHash} \parallel \text{PreStateHash} \parallel \text{PostStateHash}\right)$$

- **Postgres Read Index (`evidence_index`)**: Stores the full JSON receipt and hashes for sub-millisecond query lookup via `GET /api/evidence/:id`.
- **Solana Verification**: Verifies the transaction signature and `EvidenceAccount` / `PolicyAccount` PDAs directly against Solana Devnet (`SOLANA_RPC_URL`).
