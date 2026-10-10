# Sentinel CWF Quarantine State Machine

## MVP Scope
> **MVP Scope Limitation**: In this implementation, a `PortfolioVault` holds **one volatile asset + USDC cash reserve ledger**. The quarantine state machine evaluates single-asset concentration and stablecoin reserve floor against this single volatile asset position priced via an authenticated Pyth oracle feed (`PriceUpdateV2`).

---

## Trust Boundary (Honest System Architecture)
1. **Real SPL Token Custody**: Vault tokens are held in program PDA-owned SPL Token or Token-2022 accounts funded via `owner_deposit` and withdrawable via `owner_withdraw`.
2. **Mandatory Real SPL Containment Transfer**: The `recover()` instruction requires 4 canonical custody accounts (`vault_token_account`, `safe_destination_token_account`, `token_mint`, `token_program`). Omitting them fails closed with `MissingCustodyAccounts` (6045). Non-SPL programs fail closed with `InvalidTokenProgram` (6043). The program signs a `transfer_checked_signed` CPI transferring `sell_units` directly to the owner-configured `policy.safe_destination`.
3. **Bounded Token Containment & Ledger Rebalancing**: In `recover()`, excess volatile tokens are contained and transferred directly to `policy.safe_destination` via program-signed SPL `TransferChecked` CPI. The vault position ledger is updated (`amount_units -= sell_units`), reducing volatile asset exposure and restoring the relative cash reserve floor (`usdc_balance_cents` preserved, `total_value_cents` recomputed from remaining units and cash reserve). No DEX swaps or liquidation are performed.
4. **Oracle Ground Truth**: Asset benchmark prices are fetched and validated from an external, verified Pyth Network price account (`PriceUpdateV2` owned strictly by `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`). Watcher and solver fail closed if Pyth data is unavailable, unverified, or stale (> 60s).
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
       |                               v     |      |  bounded token containment)|
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
| **`recover`** *(Bounded containment)* | **Permissionless** (Any solver signer) | • `status == Quarantined`<br>• `current_slot ≤ recovery_expires_slot`<br>• `expected_nonce == vault.recovery_nonce`<br>• Verified Pyth price (`PriceUpdateV2`, age ≤ 60s, conf ≤ 200 bps)<br>• `0 < sell_units ≤ amount_units`<br>• Postconditions: `post_exposure ≤ max_single_asset_bps` AND `post_stable ≥ min_stablecoin_bps`<br>• Strict improvement: `post_exposure < pre_exposure`<br>• Oversell guard: `post_exposure ≥ max_single_asset_bps - 500` | `status = Active`<br>`pending_violation_slot = 0`<br>`quarantine_slot = 0`<br>`recovery_expires_slot = 0`<br>`recovery_nonce += 1`<br>`last_recovery_slot = current_slot`<br>`last_recovery_solver = solver.key()`<br>`amount_units -= sell_units`<br>`total_value_cents = post_total` | `RecoveryExecutedEvent(vault, solver, sell_units, 0, pre_exposure_bps, post_exposure_bps, pre_total_cents, post_total_cents, new_nonce, slot, bounty_cap_cents [SIMULATED])` |
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

---

## Explicit Limitations & Non-Claims

1. **Bounded Containment vs. DEX Liquidation**: The on-chain `recover()` instruction implements bounded token containment by transferring excess volatile tokens to the owner-configured `safe_destination`. It does **not** perform an on-chain DEX swap, liquidation auction, or conversion into stablecoins.
2. **No Value Preservation Guarantee**: Because volatile assets are physically transferred away to a safe destination without being sold on an exchange, the dollar value of the vault decreases by the valuation of the transferred units. Sentinel guarantees risk constraint compliance, not dollar capital conservation.
3. **Single Volatile Position MVP**: The current Anchor program enforces exactly one volatile asset position plus cash reserve accounting. Multi-position rebalancing is planned for subsequent milestones.
4. **Research Prototype**: Sentinel is submitted as a Devnet research prototype for CWF 2026. It has not undergone an external third-party security audit.
