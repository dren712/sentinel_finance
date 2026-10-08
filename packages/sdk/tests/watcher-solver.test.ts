import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SentinelWatcherService, SentinelSolverService } from '../src';

describe('SentinelWatcherService and SentinelSolverService Unit Tests', () => {
  const dummyConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const dummySigner = Keypair.generate();
  const dummyPriceUpdate = Keypair.generate().publicKey;

  it('1. SentinelWatcherService instantiates with valid configuration and manages lifecycle', () => {
    const watcher = new SentinelWatcherService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
      pollIntervalMs: 1000,
    });

    assert.ok(watcher, 'Watcher service should be instantiated');

    // Stub scanVaults to prevent network calls in unit test
    (watcher as any).scanVaults = async () => [];

    let polled = false;
    watcher.start(() => {
      polled = true;
    });

    watcher.stop();
  });

  it('2. SentinelSolverService instantiates in both simulated and custody modes and manages lifecycle', () => {
    const simSolver = new SentinelSolverService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
      mode: 'simulated',
      pollIntervalMs: 1000,
    });
    assert.ok(simSolver, 'Simulated solver service should be instantiated');

    const custodySolver = new SentinelSolverService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
      mode: 'custody',
      pollIntervalMs: 1000,
    });
    assert.ok(custodySolver, 'Custody solver service should be instantiated');

    // Stub solveQuarantinedVaults to prevent network calls in unit test
    (custodySolver as any).solveQuarantinedVaults = async () => [];

    let polled = false;
    custodySolver.start(() => {
      polled = true;
    });

    custodySolver.stop();
  });

  it('3. Watcher and Solver services accept WalletSigner interfaces', () => {
    const walletSigner = {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async (tx: any) => tx,
    };

    const watcher = new SentinelWatcherService({
      connection: dummyConnection,
      signer: walletSigner,
      priceUpdatePubkey: dummyPriceUpdate,
    });
    assert.ok(watcher);

    const solver = new SentinelSolverService({
      connection: dummyConnection,
      signer: walletSigner,
      priceUpdatePubkey: dummyPriceUpdate,
    });
    assert.ok(solver);
  });
});
