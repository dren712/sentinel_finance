# Sentinel Finance — Positioning & Capability Architecture

> Canonical Reference Document for Product Positioning, System Boundaries, and Claim Verification.

---

## 1. Canonical One-Liner

**"On-chain risk controls and emergency containment for autonomous financial strategies on Solana."**

---

## 2. 30-Second Product Explanation

Sentinel gives developers a policy-bound vault workflow: validate supported state changes, quarantine a vault after a confirmed supported risk breach, and constrain token transfers out of the strategy-controlled vault to an approved destination.

---

## 3. Product Architecture & Framing

| Dimension | Definition & Scope in Sentinel |
| :--- | :--- |
| **Security Problem Category** | Financial risk controls and invariant enforcement for autonomous on-chain strategies. |
| **Product Form** | Developer infrastructure for on-chain policy enforcement, quarantine lifecycle management, and SPL token containment. |
| **Technical Approach** | A reusable on-chain abstraction for supported policy checks, bounded vault-state transitions, and CPI token containment. |
| **Current Mechanism** | Program-signed SPL Token `TransferChecked` CPI moving excess volatile tokens from strategy-controlled vault PDA custody to an owner-configured `safe_destination`, coupled with on-chain hysteresis, Pyth oracle price verification, and postcondition validation. |
| **Long-Term Vision** | We aim to evolve Sentinel into a comprehensive, reusable safety and recovery layer for autonomous finance across Solana, beginning with a narrow, verifiable vault-containment primitive. |

---

## 4. Explicit Current Capability Boundary

> **Current Implementation Boundary**:
> The current prototype does not execute DEX swaps or sell contained assets. A successful containment transfer reduces assets held inside the strategy-controlled vault, but does not by itself recover lost money or guarantee that the owner's total market exposure falls.
>
> The guarded trade flow currently updates internal vault ledger accounting; it does not execute an external DEX trade settlement. The containment path performs an on-chain SPL token transfer to an owner-approved destination; it does not liquidate into cash or hedge market risk.

---

## 5. Approved vs. Disallowed Claims

### Approved Claims
- **Supported Policy Enforcement**: "Enforces owner-configured risk invariants (e.g., maximum single-asset exposure, minimum stablecoin reserve floor) for operations routed through the Sentinel program."
- **Autonomous Invariant Quarantine**: "Locks strategy execution authority into quarantine when an invariant breach is confirmed via Pyth oracle price verification."
- **Bounded Token Containment**: "Constrains SPL token transfers out of the strategy-controlled vault PDA directly to the owner's pre-approved `safe_destination`."
- **Vault-Level Exposure Reduction**: "Reduces asset concentration held within the strategy vault's internal ledger and custody account."
- **Vault-State Reactivation**: "Restores the vault to `Active` status once postconditions (exposure within bounds, stablecoin floor preserved, oversell guard respected) pass on-chain."
- **Fail-Closed Oracles**: "Rejects stale (> 60s), wide-confidence (> 200 bps), or unverified Pyth price feeds."

### Disallowed Claims
- ❌ **No DEX Swaps / Liquidation**: Do not claim "DEX rebalancing", "auto-liquidation", "sells assets for USDC", or "cash proceeds". (Containment transfers tokens; it does not sell them).
- ❌ **No Total Economic Exposure Guarantees**: Do not claim "restores owner portfolio exposure" or "reduces total economic exposure" when tokens transferred to the owner's safe destination are still held by the owner.
- ❌ **No Universal Protection**: Do not claim "mathematical guarantee against catastrophic risk", "cannot breach policy", or universal protection for arbitrary transactions that bypass the program.
- ❌ **No Enforced Value-Conservation on Containment**: Do not claim that `recover()` enforces `max_recovery_cost_bps` value conservation against realized trade proceeds (the helper exists in unit tests but is inactive on the transfer path).
- ❌ **No Active Bounties Paid**: Do not claim solvers earn bounties or fees today (bounty fields are emitted as 0 / informational).
- ❌ **No Unverified "Live" Labels**: Never present synthetic demo scenarios, controlled shock inputs, or simulation runs as live market data or live mainnet transactions.

---

## 6. Canonical Glossary

| Term | Meaning in Sentinel |
| :--- | :--- |
| **Policy Enforcement** | The program validates configured rules for supported operations and state transitions. Does not monitor or protect arbitrary transactions bypassing the program. |
| **Guarded Ledger Transition** | In the current prototype, an on-chain accounting and state transition that checks pre- and post-conditions. It is **not** an external DEX swap or trade settlement. |
| **Quarantine** | A restricted vault state in which normal agent-controlled vault operations are halted following a confirmed supported violation. |
| **Containment** | A constrained SPL token transfer from the strategy-controlled vault PDA to the policy-configured `safe_destination`, with exact balance and mint checks. It is not a sale. |
| **Vault-Level Exposure** | Exposure calculated strictly from the assets represented inside the Sentinel vault. Does not represent the owner's total portfolio or economic exposure. |
| **Vault-State Recovery** | Returning the vault to an operational (`Active`) state after on-chain postconditions pass. Qualify as *vault-state recovery* to prevent confusion with financial recovery. |
| **Simulation** | An off-chain or sandbox evaluation modeling state transitions under controlled or synthetic parameters. Stamped explicitly with provenance. |
| **Verified On-Chain** | Backed by a confirmed transaction signature and independently verified decoded account state from the Solana blockchain. |

---

## 7. Customer & Business Model Hypotheses

> [!NOTE]
> The following items represent hypotheses to be validated through builder feedback and live developer adoption, not validated facts.

- **Target Customer Hypothesis**: Developers and operators of autonomous Solana financial strategies (AI trading agents, automated yield vaults, algorithmic liquidity provision) who need deterministic safety bounds against prompt injection, model drift, or strategy failure.
- **Problem Hypothesis**: Strategy developers want autonomous agents to trade actively but cannot safely grant unrestricted vault signing authority without deterministic on-chain risk guardrails.
- **Value Proposition Hypothesis**: Providing a policy-bound vault with autonomous quarantine and emergency containment increases depositor trust and allows agents to operate with bounded downside.
- **Business Model Hypothesis**: Infrastructure licensing, protocol integration fees, or transaction micro-fees on policy-guarded actions and containment routing.

---

## 8. Investor & Judge FAQ

### Q1: Is Sentinel a security product or an abstraction layer?
**A:** Sentinel is on-chain risk-control and emergency-containment infrastructure. It acts as a deterministic policy wrapper around vault state, ensuring that even if an autonomous strategy or agent attempts an invalid state transition or suffers market drift, the vault is quarantined and excess assets can be contained to a safe destination.

### Q2: What does "recovery" mean in the current Sentinel implementation?
**A:** In the current implementation, "recovery" refers strictly to **vault-state recovery** and **asset containment**. The program transfers excess volatile tokens from the strategy-controlled vault PDA to an owner-approved safe destination and restores the vault's on-chain status from `Quarantined` back to `Active`. It does **not** mean recovering lost capital or reversing market losses.

### Q3: Does Sentinel execute DEX trades or sell contained assets?
**A:** No. The current prototype does not execute DEX swaps, market orders, or token sales. The guarded trade flow updates internal vault accounting under invariant checks, and the containment flow transfers SPL tokens directly to the safe destination. External DEX liquidations are planned for subsequent milestones.

### Q4: Does containment reduce the owner's total market exposure?
**A:** Not necessarily. Containment transfers volatile tokens from the strategy-controlled vault to the owner's safe destination (e.g., cold wallet or multisig). This reduces the *vault's* exposure and deprives the autonomous agent of custody over those tokens, but because the owner still holds the transferred tokens, their aggregate economic exposure to the asset remains unchanged unless they sell them separately.

### Q5: What is actually running and verified on-chain today?
**A:** 
1. An Anchor smart contract deployed at `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`.
2. On-chain policy registration and versioning with owner-controlled updates.
3. Vault lifecycle state machine (`Active` → `Quarantined` → `Active` / `RecoveryExpired`).
4. Two-stage hysteresis violation detection with Pyth oracle verification.
5. Real SPL Token / Token-2022 program-signed CPI `TransferChecked` from vault custody to `safe_destination`.
6. Strict postcondition enforcement (exposure caps, stablecoin floor preservation, oversell guard).
