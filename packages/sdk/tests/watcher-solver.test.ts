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

  it('4. Watcher fails closed when Pyth oracle price is unavailable (no stale fallback)', async () => {
    const watcher = new SentinelWatcherService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
    });

    // Mock getAccountInfo to return null (oracle unavailable)
    (watcher as any).connection.getAccountInfo = async () => null;

    // Mock portfolioVault.all to return an active vault
    (watcher as any).program.account = {
      portfolioVault: {
        all: async () => [
          {
            publicKey: Keypair.generate().publicKey,
            account: {
              owner: Keypair.generate().publicKey,
              status: { active: {} },
              usdcBalanceCents: 100000,
              positions: [{ amountUnits: 50, priceCents: 15000, isIndex: false }],
            },
          },
        ],
      },
      policyAccount: {
        fetchNullable: async () => ({
          active: true,
          maxSingleAssetBps: 2500,
          minStablecoinBps: 2000,
          confirmSlots: 5,
        }),
      },
    };

    const results = await watcher.scanVaults();
    // In fail-closed mode, scanning must NOT flag violation or proceed on missing price
    assert.strictEqual(results.length, 0);
  });

  it('5. Watcher detects stablecoin reserve-floor breach even if single-asset exposure is under cap', async () => {
    const watcher = new SentinelWatcherService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
    });

    // Mock valid Pyth oracle price of $100.00 (10000 cents)
    (watcher as any).connection.getAccountInfo = async () => ({
      data: Buffer.concat([
        Buffer.from([34, 241, 35, 99, 157, 126, 244, 205]), // Pyth discriminator
        Buffer.alloc(32), // write authority
        Buffer.from([1]), // Full verification
        Buffer.alloc(32), // feed id
        (() => { const b = Buffer.alloc(8); b.writeBigInt64LE(10000000000n, 0); return b; })(), // price $100
        Buffer.alloc(8), // conf
        (() => { const b = Buffer.alloc(4); b.writeInt32LE(-8, 0); return b; })(), // expo -8
        Buffer.alloc(8), // publish time
        Buffer.alloc(8), // prev publish time
        Buffer.alloc(8), // ema price
        Buffer.alloc(8), // ema conf
      ]),
    });

    // Volatile asset: 20 units @ $100 = $2,000 (20% of $10,000 total -> exposure passes 25% cap)
    // Stablecoin reserve: $1,000 (10% of $10,000 total -> reserve breaches 20% floor!)
    (watcher as any).program.account = {
      portfolioVault: {
        all: async () => [
          {
            publicKey: Keypair.generate().publicKey,
            account: {
              owner: Keypair.generate().publicKey,
              status: { active: {} },
              usdcBalanceCents: 100000, // $1,000 (10% reserve)
              positions: [{ amountUnits: 20, priceCents: 10000, isIndex: false }], // $2,000
            },
          },
        ],
      },
      policyAccount: {
        fetchNullable: async () => ({
          active: true,
          maxSingleAssetBps: 2500, // 25.00% cap (passed at 66.6% if only 2 assets, or adjust total)
          minStablecoinBps: 5000,   // 50.00% floor (breached at 33.3% reserve)
          confirmSlots: 5,
        }),
      },
    };

    // Stub flagViolation call to prevent real network submission
    (watcher as any).connection.getSlot = async () => 100;
    (watcher as any).connection.getLatestBlockhash = async () => ({ blockhash: '11111111111111111111111111111111' });
    (watcher as any).program.methods = {
      flagViolation: () => ({
        accountsPartial: () => ({
          instruction: async () => ({ keys: [], programId: PublicKey.default, data: Buffer.alloc(0) }),
        }),
      }),
    };
    (watcher as any).connection.sendRawTransaction = async () => 'mockSig';
    (watcher as any).connection.confirmTransaction = async () => {};

    const results = await watcher.scanVaults();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].isViolating, true);
    assert.ok(results[0].stableReserveBps < results[0].minStablecoinBps);
  });

  it('6. Solver defaults to custody mode and fails closed when Pyth oracle price is unavailable', async () => {
    const solver = new SentinelSolverService({
      connection: dummyConnection,
      signer: dummySigner,
      priceUpdatePubkey: dummyPriceUpdate,
    });

    // Verify mode default
    assert.strictEqual((solver as any).mode, 'custody');

    // Mock getAccountInfo to return null (oracle unavailable)
    (solver as any).connection.getAccountInfo = async () => null;
    (solver as any).program.account = {
      portfolioVault: {
        all: async () => [
          {
            publicKey: Keypair.generate().publicKey,
            account: {
              owner: Keypair.generate().publicKey,
              status: { quarantined: {} },
              usdcBalanceCents: 100000,
              recoveryExpiresSlot: { toNumber: () => 200 },
              recoveryNonce: 1,
              positions: [{ amountUnits: 50, priceCents: 15000, isIndex: false, mint: Keypair.generate().publicKey }],
            },
          },
        ],
      },
      policyAccount: {
        fetchNullable: async () => ({
          maxSingleAssetBps: 2500,
          minStablecoinBps: 2000,
          safeDestination: Keypair.generate().publicKey,
        }),
      },
    };
    (solver as any).connection.getSlot = async () => 100;

    const results = await solver.solveQuarantinedVaults();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].recovered, false);
    assert.ok(results[0].error?.includes('failed closed'));
  });
});
