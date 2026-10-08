import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requiredRecoveryUnits } from '../src/recovery';

describe('Sentinel Pure Solver Recovery Engine Tests', () => {
  it('1. calculates exact minimal units in simulated mode (matching onchain 21.44% exposure)', () => {
    // 20 units NVDA @ $300 (30,000 cents), $8,000 USDC (800,000 cents)
    // Pre total = $14,000 (1,400,000 cents). NVDA = $6,000 -> 42.85% exposure
    // Policy: max 25% exposure (2500 bps), min 20% stablecoin (2000 bps)
    const plan = requiredRecoveryUnits(
      {
        usdcBalanceCents: 800000,
        positions: [
          { amountUnits: 20, isIndex: false },
        ],
      },
      {
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxRecoveryCostBps: 100,
      },
      30000,
      { mode: 'simulated', venueFeeBps: 30 }
    );

    assert.strictEqual(plan.isViable, true);
    assert.strictEqual(plan.sellUnits, 9n);
    assert.strictEqual(plan.postRemainingUnits, 11n);
    assert.ok(plan.postExposureBps <= 2500);
    assert.ok(plan.postExposureBps >= 2000); // within 500 bps oversell guard
    assert.strictEqual(plan.postExposureBps, 2358);
    assert.ok(plan.postStableBps >= 2000);
    assert.ok(plan.postExposureBps < plan.preExposureBps);
  });

  it('2. calculates exact minimal units in custody mode (containment transfer to safe_destination)', () => {
    // 100 units @ $100 (10,000 cents), $1,000 USDC (100,000 cents)
    // Pre total = $11,000 (1,100,000 cents). Volatile = $10,000 -> 90.9% exposure
    // Policy: max 50% exposure (5000 bps), min 30% stablecoin (3000 bps)
    const plan = requiredRecoveryUnits(
      {
        usdcBalanceCents: 100000,
        positions: [
          { amountUnits: 100, isIndex: false },
        ],
      },
      {
        maxSingleAssetBps: 5000,
        minStablecoinBps: 3000,
      },
      10000,
      { mode: 'custody' }
    );

    assert.strictEqual(plan.isViable, true);
    assert.strictEqual(plan.sellUnits, 90n);
    assert.strictEqual(plan.postRemainingUnits, 10n);
    assert.strictEqual(plan.postExposureBps, 5000);
    assert.strictEqual(plan.postStableBps, 5000);
    assert.ok(plan.postExposureBps <= 5000);
    assert.ok(plan.postStableBps >= 3000);
  });

  it('3. rejects non-positive price or empty position holdings', () => {
    assert.throws(() => {
      requiredRecoveryUnits(
        { usdcBalanceCents: 1000, positions: [{ amountUnits: 10, isIndex: false }] },
        { maxSingleAssetBps: 2500, minStablecoinBps: 2000 },
        0
      );
    }, /Pyth price must be strictly positive/);

    assert.throws(() => {
      requiredRecoveryUnits(
        { usdcBalanceCents: 1000, positions: [{ amountUnits: 0, isIndex: false }] },
        { maxSingleAssetBps: 2500, minStablecoinBps: 2000 },
        10000
      );
    }, /holdings are zero/);
  });

  it('4. reports isViable: false when policy boundaries cannot be restored', () => {
    // Impossibly high minStablecoin requirement (e.g. 99% stablecoin when volatile position dominates)
    const plan = requiredRecoveryUnits(
      {
        usdcBalanceCents: 0,
        positions: [
          { amountUnits: 100, isIndex: false },
        ],
      },
      {
        maxSingleAssetBps: 2000,
        minStablecoinBps: 9900,
      },
      10000,
      { mode: 'custody' }
    );

    assert.strictEqual(plan.isViable, false);
    assert.ok(plan.rejectionReason);
  });

  it('5. resolves large unit balances (10^11 units) instantly via O(log N) binary search', () => {
    const start = performance.now();
    const plan = requiredRecoveryUnits(
      {
        usdcBalanceCents: 100_000_000,
        positions: [
          { amountUnits: 100_000_000_000n, isIndex: false },
        ],
      },
      {
        maxSingleAssetBps: 4000,
        minStablecoinBps: 2000,
      },
      1000,
      { mode: 'custody' }
    );
    const duration = performance.now() - start;

    assert.strictEqual(plan.isViable, true);
    assert.ok(duration < 20, `Expected sub-20ms execution, took ${duration.toFixed(2)}ms`);
    assert.ok(plan.postExposureBps <= 4000);
    assert.ok(plan.postStableBps >= 2000);
  });
});
