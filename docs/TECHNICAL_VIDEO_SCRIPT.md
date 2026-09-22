# 🛠️ Sentinel Finance — Official 5-Minute Technical Video Script

> **Target Duration**: ~5 minutes (0:00 – 5:00)  
> **Audience**: Colosseum Hackathon Judges, Solana Program Auditors, Protocol Architects  
> **Format**: Live IDE Code Walkthrough + Solana Explorer + Terminal Test Execution  
> **Key Objective**: Walk through the exact Anchor account model, on-chain state transition boundary, atomic invariant enforcement, autonomous adaptation loop, and PROVN cryptographic evidence roots.

---

## ⏱️ Video Timeline Breakdown

```
[0:00 - 0:45]  1. ARCHITECTURE & SOLANA BOUNDARY: Why On-Chain Invariants?
[0:45 - 1:45]  2. ANCHOR ACCOUNT MODEL & PDAs: Policy, Agent, Promise, Vault, Evidence
[1:45 - 2:45]  3. EXECUTION PIPELINE: create_promise ➔ execute_guarded_trade ➔ Pure Rust Verifier
[2:45 - 3:45]  4. THREE-MODE REJECTION & AUTONOMOUS ADAPTATION: Agent, Market & Data
[3:45 - 4:30]  5. PROVN RECEIPT GENERATION & DEVNET VERIFICATION
[4:30 - 5:00]  6. CONCLUSION: The Institutional State Boundary
```

---

## 🎙️ Teleprompter Script with Screen Directives

---

### [0:00 – 0:45] 1. ARCHITECTURE & SOLANA BOUNDARY: Why On-Chain Invariants?

**[SCREEN RECORDING]**:
*Display `programs/sentinel/src/lib.rs` and the architectural diagram in `README.md`:*
```
AGENT INTENT ➔ SENTINEL PROMISE ➔ POST-STATE CALCULATION ➔ INVARIANT VERIFICATION ➔ BLOCK / COMMIT ➔ ADAPT ➔ PROVN
```

**[SPEAKER VOICE]**:
> "Welcome to the technical deep-dive of Sentinel Robo.
>
> In financial engineering, off-chain risk checks are advisory; on-chain state transitions are authoritative.
>
> If an autonomous AI agent has raw signing authority over a Solana wallet, it can interact with Orca, Raydium, or Meteora without constraint. By the time an external API notices a violation, the transaction is already finalized in a Solana block.
>
> Sentinel solves this by moving risk verification directly to the Solana execution boundary. The agent is strictly an unprivileged operator: it can propose trades, but the program enforces what the resulting portfolio is allowed to become before any state transition is committed."

---

### [0:45 – 1:45] 2. ANCHOR ACCOUNT MODEL & PDAs

**[SCREEN RECORDING]**:
*Open `programs/sentinel/src/state.rs` and highlight lines 18-98, showing the 5 core PDAs:*

```rust
// 1. PolicyAccount: seeds = [b"policy", owner.key()]
pub struct PolicyAccount {
    pub owner: Pubkey,
    pub max_single_asset_bps: u16,   // e.g. 2500 = 25.00%
    pub min_stablecoin_bps: u16,     // e.g. 2000 = 20.00%
    pub max_trade_value_usd: u64,    // e.g. 10000 = $10,000
    pub max_slippage_bps: u16,       // e.g. 100 = 1.00%
    pub is_active: bool,
    ...
}

// 2. PromiseAccount: seeds = [b"promise", agent.key(), promise_id]
pub struct PromiseAccount {
    pub intent_hash: [u8; 32],
    pub trade_asset_mint: Pubkey,
    pub trade_direction: u8,
    pub created_at: i64,
    pub expires_at: i64,             // Enforced 120s TTL window
    pub status: u8,                  // 1 = Promised, 2 = Validating, 3 = Settled, 4 = Rejected
    ...
}
```

**[SPEAKER VOICE]**:
> "Let's examine our Anchor account model in `programs/sentinel/src/state.rs`.
>
> We organize governance into five deterministically linked Program Derived Addresses:
>
> 1. `PolicyAccount`: Derived from `[b"policy", owner.key()]`. This is the user's sovereign risk contract. It specifies basis-point caps on single assets, reserve floors on stablecoins, trade ceilings, and slippage tolerances.
> 2. `AgentAccount`: Derived from `[b"agent", owner.key(), agent_id]`. Links the user's vault to a designated operational keypair (`agent_authority`). Crucially, this keypair has zero withdrawal authority.
> 3. `PromiseAccount`: Derived from `[b"promise", agent.key(), promise_id]`. Anchors the agent's intent hash, direction, trade amount, and an authoritative expiration timestamp (`expires_at`) with a strict 120-second TTL.
> 4. `PortfolioVault`: Derived from `[b"vault", owner.key()]`. Holds cached balances, asset positions, and total USD valuation cents.
> 5. `EvidenceAccount`: Derived from `[b"evidence", promise.key()]`. An immutable PROVN audit record containing cryptographic pre-state and post-state SHA-256 hashes."

---

### [1:45 – 2:45] 3. EXECUTION PIPELINE & THE PURE RUST VERIFIER

**[SCREEN RECORDING]**:
*Open `programs/sentinel/src/lib.rs` and highlight `execute_guarded_trade` and `verify_vault_postconditions`:*

```rust
pub fn execute_guarded_trade(
    ctx: Context<ExecuteGuardedTrade>,
    trade_amount_cents: u64,
    execution_price_cents: u64,
    quoted_price_cents: u64,
) -> Result<()> {
    // 1. Authority validation
    require!(ctx.accounts.authority.key() == agent.agent_authority, SentinelError::UnauthorizedExecution);
    // 2. Active policy & Promise TTL enforcement
    let clock = Clock::get()?;
    require!(policy.is_active, SentinelError::PolicyInactive);
    require!(promise.status == 1, SentinelError::InvalidPromiseStatus);
    require!(clock.unix_timestamp <= promise.expires_at, SentinelError::PromiseExpired);
    ...
    // 3. Postcondition Verification via Pure Function
    verify_vault_postconditions(
        &policy,
        trade_amount_cents,
        post_target_value_cents,
        post_total_value_cents,
        post_stablecoin_reserve_cents,
        quoted_price_cents,
        execution_price_cents,
    )?;
}
```

**[SPEAKER VOICE]**:
> "Here is `execute_guarded_trade` in `lib.rs`.
>
> First, Anchor validates authorization: the signer must match the registered `agent_authority`.
>
> Second, we query Solana's sysvar clock: `clock.unix_timestamp <= promise.expires_at`. If the market moved or the agent lagged beyond 120 seconds, the promise is automatically expired—eliminating stale-intent replay attacks.
>
> Third, we simulate the exact balance mutations across the vault's assets and call `verify_vault_postconditions`.
>
> Notice that `verify_vault_postconditions` is a pure function. It evaluates every constraint using 128-bit checked arithmetic:
> - Post-trade single-asset exposure $\le$ `policy.max_single_asset_bps`
> - Post-trade stablecoin reserve $\ge$ `policy.min_stablecoin_bps`
> - Executed slippage $\le$ `policy.max_slippage_bps`
>
> If any condition fails, Anchor immediately throws a typed error (`ExposureExceeded`, `StablecoinReserveBreached`, or `SlippageExceeded`). The entire transaction aborts. In Solana, an aborted transaction mutates zero state and leaves user balances completely untouched."

---

### [2:45 – 3:45] 4. THREE-MODE REJECTION & AUTONOMOUS ADAPTATION

**[SCREEN RECORDING]**:
*Switch to VS Code terminal and run `node --test tests/integration/demo-scenario.test.ts` showing all 4 scenarios passing:*

```bash
node --test tests/integration/demo-scenario.test.ts
```

*Show code in `packages/sdk/src/agent-simulator.ts`: `calculateCompliantTradeAmount` and `evaluatePostStateInvariants`.*

**[SPEAKER VOICE]**:
> "Now let's examine our Three Rejection Modes. Sentinel doesn't just evaluate the agent—it bounds the agent, the market, and the data:
>
> **Mode A: Portfolio Violation (Don't trust the Agent)**:
> In our integration test, the agent proposes `BUY NVDAx $15,000`. On a $100K portfolio, this would surge NVDA exposure to 35%—breaching the 25% ceiling—and drop USDC to 10%—breaching the 20% floor.
> Sentinel rejects the trade. The agent's autonomous loop catches `ERR_SINGLE_ASSET_EXPOSURE_EXCEEDED`, computes the exact compliant limit using `calculateCompliantTradeAmount()`, adapts its size to `$5,000`, and re-submits. The second attempt passes and settles.
>
> **Mode B: Market Context Violation (Don't trust the Market)**:
> In the Meteora DBC scenario, the agent proposes `$8,000` into a shallow bonding curve pool. The price impact is 2.8%, exceeding the user's 1.0% limit. Sentinel rejects with `ERR_SLIPPAGE_EXCEEDED`. The agent adapts along Meteora's bonding curve equation to `$2,500` and executes cleanly.
>
> **Mode C: Data Integrity Violation (Don't trust the Data)**:
> Pyth feeds use a pull model via Hermès. If an oracle quote is 140 seconds old or has an abnormally wide confidence interval, Sentinel halts execution: `NO EXECUTION: Stale Quote`. The application pulls a fresh Pyth update, verifies confidence, and only then authorizes settlement."

---

### [3:45 – 4:30] 5. PROVN RECEIPT GENERATION & DEVNET VERIFICATION

**[SCREEN RECORDING]**:
*Open the web app at `localhost:3000`, click on an Activity item, and expand the Sentinel Receipt Card:*
*Show: Intent Hash, Policy Hash, Pre-State Hash, Post-State Hash, and Solana Explorer link.*

**[SPEAKER VOICE]**:
> "When an execution settles or aborts, Sentinel issues a **PROVN Receipt**.
>
> We don't hide crypto details, nor do we create a separate siloed 'crypto feature'. Instead, PROVN is the transparent receipt of Sentinel's decision:
>
> - Tier 1 gives the investor plain English verification: 'Protected: Single asset stayed at 24.1%, reserve stayed at 22.3%'.
> - Tier 2 gives the auditor cryptographic provenance:
>   - The RFC-8785 canonical JSON Intent Hash
>   - The Policy Hash derived from the user's PDA
>   - Deterministic SHA-256 state hashes of the portfolio pre-state and post-state
>   - The on-chain Devnet transaction signature on Solana Explorer."

---

### [4:30 – 5:00] 6. CONCLUSION: THE INSTITUTIONAL STATE BOUNDARY

**[SCREEN RECORDING]**:
*Run `cargo test --manifest-path programs/sentinel/Cargo.toml --lib` in terminal:*
*All 10 unit tests pass in 0.00s.*
*Show the final summary slide: 'Sentinel Robo — Solana State-Transition Governance for AI Agents'.*

**[SPEAKER VOICE]**:
> "To summarize our technical design:
>
> 1. Real Anchor PDAs enforce policies at the state boundary.
> 2. Real SPL token balances are mutated and verified post-trade.
> 3. Meteora DBC curves, PreStocks private equities, and Pyth pull oracles act as live security gates.
> 4. Deterministic PROVN state trees link every on-chain event to client receipts.
>
> All 10 Rust Anchor tests, 39 domain tests, 44 SDK tests, and 4 end-to-end integration scenarios are passing 100% green.
>
> Thank you."
