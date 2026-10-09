# Sentinel Finance — CWF 48h Release Audit & Truth Matrix

**Audit Date**: October 10, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Product**: Sentinel — Recovery Infrastructure for Autonomous Solana Financial Strategies  
**Network**: Solana Devnet  
**Authoritative Program ID**: `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`  
**Git HEAD**: `main`

---

## 1. Executive Summary

This document provides a comprehensive, radically honest audit of the Sentinel codebase following the execution of the 48-Hour CWF Execution Plan. It details every architectural component across six distinct categories:
1. **On-Chain Real** (Authoritative SVM instructions and runtime constraints)
2. **Off-Chain Real** (Domain engine, SDK, autonomous daemons, web application)
3. **Simulation / Demo Scenarios** (Controlled sandbox inputs and informational metrics)
4. **Deliberately Excluded / Out-of-Scope** (Features omitted to preserve security and deadline integrity)
5. **Resolved Misleading / Contradictory Claims** (Audit discrepancies eliminated during hardening)
6. **Verified Automated Test Matrix** (All 195 automated tests passing with zero failures)

---

## 2. Comprehensive Truth Table

| Component / Feature | Classification | Implementation Location | Operational Mechanism & Limitations |
| :--- | :--- | :--- | :--- |
| **SPL Token & Token-2022 Custody** | **On-Chain Real** | `programs/sentinel/src/custody.rs` | Program-derived address (PDA) acts as token authority. Uses zero-dependency manual instruction packing for CPI calls (`transfer_checked_signed`). |
| **Emergency Containment Recovery** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`recover`) | Requires 4 remaining custody accounts (`[vault_ta, safe_dest_ta, mint, token_program]`). Executes CPI moving exact excess volatile tokens to `policy.safe_destination`. |
| **Pre-Trade Policy Guard** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`execute_guarded_trade`) | Reverts transactions violating single-asset exposure cap, stablecoin reserve floor, trade size limit, or slippage limits. |
| **Pyth Price Feed Verification** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`parse_and_verify_pyth_price`) | Enforces Pyth Receiver ownership (`rec5EKMG...`), `Full` verification level, exact 32-byte `feed_id` match, freshness (`<= 60s`), and confidence interval (`<= 200 bps`). |
| **Quarantine State Machine** | **On-Chain Real** | `programs/sentinel/src/lib.rs` | 2-stage hysteresis via `flag_violation` (Pending -> Quarantined over `confirm_slots`), `expire_quarantine`, and privileged `owner_release`. |
| **Policy Freeze During Quarantine** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`policy_version`) | Reverts `recover()` or trades if `policy_version` has been mutated during an active quarantine (`PolicyFrozen` 6036). |
| **Nonce & Window Expiry Protection** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`recovery_nonce`, `recovery_expires_slot`) | Prevents transaction replay; reverts if solver calls outside slot window (`RecoveryWindowClosed` 6030). |
| **Exact Token Balance Conservation** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`TokenBalanceMismatch`) | Asserts pre-balance equals post-balance plus exact transfer units, preventing token leakage or inflation. |
| **Mandatory Postcondition Verification** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`PostconditionFailed`, `OversellGuard`) | Asserts post-exposure strictly lower than pre-exposure, complies with policy cap, and prevents excessive rebalancing. |
| **Pure Solver Engine** | **Off-Chain Real** | `@sentinel/sdk/src/recovery.ts` | $O(\log N)$ binary search calculating minimal sell units to satisfy all invariants within 1ms. |
| **SDK Execution Adapter** | **Off-Chain Real** | `@sentinel/sdk/src/adapters/execution-adapter.ts` | Builds typed Anchor instructions; enforces split keys (`OWNER` vs `AGENT`); throws `MissingCustodyAccounts` if `< 4` remaining accounts. |
| **Autonomous Watcher Daemon** | **Off-Chain Real** | `scripts/watcher-daemon.mjs` | Continuous background polling; flags invariant breaches; requires funded keypair (fails closed on missing signer). |
| **Autonomous Solver Daemon** | **Off-Chain Real** | `scripts/solver-daemon.mjs` | Continuous background polling; computes optimal recovery units; executes real custody recovery; requires funded keypair. |
| **PROVN Evidence Generator** | **Off-Chain Real** | `@sentinel/domain/src/provn.ts` | Computes deterministic SHA-256 state hashes binding pre-state, intent, and post-state. |
| **Quarantine Incident Center** | **Off-Chain Real** | `apps/web/src/app/quarantine/page.tsx` | Real-time on-chain status monitoring, slot countdown, 8-state interactive recovery button, genuine Solana Explorer transaction receipts. |
| **Devnet Lab & Faucets** | **Off-Chain Real** | `apps/web/src/app/lab/page.tsx`, `apps/web/src/lib/faucet-service.ts` | Real Devnet SOL airdrop + real Devnet SPL token minting (`sUSD`, `sASSET`) with on-chain ATA funding. |
| **Solver Bounty Reward** | **Simulation** | `programs/sentinel/src/lib.rs` (`bounty_cap_cents`) | Informational metric emitted in `RecoveryExecutedEvent`. No token transfer is executed to the solver wallet. |
| **Devnet Lab Price Shock** | **Simulation** | `apps/web/src/lib/devnet-sandbox.ts` | Controlled test shock ($40.00 -> $50.00) in `/lab` to demonstrate deterministic recovery without waiting for live Pyth crash. |
| **Interactive Homepage Simulator** | **Simulation** | `apps/web/src/components/LandingView.tsx` | Visual demonstration showing $15K trade rejection and $5K adapted approval. |
| **Meteora / PreStocks Pre-Flight** | **Simulation** | `@sentinel/domain/src/market-quality.ts` | Evaluated in off-chain TypeScript filters rather than on-chain CPI swap checks. |
| **DEX Liquidation Swaps** | **Out-of-Scope** | N/A | Sentinel deliberately executes *bounded token containment* (moving tokens to `safe_destination`), not automated DEX swaps. |
| **Universal Multi-Asset Recovery** | **Out-of-Scope** | N/A | Production scope is bounded to 1 volatile asset + USDC reserve. Multiple volatile assets in a single recovery transaction is deferred. |

---

## 3. Discrepancy Reconciliation & Hardening Actions

During the audit and implementation phases, several legacy contradictions were identified and eliminated:

1. **Daemon Silent Ephemeral Keypair Generation**:
   - *Previous*: Daemons silently generated unfunded ephemeral keypairs when environment variables were missing, causing mysterious transaction failures.
   - *Resolution*: Daemons now fail loudly with a fatal configuration error unless `SOLVER_KEYPAIR`/`WATCHER_KEYPAIR` or `~/.config/solana/id.json` is provided. Ephemeral keypairs are only permitted if explicitly requested via `ALLOW_EPHEMERAL_KEYPAIR=1`.
2. **SDK Custody Remaining Accounts Enforcement**:
   - *Previous*: `ExecutionAdapter.recover()` would attempt to submit instructions without remaining accounts if resolution returned an empty array.
   - *Resolution*: Added strict check throwing `MissingCustodyAccounts` if `custodyRemainingAccounts.length < 4`.
3. **Solver Service Mode Handling**:
   - *Previous*: `mode: 'simulated'` would attempt to submit an on-chain transaction without custody accounts, failing on-chain with error 6045.
   - *Resolution*: In `simulated` mode, the solver service computes the recovery plan and marks simulated completion without broadcasting broken transactions; in `custody` mode, it strictly resolves and attaches all 4 custody accounts.
4. **Devnet Lab Ownership & Price-Source Labeling**:
   - *Previous*: Disconnected wallet state in `/lab` caused the default demo vault to display the user wallet address as owner.
   - *Resolution*: Explicitly labeled the vault as **Managed Demo Vault** owned by the Faucet Authority (`GR9Cti...`), while designating the connected wallet as the **Safe Destination** receiving recovered tokens.
   - *Resolution*: Added prominent **Controlled Scenario Input** disclosure clarifying that the $40 -> $50 price shock is a controlled test input rather than a live Pyth market crash.
5. **Homepage Restoration**:
   - *Previous*: Homepage was cluttered with redundant 6-card lifecycle rails and technical jargon.
   - *Resolution*: Restored original calm product headline (`Autonomous investing. Rigid guarantees.`) and copy, keeping `/quarantine` as the dedicated incident center and `/lab` as the developer testing environment.

---

## 4. Test Verification Summary

All test suites were executed cleanly in the local environment:

| Test Suite | Framework / Tool | Test Count | Passing | Failing |
| :--- | :--- | :---: | :---: | :---: |
| **SDK & Domain Unit Tests** | `vitest` / Node test runner | 108 | 108 | 0 |
| **Bankrun Recovery Tests** | `solana-bankrun` | 26 | 26 | 0 |
| **Bankrun Quarantine Tests** | `solana-bankrun` | 13 | 13 | 0 |
| **Localnet Integration Tests** | `@coral-xyz/anchor` | 20 | 20 | 0 |
| **Rust Program Unit Tests** | `cargo test` | 28 | 28 | 0 |
| **TOTAL** | — | **195** | **195** | **0** |

All 16 Next.js production routes compiled cleanly with 0 TypeScript or build errors (`pnpm --filter web build`).
