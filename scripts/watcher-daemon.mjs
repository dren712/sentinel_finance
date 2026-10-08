#!/usr/bin/env node
/**
 * Sentinel Autonomous Watcher Daemon
 *
 * Continuously polls Solana Devnet for Active portfolio vaults, evaluates Pyth
 * price feeds against configured policy invariants, and permissionlessly submits
 * flagViolation transactions to transition violating vaults into quarantine.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SentinelWatcherService } from '@sentinel/sdk';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PYTH_PRICE_UPDATE_DEVNET = new PublicKey(
  process.env.PYTH_PRICE_UPDATE || 'GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i'
);
const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');

function loadSigner() {
  if (process.env.WATCHER_KEYPAIR) {
    try {
      const parsed = JSON.parse(process.env.WATCHER_KEYPAIR);
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
  console.log('[Watcher Daemon] No keypair found in env or ~/.config/solana/id.json; generating ephemeral watcher.');
  return Keypair.generate();
}

async function main() {
  console.log('====================================================');
  console.log('       SENTINEL AUTONOMOUS WATCHER DAEMON           ');
  console.log('====================================================');
  console.log(`RPC Endpoint:        ${RPC_URL}`);
  console.log(`Sentinel Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`Pyth Oracle Price:   ${PYTH_PRICE_UPDATE_DEVNET.toBase58()}`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const signer = loadSigner();
  console.log(`Watcher Signer:      ${signer.publicKey.toBase58()}`);

  const balance = await connection.getBalance(signer.publicKey);
  console.log(`Signer Balance:      ${(balance / 1e9).toFixed(4)} SOL`);

  const watcher = new SentinelWatcherService({
    connection,
    programId: PROGRAM_ID,
    signer,
    priceUpdatePubkey: PYTH_PRICE_UPDATE_DEVNET,
    pollIntervalMs: parseInt(process.env.WATCHER_POLL_INTERVAL_MS || '1000', 10),
  });

  console.log('\n[Watcher Daemon] Starting autonomous surveillance loop...');

  watcher.start((results) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Scanned ${results.length} active vaults.`);
    for (const res of results) {
      if (res.isViolating) {
        console.log(`  -> VIOLATION on Vault ${res.vaultAddress.slice(0, 8)}... (${res.violationReason || 'INVARIANT_BREACH'})`);
        console.log(`     Exposure: ${res.exposureBps} bps | Max Cap: ${res.maxAllowedBps} bps`);
        console.log(`     Reserve:  ${res.stableReserveBps} bps | Floor:   ${res.minStablecoinBps} bps`);
        console.log(`     Action:   ${res.actionTaken}`);
        if (res.signature) console.log(`     TX:       ${res.signature}`);
        if (res.error) console.log(`     Error:    ${res.error}`);
      }
    }
  });

  const shutdown = () => {
    console.log('\n[Watcher Daemon] Shutting down watcher gracefully...');
    watcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Watcher Daemon] Fatal error:', err);
  process.exit(1);
});
