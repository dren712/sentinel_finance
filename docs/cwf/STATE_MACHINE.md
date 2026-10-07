# Sentinel CWF Quarantine State Machine

## MVP Scope
> **MVP Scope Limitation**: In this implementation, a `PortfolioVault` holds **one volatile asset + USDC**. The quarantine state machine evaluates single-asset concentration and stablecoin reserve floor against this single volatile asset position priced via an authenticated Pyth oracle feed (`PriceUpdateV2`).

---

## Trust Boundary (Honest System Architecture)
1. **Ledger-Only Settlement**: Vault balances (`usdc_balance_cents`, `amount_units`) are **owner-synced ledger values** stored inside the `PortfolioVault` PDA and written by the vault owner via `sync_vault` (or `initialize_vault`), **not** live SPL token account balances.
2. **Oracle Ground Truth**: Only asset benchmark prices are fetched and validated from an external, verified Pyth Network price account (`PriceUpdateV2` owned strictly by `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`).
3. **Demo Violation Source**: The demo policy violation is **induced by an owner ledger sync** (the owner initializes or updates the vault ledger with an asset balance that exceeds the concentration limit or breaches the stablecoin floor).
4. **Simulated Settlement**: Recovery settlement is **SIMULATED** inside the vault ledger at the verified Pyth price minus a fixed venue fee (`RECOVERY_VENUE_FEE_BPS = 30 bps`). No real SPL token transfers or DEX CPI swaps take place on-chain.

---

## State Diagram

```text
       +-------------------------------------------------------------------------+
       |                                                                         |
       |                             +----------------+                          |
       |                             |     Active     |                          |
       |                             +----------------+                          |
       |                               |            ^                            |
       |  flag_violation               |            | owner_release              |
       |  (1st breach: pending == 0)   |            | (owner only)               |
       |                               v            |                            |
       |                     +--------------------+ |                            |
       |                     |  Pending Violation |-+ (clears pending if price   |
       |                     +--------------------+    recovers before confirm)  |
       |                               |                                         |
       |  flag_violation               |                                         |
       |  (current_slot - pending      |                                         |
       |   >= confirm_slots)           v                                         |
       |                     +--------------------+                              |
       |                     |    Quarantined     |                              |
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
| **`owner_release`** | **Vault Owner Only** (`Signer`) | • None (Can be called from `Active`, `Quarantined`, or `RecoveryExpired`) | `status = Active`<br>`pending_violation_slot = 0`<br>`quarantine_slot = 0`<br>`recovery_expires_slot = 0`<br>`recovery_nonce += 1` (invalidates in-flight recoveries) | `VaultReleasedEvent(vault, slot, recovery_nonce)` |
| **`expire_quarantine`** | **Permissionless** (Any signer) | • `status == Quarantined`<br>• `current_slot > recovery_expires_slot` | `status = RecoveryExpired`<br>`recovery_nonce += 1` | `QuarantineExpiredEvent(vault, slot, recovery_nonce)` |

---

## Execution Gating

While the vault is in `Quarantined` or `RecoveryExpired` status:
- **`execute_guarded_trade`**: Fails closed with `VaultNotActive` (6025). Autonomous agents cannot execute trades.
- **`create_promise`**: Fails closed with `VaultNotActive` (6025). New state transition promises are rejected.
- **`reject_promise` & `record_evidence`**: Remain permitted to allow anchoring audit receipts and evidence of rejected/timed-out trade intents.

There is **no permanent freeze**: the owner can always call `owner_release` to return the vault to `Active`.

---

## Not Yet Implemented (Out of Scope for Current Prompt)

The following capabilities are **explicitly NOT implemented** in this milestone and will be added in subsequent prompts:

1. **`recover()`**: Solver-driven recovery swap instruction.
2. **Solver Bounty**: Automatic payout of solver incentives (`max_bounty_bps`).
3. **Value-Conservation Check**: Mathematical invariant ensuring proposed recovery rebalancing does not drain vault value beyond `max_recovery_cost_bps`.
4. **Swap CPI**: Cross-Program Invocation to decentralized exchange pools (Meteora, Jupiter, Raydium) to perform atomic on-chain asset rebalancing.
