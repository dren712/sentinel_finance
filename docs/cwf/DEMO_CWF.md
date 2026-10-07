# Sentinel Finance — CWF 90-Second Demo Script

## Overview & Demo Objective
Demonstrate the complete Sentinel CWF safety loop on Solana Devnet:
**Active Vault** ➔ **Policy Breach** ➔ **Hysteresis Flag** ➔ **Quarantine Lockout (Agent Blocked)** ➔ **Permissionless Solver Recovery** ➔ **Active Again**.

---

## 90-Second Script & On-Screen Timeline

### 0:00 – 0:15 | Intro & Compliant Active Vault
- **Action**: Open web browser at `/quarantine` (or run CLI inspector).
- **On-Screen**:
  - Show the vault status badge: `ACTIVE` (Emerald).
  - Show policy risk bounds: Max Single-Asset Cap = `25.00%`, Min Stablecoin Floor = `20.00%`.
  - Highlight the honest label: *"Ledger-based vault. Simulated settlement."*
- **Spoken / Voiceover**:
  *"Sentinel provides an autonomous execution firewall for AI agents on Solana. The portfolio is currently Active and fully compliant with owner-defined risk bounds: 20% ETH exposure against a 25% cap."*

### 0:15 – 0:35 | Invariant Violation & Flagging (Pending)
- **Action**: In terminal, run the sync step inducing an invariant breach:
  ```bash
  # Induces concentration violation: 100 units ETH @ ~$2,568 vs $100 USDC (>99% exposure)
  node -e "/* owner calls sync_vault with 100 units of volatile asset */"
  ```
  Or run the live demonstration script:
  ```bash
  node scripts/devnet-recovery-flow.mjs
  ```
- **On-Screen**:
  - Vault exposure spikes to `99.96%`, breaching the `25.00%` cap.
  - Watcher triggers `flag_violation` transaction #1.
  - Vault status transitions to `PENDING CONFIRMATION`.
- **Spoken / Voiceover**:
  *"An unmanaged asset influx or price movement pushes asset concentration to 99%, violating the owner's 25% invariant. Any external watcher permissionlessly flags the breach on-chain, initiating a 2-slot hysteresis confirmation window."*

### 0:35 – 0:55 | Quarantine & Agent Lockout
- **Action**: Advance slots past `confirm_slots = 2` and trigger flag transaction #2.
- **On-Screen**:
  - Status badge turns red: `QUARANTINED`.
  - Recovery window starts: `100 slots remaining`.
  - Show autonomous agent trade attempt failing closed:
    ```
    AnchorError: Error Code: VaultNotActive (6025). Error Message: Vault is not in active state.
    ```
- **Spoken / Voiceover**:
  *"Once hysteresis confirms the breach, the vault is atomically Quarantined. The AI trading agent is immediately locked out with on-chain error code VaultNotActive. The agent cannot drain collateral or take on further risk."*

### 0:55 – 1:15 | Permissionless Solver Recovery (Reduce-Only)
- **Action**: Connect solver wallet on `/quarantine` and click **"Execute Reduce-Only Recovery"** (or execute CLI `recover` step).
  ```bash
  # Solver executes reduce-only rebalance of 78 units
  # Enforces Pyth oracle verification, value conservation (<500 bps), and oversell guard
  ```
- **On-Screen**:
  - Solver transaction submits `recover(78, nonce: 1)` with Pyth price account `GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i`.
  - Transaction confirms on Devnet.
  - Vault exposure drops to `22.04%` (within the allowed 20–25% postcondition band).
- **Spoken / Voiceover**:
  *"Now an open market solver executes a permissionless reduce-only recovery. The contract validates the Pyth oracle price, verifies value conservation within 5%, and enforces an oversell guard to prevent dumping. 78 units are liquidated into USDC inside the vault ledger."*

### 1:15 – 1:30 | Safe Resumption & Verification
- **Action**: View updated on-chain status and timeline on `/quarantine`.
- **On-Screen**:
  - Status badge returns to `ACTIVE`.
  - Recovery Nonce increments to `2` (preventing replay).
  - Transaction timeline displays all 6 verified Devnet transactions with clickable Solana Explorer links.
  - Agent trade test succeeds again.
- **Spoken / Voiceover**:
  *"The vault is restored to Active, the replay nonce increments, and the agent safely resumes normal trading within policy invariants. Full verifiable evidence is anchored on Solana Devnet."*

---

## Exact Commands Reference

To execute the entire automated flow live on Solana Devnet:
```bash
# 1. Run the authoritative on-chain recovery lifecycle
node scripts/devnet-recovery-flow.mjs

# 2. Inspect confirmed transaction signatures on Devnet
solana confirm -v 2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ --url devnet
solana confirm -v 2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob --url devnet

# 3. Launch the local web interface
pnpm --filter @sentinel/web dev
# Navigate to: http://localhost:3000/quarantine
```

---

## Fallback Clip Plan (Network / RPC Latency Contingency)

If Solana Devnet experiences RPC rate limiting or block drop during live judging:

1. **Clip 1 (0:00 – 0:25): Initial Compliant State & Violation Flag**
   - *Backup file*: `docs/cwf/media/clip1-flag-pending.mp4`
   - *Static proof*: Devnet TX [`5vSfX1eq...`](https://explorer.solana.com/tx/5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf?cluster=devnet)

2. **Clip 2 (0:25 – 0:50): Quarantine Transition & Agent Lockout Assertion**
   - *Backup file*: `docs/cwf/media/clip2-quarantine-lockout.mp4`
   - *Static proof*: Devnet TX [`PDw3zefC...`](https://explorer.solana.com/tx/PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoPrFxrY5sSaJRHWhChJ6qpE?cluster=devnet) and Bankrun test assertion `6025 (VaultNotActive)`.

3. **Clip 3 (0:50 – 1:30): Solver Recovery & Return to Active State**
   - *Backup file*: `docs/cwf/media/clip3-recovery-active.mp4`
   - *Static proof*: Devnet TX [`2zUD46Fq...`](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) recorded in `docs/cwf/devnet-evidence.json`.

All transactions can be independently audited on Solana Explorer using the live Devnet program `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`.
