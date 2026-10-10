#!/usr/bin/env node
/**
 * Sentinel Autonomous Permissionless Solver Daemon
 *
 * Continuously polls Solana Devnet for Quarantined portfolio vaults,
 * computes optimal token containment parameters via the pure solver engine,
 * and submits recover transactions to contain tokens and reactivate vaults to Active.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SentinelSolverService } from '@sentinel/sdk';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PYTH_PRICE_UPDATE_DEVNET = new PublicKey(
  process.env.PYTH_PRICE_UPDATE || 'GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i'
);
const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
const SOLVER_MODE = process.env.SOLVER_MODE === 'simulated' ? 'simulated' : 'custody';

function loadSigner() {
  if (process.env.SOLVER_KEYPAIR) {
    try {
      const parsed = JSON.parse(process.env.SOLVER_KEYPAIR);
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    } catch {
      // ignore
    }
  }
  const defaultPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  if (fs.existsSync(defaultPath)) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(defaultPath, 'utf8')))
    );
  }
  if (process.env.ALLOW_EPHEMERAL_KEYPAIR === '1' || process.env.ALLOW_EPHEMERAL_KEYPAIR === 'true') {
    console.warn('[Solver Daemon] WARNING: ALLOW_EPHEMERAL_KEYPAIR enabled. Generating ephemeral keypair.');
    return Keypair.generate();
  }
  throw new Error(
    '[Solver Daemon] FATAL: No Solana signer configured. Set SOLVER_KEYPAIR env variable (JSON array of secret key) or place a funded keypair at ~/.config/solana/id.json. (To override for testing only, set ALLOW_EPHEMERAL_KEYPAIR=1).'
  );
}

async function main() {
  console.log('====================================================');
  console.log('       SENTINEL PERMISSIONLESS SOLVER DAEMON        ');
  console.log('====================================================');
  console.log(`RPC Endpoint:        ${RPC_URL}`);
  console.log(`Sentinel Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`Pyth Oracle Price:   ${PYTH_PRICE_UPDATE_DEVNET.toBase58()}`);
  console.log(`Solver Mode:         ${SOLVER_MODE}`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const signer = loadSigner();
  console.log(`Solver Signer:       ${signer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(signer.publicKey);
  console.log(`Signer Balance:      ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance === 0) {
    console.warn('[Solver Daemon] WARNING: Signer has 0 SOL. On-chain transaction submissions will fail due to lack of gas.');
  }

  const solver = new SentinelSolverService({
    connection,
    programId: PROGRAM_ID,
    signer,
    priceUpdatePubkey: PYTH_PRICE_UPDATE_DEVNET,
    mode: SOLVER_MODE,
    pollIntervalMs: parseInt(process.env.SOLVER_POLL_INTERVAL_MS || '1000', 10),
  });

  console.log('\n[Solver Daemon] Starting autonomous recovery solver loop...');

  solver.start((results) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Scanned ${results.length} quarantined vaults.`);
    for (const res of results) {
      console.log(`  -> QUARANTINED Vault ${res.vaultAddress.slice(0, 8)}...`);
      console.log(`     Optimal sell units: ${res.plan.sellUnits.toString()}`);
      console.log(`     Projected exposure: ${res.plan.preExposureBps} bps -> ${res.plan.postExposureBps} bps`);
      if (res.recovered) {
        console.log(`     RECOVERY SUCCESSFUL!`);
        console.log(`     Signature:          ${res.signature}`);
      } else if (res.error) {
        console.log(`     Recovery failed:    ${res.error}`);
      }
    }
  });

  const shutdown = () => {
    console.log('\n[Solver Daemon] Shutting down solver gracefully...');
    solver.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Solver Daemon] Fatal error:', err);
  process.exit(1);
});
