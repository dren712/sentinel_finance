# Sentinel Finance — CWF Disclosure & Provenance Log

## Baseline Reference
- **Baseline Commit Hash**: [`f8734ef`](https://github.com/dren712/sentinel_finance/commit/f8734ef)
- **Baseline Tag**: `stocklana-baseline`
- **Baseline Branch**: `main`
- **Stocklana Devnet Program ID**: [`3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK`](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet)
- **CWF Devnet Program ID**: [`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`](https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet)

---

## What Existed Before (Stocklana Baseline @ `f8734ef`)
1. **Anchor Smart Contract**:
   - Program ID `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` deployed on Solana Devnet.
   - Instructions: `initialize_policy`, `initialize_agent`, `initialize_vault`, `set_agent_active`, `sync_vault`, `create_promise`, `execute_guarded_trade`, `reject_promise`, `record_evidence`.
   - On-chain postconditions: Concentration cap (≤25%), stablecoin floor (≥20%), order size limit (≤$10K), and price slippage bounds.
   - PDAs: `PolicyAccount`, `AgentAccount`, `PortfolioVault`, `PromiseAccount`, `EvidenceAccount`.
   - Temporary testing harness: `post_price_update` instruction allowing mock price accounts on-chain.
2. **SDK & Runtime**:
   - `LiveExecutionAdapter` with split keys privilege separation (`OWNER` vs `AGENT`).
   - 10-stage autonomous loop with LLM draft proposal, tool execution, and reactive adaptation.
   - PROVN cryptographic evidence generator with SHA-256 state hashing.
3. **Verification & Tests**:
   - 95 passing SDK unit and adversarial security tests.
   - 16 Anchor integration tests on localnet asserting exact error codes.

---

## New in CWF (Crypto's World Fair)

| Phase | Component | Change / Feature | Git Commit / Evidence |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Infrastructure | Tagged `stocklana-baseline` (`f8734ef`), branched `cwf/main`, deployed dedicated CWF Program ID `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` to Devnet (preserving Stocklana links). | [`be93523`](https://github.com/dren712/sentinel_finance/commit/be93523) |
| **Phase A** | Oracle Security | Deleted `post_price_update` bypass; required Pyth Receiver ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`) and Full verification; added `feed_id: [u8; 32]` to `AssetPosition` (owner-set only via `sync_vault`); added errors `FeedMismatch`, `StaleOracle`, `ConfidenceTooWide`, `UnverifiedPrice`; built `scripts/make-price-fixture.mjs` with localnet fixtures; verified via 6 targeted Anchor localnet tests. | [`7714b5b`](https://github.com/dren712/sentinel_finance/commit/7714b5b) |
| **Phase B** | Quarantine Engine | Implemented Quarantine State Machine Skeleton (MVP scope: 1 volatile asset + USDC). Added `VaultStatus` (`Active`, `Quarantined`, `RecoveryExpired`), `pending_violation_slot`, `quarantine_slot`, `recovery_expires_slot`, `recovery_nonce` to `PortfolioVault`. Added `confirm_slots`, `recovery_window_slots`, `max_recovery_cost_bps`, `max_bounty_bps`, `safe_destination` to `PolicyAccount`. Implemented permissionless `flag_violation` with Pyth repricing & hysteresis, owner-only `owner_release`, and permissionless `expire_quarantine`. Gated `execute_guarded_trade` and `create_promise` to fail closed (`VaultNotActive`) when not Active. Verified via 13 Bankrun tests with slot warping and live Solana Devnet transactions (`flag_violation` -> `Quarantined` -> `owner_release`). | Verified by 13 Bankrun tests, 20 Localnet tests, 97 SDK tests, and Devnet TXs: `5TKzuF21...`, `5ATh9Gpt...`, `2tQQYGDp...` |
