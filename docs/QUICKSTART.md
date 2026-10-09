# Sentinel Finance — Developer Quickstart Guide

This guide walks through deploying, testing, and integrating with **Sentinel — the recovery infrastructure for autonomous Solana financial strategies**.

---

## 1. Prerequisites

- **Node.js**: `v20.0.0` or higher (`v24.x` recommended)
- **Package Manager**: `pnpm` (`v9.x` or higher)
- **Solana CLI**: `v1.18+` (optional, for localnet testing)
- **Rust & Anchor**: Rust `1.75+` & Anchor `0.30.1` (optional, for compiling on-chain program)

---

## 2. Environment Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/dren712/sentinel_finance.git
cd sentinel_finance
pnpm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Key environment variables:
```bash
# Solana RPC Endpoint (Devnet default)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Authoritative CWF Sentinel Program ID
NEXT_PUBLIC_PROGRAM_ID=3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH

# Pyth Price Feed Account on Devnet
PYTH_PRICE_UPDATE=GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i

# Test SPL Mints on Devnet
NEXT_PUBLIC_SUSD_MINT=HEaMJa7qSEQD36wTJhc4VeyfVuDQS3b5ZcGzajzgCJBL
NEXT_PUBLIC_SASSET_MINT=BJWNG3k1nmgG3Ua42P1CqRZWkSu9hYoRGeAttLmLZ1GT
```

---

## 3. Running the Applications

### Web Application & Incident Terminal
Run the Next.js production or development server:

```bash
pnpm --filter web dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Dashboard (`/`)**: Portfolio overview and live invariant monitoring.
- **Quarantine Terminal (`/quarantine`)**: Incident screen with real on-chain state and recovery trigger.
- **Devnet Lab (`/lab`)**: Developer testing sandbox with native SOL faucet, test SPL asset mints, and controlled incident simulator.

### Running the Autonomous Daemons
Sentinel includes standalone autonomous background daemons:

```bash
# Start the Watcher Daemon (monitors active vaults and flags invariant breaches)
pnpm watcher

# Start the Permissionless Solver Daemon (monitors quarantined vaults and recovers them)
pnpm solver
```

*Note: The daemons require a funded Solana signer keypair configured via `SOLVER_KEYPAIR`/`WATCHER_KEYPAIR` or present at `~/.config/solana/id.json`. For local offline testing, pass `ALLOW_EPHEMERAL_KEYPAIR=1`.*

---

## 4. End-to-End Programmatic Integration

Below is a complete TypeScript example using `@sentinel/sdk` to monitor and recover a vault.

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  LiveExecutionAdapter,
  resolveRecoveryCustodyAccounts,
  requiredRecoveryUnits,
  TOKEN_PROGRAM_ID,
} from '@sentinel/sdk';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const programId = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
  const solverKeypair = Keypair.generate(); // Provide funded keypair in production

  const adapter = new LiveExecutionAdapter(connection, programId, {
    signer: solverKeypair,
  });

  const vaultOwner = new PublicKey('...');
  const priceUpdatePubkey = new PublicKey('GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i');

  // 1. Read authoritative on-chain vault state
  const status = await adapter.readVaultStatus(vaultOwner);
  console.log(`Vault Status: ${status.status}`);

  if (status.status === 'Quarantined') {
    // 2. Compute minimal required recovery units via pure mathematical solver
    const plan = requiredRecoveryUnits(
      {
        usdcBalanceCents: status.usdcBalanceCents,
        positions: status.positions,
      },
      {
        maxSingleAssetBps: 6000, // 60.00% cap
        minStablecoinBps: 2000,  // 20.00% floor
        maxRecoveryCostBps: 500, // 5.00% cost bound
      },
      status.positions[0].priceCents,
      { mode: 'custody' }
    );

    console.log(`Optimal units to recover: ${plan.sellUnits}`);

    // 3. Resolve canonical custody remaining accounts
    const custodyAccounts = resolveRecoveryCustodyAccounts(
      new PublicKey(status.vaultAddress),
      new PublicKey(status.safeDestination),
      new PublicKey(status.positions[0].mint),
      TOKEN_PROGRAM_ID
    );

    // 4. Submit permissionless recovery transaction
    const { signature } = await adapter.recover({
      vaultOwner,
      sellUnits: plan.sellUnits,
      expectedNonce: status.recoveryNonce,
      priceUpdatePubkey,
      custodyAccounts,
    });

    console.log(`Recovery confirmed: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  }
}

main().catch(console.error);
```

---

## 5. Verification & Test Execution

Run the complete test suite:

```bash
# 1. Run all 108 SDK, domain, watcher/solver, and adversarial security tests
pnpm test

# 2. Run Bankrun recovery slot-warping tests (26 test cases)
node --experimental-strip-types --test tests/bankrun-recovery.test.ts

# 3. Run Bankrun quarantine hysteresis tests (13 test cases)
node --experimental-strip-types --test tests/bankrun-quarantine.test.ts

# 4. Run Rust Anchor program unit tests (28 test cases)
cargo test --manifest-path programs/sentinel/Cargo.toml

# 5. Build Next.js production bundle
pnpm --filter web build
```
Total: **195 / 195 automated tests passing with zero failures.**
