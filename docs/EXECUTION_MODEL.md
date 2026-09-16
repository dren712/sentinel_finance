# Sentinel Finance — Execution Model

## 1. Complete Trade Lifecycle Pipeline

Every state transition in Sentinel Finance traverses a rigorous 6-phase pipeline before capital moves:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: INTENT CREATION                        │
│  Autonomous agent (Sentinel Robo-01) formulates TradeIntent            │
│  • Asset: NVDAx, Amount: $15,000, Direction: BUY, Reference: $120      │
│  • Detached Ed25519 signature generated over canonical intent bytes     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2: SWARM-LITE VERIFICATION                     │
│  Off-chain verifiers simulate the proposed state transition:           │
│  • RiskVerifier: Checks prospective single-equity exposure ceiling     │
│  • BalanceVerifier: Checks stablecoin reserve floor & sizing caps      │
│  • PolicyVerifier: Checks policy version staleness & slippage bounds   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 3: PROMISE ACCOUNT CREATION                    │
│  Anchor instruction create_promise allocates PromiseAccount PDA:       │
│  • Seeds: [b"promise", agent.key(), promise_id.as_bytes()]            │
│  • Binds intent parameters and locks status to PROMISED (1)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 PHASE 4: ON-CHAIN GUARDED EXECUTION                    │
│  Anchor instruction execute_guarded_trade submitted to Solana RPC:     │
│  • 8-byte discriminator: sha256("global:execute_guarded_trade")[0..8]  │
│  • 5 Accounts passed in strict Anchor sequence                         │
│  • 32-byte payload: [disc (8B), trade (8B), exec (8B), quote (8B)]    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PHASE 5: ATOMIC INVARIANT VERIFICATION                   │
│  Solana Anchor Program mutates PortfolioVault PDA ledger:              │
│  • Deducts USDC cents, credits equity units at execution price         │
│  • Recalculates total portfolio NAV in u128 integer cents              │
│  • Checks: require!(target_exposure_bps <= policy.max_single_asset)   │
│  • Checks: require!(reserve_exposure_bps >= policy.min_stablecoin)    │
│  • Checks: require!(trade_amount_cents <= policy.max_trade_cents)     │
│  • Checks: require!(slippage_bps <= policy.max_slippage_bps)          │
│                                                                        │
│  [IF ANY BREACH]: return Err(SentinelError::...)                       │
│                   ──► ATOMIC REVERT: All mutations discarded           │
│                                                                        │
│  [IF ALL PASS]:   Promise status marked SETTLED (3)                    │
│                   ──► Commit transaction on Solana                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PHASE 6: PROVN EVIDENCE ANCHOR                     │
│  Anchor instruction record_evidence allocates EvidenceAccount PDA:     │
│  • Seeds: [b"evidence", promise.key()]                                 │
│  • Stores pre_state_hash, post_state_hash, failure_code, and timestamp │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Anchor Instruction: `execute_guarded_trade`

### 2.1 Instruction Layout & Accounts Array

The Anchor program enforces exact account ownership, seeds, and mutability. The instruction requires **5 accounts in exact order**:

| Index | Account Name | Type | Mutability | Signer | Seeds / Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `promise` | `Account<PromiseAccount>` | **mut** | No | `[b"promise", agent.key(), promise_id]`, `has_one = agent`, `has_one = policy` |
| **1** | `vault` | `Account<PortfolioVault>` | **mut** | No | `[b"vault", vault.owner]`, `has_one = policy` |
| **2** | `agent` | `Account<AgentAccount>` | non-mut | No | Program account |
| **3** | `policy` | `Account<PolicyAccount>` | non-mut | No | `[b"policy", owner]` |
| **4** | `authority` | `Signer` | **mut** | **Yes** | `authority == agent.agent_authority || authority == agent.owner` |

### 2.2 Instruction Data Serialization (32 Bytes)

Anchor instructions require an 8-byte discriminator calculated from the SHA-256 hash of the instruction namespace:
```typescript
const discriminator = createHash('sha256')
  .update('global:execute_guarded_trade')
  .digest()
  .subarray(0, 8);

const instructionData = Buffer.alloc(32);
discriminator.copy(instructionData, 0);
instructionData.writeBigUInt64LE(tradeAmountCents, 8);
instructionData.writeBigUInt64LE(executionPriceCents, 16);
instructionData.writeBigUInt64LE(quotedPriceCents, 24);
```

---

## 3. Dual Execution Adapters

Sentinel implements the **Adapter Pattern** via the `ExecutionAdapter` interface:

```typescript
export interface ExecutionAdapter {
  getMode(): 'SIMULATION' | 'LIVE';
  executeTrade(intent: TradeIntent, preState: PortfolioSnapshot): Promise<ExecutionResult>;
}
```

### 3.1 `SimulatedExecutionAdapter`
- **Purpose**: Deterministic, reproducible testing, hackathon judging, and offline demonstrations.
- **Behavior**: Simulates trade settlement mathematically using exact integer arithmetic. Generates explicitly marked simulation transaction signatures (`sim_tx_${timestamp}_${rand}`).
- **Zero Hallucination**: All simulation results return `isSimulation: true` to prevent any confusion with live on-chain activity.

### 3.2 `LiveExecutionAdapter`
- **Purpose**: Production execution targeting the deployed Sentinel Anchor program on Solana Devnet or Mainnet.
- **Behavior**:
  - Connects to a Solana JSON-RPC endpoint.
  - Verifies RPC connection liveness (`getLatestBlockhash`).
  - Requires an authorized `Keypair` or connected Solana wallet signer.
  - Derives all 5 PDAs matching Anchor on-chain seeds.
  - Builds and submits a real `Transaction` containing the `execute_guarded_trade` instruction.
  - Confirms transaction with `'confirmed'` commitment level and returns genuine on-chain signature.

---

## 4. Meteora DBC Market-Quality Liquidity Primitive

In real stock trading on Solana, execution relies on automated market makers. Sentinel integrates the **Meteora Dynamic Bonding Curve (DBC)** as the market-quality verifier:

1. **Liquidity Depth Invariant**:
   - Before submitting a trade, Sentinel queries the Meteora DBC bonding curve depth.
   - If available pool liquidity is less than the required floor ($25,000 USD equivalent), Sentinel flags market quality as insufficient.
2. **Dynamic Price Deviation Invariant**:
   - Compares the DBC curve spot price against the Pyth benchmark oracle price.
   - If curve deviation exceeds the maximum allowable threshold (200 bps / 2.00%), trade execution is blocked.
