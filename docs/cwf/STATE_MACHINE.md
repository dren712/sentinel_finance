# Sentinel CWF Quarantine State Machine

## MVP Scope
> **MVP Scope Limitation**: In this implementation, a `PortfolioVault` holds **one volatile asset + USDC**. The quarantine state machine evaluates single-asset concentration and stablecoin reserve floor against this single volatile asset position priced via an authenticated Pyth oracle feed (`PriceUpdateV2`).

---

## Trust Boundary (Honest System Architecture)
1. **Real SPL Token Custody**: Vault tokens are held in program PDA-owned SPL Token or Token-2022 accounts funded via `owner_deposit` and withdrawable via `owner_withdraw`.
2. **Mandatory Real SPL Containment Transfer**: The `recover()` instruction requires 4 canonical custody accounts (`vault_token_account`, `safe_destination_token_account`, `token_mint`, `token_program`). Omitting them fails closed with `MissingCustodyAccounts` (6045). Non-SPL programs fail closed with `InvalidTokenProgram` (6043). The program signs a `transfer_checked_signed` CPI transferring `sell_units` directly to the owner-configured `policy.safe_destination`.
3. **Internal Ledger Rebalancing**: Along with the physical SPL token containment transfer, `recover()` rebalances the vault's internal tracking ledger (`amount_units -= sell_units`, `usdc_balance_cents += proceeds_cents`, `total_value_cents` recomputed at verified Pyth price minus venue fee) to restore postcondition compliance.
4. **Oracle Ground Truth**: Asset benchmark prices are fetched and validated from an external, verified Pyth Network price account (`PriceUpdateV2` owned strictly by `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`). Watcher and solver fail closed if Pyth data is unavailable, unverified, or stale.
5. **Simulated Solver Bounty**: The solver incentive (`bounty_cap_cents`) is computed and emitted in `RecoveryExecutedEvent` as an informational metric; no on-chain bounty vault disbursement occurs in this milestone.

---

## State Diagram

```text
       +-------------------------------------------------------------------------+
       |                                                                         |
       |                             +----------------+                          |
       |                             |     Active     |                          |
       |                             +----------------+                          |
       |                               |     ^      ^                            |
       |  flag_violation               |     |      | recover()                  |
       |  (1st breach: pending == 0)   |     |      | (permissionless solver:    |
       |                               v     |      |  reduce-only rebalancing)  |
       |                     +-------------+ |      |                            |
       |                     |   Pending   |-+ (clears if price recovers         |
       |                     |  Violation  |    before confirm_slots)            |
       |                     +-------------+                                     |
       |                               |                                         |
       |  flag_violation               |                                         |
       |  (current_slot - pending      |                                         |
       |   >= confirm_slots)           v                                         |
       |                     +--------------------+                              |
       |                     |    Quarantined     |------------------------------+
       |                     +--------------------+                              |
       |                               |            |                            |
       |  expire_quarantine            |            | owner_release              |
       |  (permissionless:             |            | (owner only)               |
       |   current_slot > expiry)      v            |                            |
       |                     +--------------------+ |                            |
       |                     |  RecoveryExpired   | |                            |
       |                     +--------------------+ |                            |
       |                               |            |                            |
       +-------------------------------+------------+----------------------------+
```

---

## Transitions Table

| Transition / Instruction | Authorized Signer | Preconditions | State Changes | Emitted Event |
| :--- | :--- | :--- | :--- | :--- |
| **`flag_violation`** *(First breach)* | **Permissionless** (Any signer) | • `status == Active`<br>• `pending_violation_slot == 0`<br>• Verified Pyth price breaches exposure or reserve | `pending_violation_slot = current_slot`<br>Status remains `Active` | `ViolationPendingEvent(vault, slot)` |
| **`flag_violation`** *(Price recovered)* | **Permissionless** (Any signer) | • `status == Active`<br>• `pending_violation_slot != 0`<br>• Verified Pyth price passes all constraints | `pending_violation_slot = 0`<br>Status remains `Active` | `ViolationClearedEvent(vault, slot)` |
| **`flag_violation`** *(Unconfirmed)* | **Permissionless** (Any signer) | • `status == Active`<br>• `pending_violation_slot != 0`<br>• Elapsed slots `< confirm_slots`<br>• Still violated | **Fails**: `ViolationNotConfirmed` (6028)<br>No state change | *None* |
| **`flag_violation`** *(Confirmed quarantine)* | **Permissionless** (Any signer) | • `status == Active`<br>• `pending_violation_slot != 0`<br>• Elapsed slots `≥ confirm_slots`<br>• Still violated | `status = Quarantined`<br>`pending_violation_slot = 0`<br>`quarantine_slot = current_slot`<br>`recovery_expires_slot = current_slot + recovery_window_slots`<br>`recovery_nonce += 1` | `VaultQuarantinedEvent(vault, quarantine_slot, recovery_expires_slot, recovery_nonce)` |
| **`recover`** *(Reduce-only rebalancing)* | **Permissionless** (Any solver signer) | • `status == Quarantined`<br>• `current_slot ≤ recovery_expires_slot`<br>• `expected_nonce == vault.recovery_nonce`<br>• Verified Pyth price (`PriceUpdateV2`)<br>• `0 < sell_units ≤ amount_units`<br>• Value conservation: `post_total ≥ pre_total * (10000 - policy.max_recovery_cost_bps) / 10000`<br>• Postconditions: `post_exposure ≤ max_single_asset_bps` AND `post_stable ≥ min_stablecoin_bps`<br>• Strict improvement: `post_exposure < pre_exposure`<br>• Oversell guard: `post_exposure ≥ max_single_asset_bps - 500` | `status = Active`<br>`pending_violation_slot = 0`<br>`quarantine_slot = 0`<br>`recovery_expires_slot = 0`<br>`recovery_nonce += 1`<br>`last_recovery_slot = current_slot`<br>`last_recovery_solver = solver.key()`<br>`amount_units -= sell_units`<br>`usdc_balance_cents += proceeds_cents`<br>`total_value_cents = post_total` | `RecoveryExecutedEvent(vault, solver, sell_units, proceeds_cents, pre_exposure_bps, post_exposure_bps, pre_total_cents, post_total_cents, new_nonce, slot, bounty_cap_cents [SIMULATED])` |
| **`owner_release`** | **Vault Owner Only** (`Signer`) | • None (Can be called from `Active`, `Quarantined`, or `RecoveryExpired`) | `status = Active`<br>`pending_violation_slot = 0`<br>`quarantine_slot = 0`<br>`recovery_expires_slot = 0`<br>`recovery_nonce += 1` (invalidates in-flight recoveries) | `VaultReleasedEvent(vault, slot, recovery_nonce)` |
| **`expire_quarantine`** | **Permissionless** (Any signer) | • `status == Quarantined`<br>• `current_slot > recovery_expires_slot` | `status = RecoveryExpired`<br>`recovery_nonce += 1` | `QuarantineExpiredEvent(vault, slot, recovery_nonce)` |

---

## Execution Gating & Autonomous Agent Lifecycle

While the vault is in `Quarantined` or `RecoveryExpired` status:
- **`execute_guarded_trade`**: Fails closed with `VaultNotActive` (6025). Autonomous agents cannot execute trades.
- **`create_promise`**: Fails closed with `VaultNotActive` (6025). New state transition promises are rejected.
- **`reject_promise` & `record_evidence`**: Remain permitted to allow anchoring audit receipts and evidence of rejected/timed-out trade intents.

### Design Choice: Agent Regains Authority Upon Recovery
The autonomous agent is gated by `VaultNotActive` (6025) while the vault is in `Quarantined` state. Once a solver successfully executes `recover()`, the vault status atomically reverts to `Active`. Consequently, the autonomous agent automatically regains normal trading authority within policy invariants without requiring manual owner intervention.

This is an intentional design choice:
1. The solver has verified on-chain that all owner-defined postconditions (single-asset exposure cap, stablecoin floor, value conservation, and oversell guard) are fully satisfied.
2. The portfolio is returned to a provably safe, compliant state.
3. Automatically restoring the agent to `Active` avoids leaving autonomous vaults permanently paralyzed when transient market price swings or rebalances occur.

There is **no permanent freeze**: the owner can always call `owner_release` to return the vault to `Active`, or call `set_agent_active(false)` to indefinitely revoke the agent's authority.

---

## Not Yet Implemented (Out of Scope for Current Milestone)

The following capabilities are **explicitly NOT implemented** in this milestone and remain reserved for future development:

1. **Direct On-Chain DEX Swaps via CPI**: Containment transfers excess volatile tokens directly to `policy.safe_destination` via SPL `transfer_checked_signed` CPI. On-chain DEX market swaps (e.g., Jupiter / Meteora / Raydium routing during recovery) are planned for future iterations.
2. **On-Chain Token Bounty Disbursement**: While `bounty_cap_cents` is mathematically calculated and emitted in `RecoveryExecutedEvent`, direct token transfer of bounties from an escrow pool is not executed on-chain in this milestone.
3. **Permissionless Reopen from `RecoveryExpired`**: Once a vault enters `RecoveryExpired`, return to `Active` currently requires an explicit `owner_release` signed by the vault owner key.


