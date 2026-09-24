# Sentinel Robo — Adversarial Security Matrix (`docs/SECURITY.md`)

Sentinel's core technical proof is not just that valid trades succeed—it is that **no unauthorized, malformed, stale, or non-compliant intent can bypass the Sentinel boundary**.

Run the 11-vector adversarial suite directly:

```bash
pnpm --filter @sentinel/sdk test
```

Test implementation: [`packages/sdk/tests/adversarial-security.test.ts`](../packages/sdk/tests/adversarial-security.test.ts)

## 11-Vector Attack Matrix + 1 Positive Control

| Vector | Attack Scenario | Target Layer | Expected & Verified Outcome |
| :--- | :--- | :--- | :--- |
| **Attack 1** | Direct adapter call without a `SentinelAuthorizationTicket` | `ExecutionAdapter` | Reverts with `ERR_MISSING_SENTINEL_AUTHORIZATION` (`SecurityViolationError`) |
| **Attack 2** | Tampering with `tradeAmountUsd` (`$5,000 → $15,000`) after ticket issuance | `SHA-256 IntentHash` | Reverts with `ERR_TICKET_INTENT_HASH_MISMATCH` |
| **Attack 3** | Replay of an expired `SentinelAuthorizationTicket` (`expiresAt < now`) | `Ticket TTL Guard` | Reverts with `ERR_AUTHORIZATION_TICKET_EXPIRED` |
| **Attack 4** | Unauthorized rogue agent (`rogue-agent-99` / wrong Ed25519 signer) | `AuthorityVerifier` | Blocked (`ERR_AGENT_UNAUTHORIZED` / Anchor `6002`) |
| **Attack 5** | Concentration breach (`BUY $15,000 NVDAx`, `20% → 35% > 25%` cap) | `PolicyVerifier` | Blocked (`ERR_CONCENTRATION_LIMIT` / Anchor `6005`) |
| **Attack 6** | Reserve depletion (`BUY $8,000 AAPLx` when `USDC` drops to `17% < 20%` floor) | `SolvencyVerifier` | Blocked (`ERR_STABLECOIN_RESERVE_FLOOR` / Anchor `6006`) |
| **Attack 7** | Single-trade size breach (`BUY $12,000 > $10,000` ceiling) | `PolicyVerifier` | Blocked (`ERR_MAX_TRADE_SIZE_EXCEEDED` / Anchor `6004`) |
| **Attack 8** | Stale Pyth oracle quote (`ageSeconds = 185s > 60s` limit) | `PriceIntegrityVerifier` | Blocked (`ERR_QUOTE_STALE`) |
| **Attack 9** | Excessive Pyth confidence spread (`±$4.50` / `375 bps > 100 bps` limit) | `PriceIntegrityVerifier` | Blocked (`ERR_CONFIDENCE_TOO_WIDE`) |
| **Attack 10** | Shallow Meteora DBC pool (`$14,000 < $25,000` minimum liquidity floor) | `LiquidityVerifier` | Blocked (`ERR_INSUFFICIENT_POOL_LIQUIDITY`) |
| **Attack 11** | Emergency Pause kill-switch active (`isEmergencyPaused = true`) | `PolicyEngine` | Immediately halts execution (`ERR_EMERGENCY_PAUSE` / Anchor `6000`) |
| **Control 12** | Adapted compliant trade (`BUY $5,000 NVDAx`, `20% → 25%`, `USDC 20%`) | `Full Pipeline` | **✓ Settled** with cryptographic PROVN receipt |
