# Sentinel Finance — Security Model & Invariant Guarantees

## 1. Threat Model & Security Philosophy

The traditional delegation paradigm in decentralized finance forces a dangerous compromise:
- **Full Custody / Free Delegation**: An autonomous agent receives unrestricted authority to trade. If the model drifts, hallucinates, or suffers prompt injection, it can drain liquidity, dump assets into illiquid pools, or take 100% concentrated exposure.
- **Micro-Approval / Manual Friction**: Requiring the human user to approve every transaction defeats the core purpose of autonomous AI investing.

**Sentinel's Guarantee**:
> **Delegation without loss of control.**
> The autonomous agent operates freely within a mathematically bounded state space. The on-chain Solana Anchor program authoritatively enforces financial postconditions at the transaction boundary. Even if the agent model is entirely compromised or hallucinates wildly, it **cannot commit any state transition that breaches the user's policy invariants**.

---

## 2. Threat Vector Analysis & Mitigations

| Threat Vector | Attack Scenario | Sentinel Mitigation Layer | On-Chain Failure Code |
| :--- | :--- | :--- | :--- |
| **Model Concentration Drift** | Agent hallucinates or chases a momentum spike, attempting to allocate 40% of the portfolio into a single volatile equity. | Anchor program mutates vault ledger and recalculates position weight in `u128`. If `target_bps > policy.max_single_asset_bps`, the instruction aborts immediately. | `ERR_EXPOSURE_EXCEEDED` (`SentinelError::ExposureCeilingExceeded`) |
| **Cash Reserve Depletion** | High-frequency trading attempts drain USDC reserves to 5%, leaving the portfolio vulnerable to liquidity crunches. | Anchor program verifies `reserve_bps >= policy.min_stablecoin_bps`. If USDC falls below the floor, the instruction reverts. | `ERR_STABLECOIN_RESERVE_BREACHED` (`SentinelError::ReserveFloorBreached`) |
| **Runaway Sizing Attack** | Compromised agent attempts to dump the entire portfolio ($100k) in a single massive market order. | Invariant C checks `trade_amount_cents <= policy.max_trade_value_usd * 100`. Any oversized order is rejected. | `ERR_TRADE_SIZE_EXCEEDED` (`SentinelError::TradeSizeExceeded`) |
| **MEV Sandwich & Illiquid Slippage** | Searchers sandwich a stock swap, or agent trades into an illiquid AMM pool suffering 5% slippage. | Invariant D computes `\|exec - quoted\| * 10,000 / quoted` in `u128`. If slippage > `max_slippage_bps` (e.g. 100 bps), transaction reverts atomically. | `ERR_SLIPPAGE_EXCEEDED` (`SentinelError::SlippageExceeded`) |
| **Stale Policy Exploitation** | Agent tries executing an intent generated under an old, looser policy after the user tightened their invariants. | Promise and Vault accounts enforce `has_one = policy`, and the program verifies `policy.is_active` and policy version freshness. | `ERR_STALE_POLICY` (`SentinelError::PolicyInactive`) |
| **Agent Key Compromise** | An attacker steals the agent's operational ClawPump keypair. | The agent keypair **does not have withdrawal authority**. It can only invoke `execute_guarded_trade`, which strictly bounds all mutations to the user's on-chain policy. Zero capital can be stolen. | `SentinelError::UnauthorizedExecution` (if attempting non-trade calls) |

---

## 3. Mathematical Precision & Invariant Verification Rules

1. **Strict Integer Basis-Point Arithmetic**:
   All portfolio ratios are computed in basis points ($1 \text{ bp} = 0.01\%$, $10,000 \text{ bps} = 100.00\%$). Floating-point arithmetic is strictly prohibited in both the Anchor program and the domain policy engine.

2. **Checked Arithmetic & Overflow Guards**:
   All mathematical calculations in Rust use Anchor/Rust checked operators (`checked_mul`, `checked_div`, `checked_add`, `checked_sub`). Any overflow or divide-by-zero immediately returns `SentinelError::MathOverflow`.

3. **Atomic Rollback Guarantee**:
   Solana transactions are atomic. When `execute_guarded_trade` returns `Err(...)`:
   - All balance updates inside `PortfolioVault` are discarded by the Solana runtime.
   - Zero SPL tokens or USDC are transferred.
   - The user's capital is 100% preserved.

---

## 4. Cryptographic Proof of Transition (PROVN)

Every accepted or rejected decision cycle produces an immutable cryptographic record:

```text
Intent Hash     = SHA-256(canonical_json(intent))
Pre-State Hash  = SHA-256(canonical_json(preState))
Post-State Hash = SHA-256(canonical_json(postState))
Policy Hash     = SHA-256(canonical_json(policy, version))
```

- **Deterministic Serialization**: Object keys are recursively sorted lexicographically to produce identical byte streams regardless of language or runtime.
- **Ed25519 Signatures**: The agent signs the canonical intent bytes using its dedicated keypair, providing cryptographic non-repudiation.
- **On-Chain Evidence Account**: The `record_evidence` instruction anchors the state commitment hashes and the machine-readable verdict on Solana Devnet.
