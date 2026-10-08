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
| **Phase A** | Oracle Security | Deleted `post_price_update` bypass; required Pyth Receiver ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`) and Full verification; added `feed_id: [u8; 32]` to `AssetPosition` (owner-set only via `sync_vault`); added errors `FeedMismatch`, `StaleOracle`, `ConfidenceTooWide`, `UnverifiedPrice`; built `scripts/make-price-fixture.mjs` with localnet fixtures; verified via 6 targeted Anchor localnet tests. | [`d8451d5`](https://github.com/dren712/sentinel_finance/commit/d8451d5) |
| **Phase B** | Quarantine Engine | Implemented Quarantine State Machine Skeleton (MVP scope: 1 volatile asset + USDC). Added `VaultStatus` (`Active`, `Quarantined`, `RecoveryExpired`), `pending_violation_slot`, `quarantine_slot`, `recovery_expires_slot`, `recovery_nonce` to `PortfolioVault`. Added `confirm_slots`, `recovery_window_slots`, `max_recovery_cost_bps`, `max_bounty_bps`, `safe_destination` to `PolicyAccount`. Implemented permissionless `flag_violation` with Pyth repricing & hysteresis, owner-only `owner_release`, and permissionless `expire_quarantine`. Gated `execute_guarded_trade` and `create_promise` to fail closed (`VaultNotActive`) when not Active. Verified via 13 Bankrun tests with slot warping and live Solana Devnet transactions (`flag_violation` -> `Quarantined` -> `owner_release`). | [`900f80c`](https://github.com/dren712/sentinel_finance/commit/900f80c) |
| **Phase C** | Solver Recovery Loop | Implemented permissionless, reduce-only `recover(sell_units, expected_nonce)` instruction with value conservation (`max_recovery_cost_bps`), oversell guard (`OVERSELL_BAND_BPS = 500`), and strict improvement checks. Restores vault status to `Active` and updates recovery nonce and audit fields. Added 28 Cargo unittests, 17 Bankrun slot-warped test cases covering all edge and failure cases, regenerated IDL, updated `@sentinel/sdk` client and event decoders, upgraded Devnet program `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`, executed live Devnet flow (`sync_vault` -> `flag` -> `quarantine` -> `recover` -> `Active`), and saved evidence to `docs/cwf/devnet-evidence.json`. | [`efe194f`](https://github.com/dren712/sentinel_finance/commit/efe194f), [`67ca828`](https://github.com/dren712/sentinel_finance/commit/67ca828), [`42e9f23`](https://github.com/dren712/sentinel_finance/commit/42e9f23) |
| **Phase D** | Minimal Quarantine UI | Built standalone Next.js `/quarantine` web page rendering real on-chain vault status badge (`Active` / `Quarantined` / `RecoveryExpired`), single-asset exposure vs policy cap, recovery window slots remaining, exact program error names on failure, and an authoritative transaction timeline with Solana Explorer links. Prominently labeled with honest trust boundary: *"Ledger-based vault. Simulated settlement."* | [`14a8387`](https://github.com/dren712/sentinel_finance/commit/14a8387) |
| **Phase E** | Program ID & IDL Truth | Canonicalized IDL error decoding from `SENTINEL_IDL` in `LiveExecutionAdapter`, reconciled CWF Program ID `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` across client adapters and tests, and created comprehensive CWF architecture audit. | [`89e5af1`](https://github.com/dren712/sentinel_finance/commit/89e5af1) |
| **Phase F** | Protocol Invariant Hardening | Enforced policy freeze during active quarantine (`PolicyFrozen` 6036), strictly bound multi-asset validation to exact non-index position model (`MultipleVolatileAssetsUnsupported` 6037), and added safe error fallbacks for malformed accounts. | [`1164c46`](https://github.com/dren712/sentinel_finance/commit/1164c46) |
| **Phase G** | Real SPL Custody & Containment | Built zero-dependency SPL Token & Token-2022 CPI custody module (`programs/sentinel/src/custody.rs`). Added `owner_deposit` and `owner_withdraw` for vault PDA token management. Integrated emergency containment transfer in `recover()` sending exact excess tokens to `policy.safe_destination` via `transfer_checked`. Verified exact token conservation across 9 new Bankrun tests (26 Bankrun recovery tests total). | [`0b28bf9`](https://github.com/dren712/sentinel_finance/commit/0b28bf9) |
| **Phase H** | Pure Solver Engine | Built mathematical recovery solver `requiredRecoveryUnits` in `@sentinel/sdk/src/recovery.ts`. Solves minimal integer units required across concentration limits, stablecoin floor, risk reduction, and oversell bounds without heuristics; updated `/quarantine` UI. Verified by 4 unit tests. | [`0a5eea4`](https://github.com/dren712/sentinel_finance/commit/0a5eea4) |
| **Phase I** | Autonomous Daemons | Implemented `SentinelWatcherService` and `SentinelSolverService` in `@sentinel/sdk` and created standalone Node.js CLI runners `scripts/watcher-daemon.mjs` and `scripts/solver-daemon.mjs` with continuous RPC polling lifecycles. | [`5f31a6b`](https://github.com/dren712/sentinel_finance/commit/5f31a6b) |
| **Phase J** | Mandatory Custody & UI/UX | Eliminated simulated fallback branch in `recover()`, enforcing mandatory SPL token custody containment transfer (`MissingCustodyAccounts` 6045); allowlisted SPL Token & Token-2022 program IDs; enforced deposit mint tracking (`UntrackedDepositMint` 6046); wired `resolveRecoveryCustodyAccounts` into SDK solver and `/quarantine` web UI; implemented 8-state interactive recovery button and slot countdown timer; added dynamic header status indicator (`WATCHING` vs `QUARANTINED`); elevated hero copy to "AUTONOMOUS CAPITAL. RECOVERABLE BY DESIGN." with 6-stage Hero State Rail; and removed all simulated fallback signatures, fake slots, and synthetic metrics from receipt cards. | [`8c0b126`](https://github.com/dren712/sentinel_finance/commit/8c0b126) |
| **Phase K** | Protocol Integrity & Forensic UI | Replaced linear loop in recovery solver with $O(\log N)$ binary search solving $10^{11}$ units in < 1ms; enforced fail-closed oracle handling in watcher & solver (no stale cached price fallback); added dual invariant monitoring (exposure cap + stable reserve floor); defaulted solver daemon to custody mode; updated `LiveExecutionAdapter.recover()` to resolve and append canonical custody accounts; added `recompute_total_value` across vault lifecycle; upgraded `/quarantine` with 1000ms polling, live Pyth verification card, Anchor event decoding, and forensic custody containment recovery receipts with zero fake metrics. 147 automated tests passing. | Working Tree / Current Head |



