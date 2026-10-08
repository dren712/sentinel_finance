/**
 * Pure Solver Recovery Engine for Sentinel Finance
 *
 * Calculates optimal reduce-only rebalancing recovery parameters to transition
 * a quarantined vault back to Active while strictly satisfying all on-chain invariants:
 * 1. Post single-asset exposure <= policy.max_single_asset_bps
 * 2. Post stablecoin reserve >= policy.min_stablecoin_bps
 * 3. Strict risk improvement: post_exposure_bps < pre_exposure_bps
 * 4. Value conservation: post_total_cents >= pre_total_cents * (10000 - max_recovery_cost_bps) / 10000
 * 5. Oversell guard: post_exposure_bps >= max_single_asset_bps - oversell_band_bps
 */

export interface VaultPositionLike {
  mint?: string | any;
  symbol?: string | number[];
  amountUnits: number | bigint;
  priceCents?: number | bigint;
  isIndex?: boolean;
}

export interface VaultStateLike {
  usdcBalanceCents: number | bigint;
  positions: VaultPositionLike[];
}

export interface PolicyStateLike {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxRecoveryCostBps?: number;
}

export interface RecoveryPlanOptions {
  mode?: 'simulated' | 'custody';
  venueFeeBps?: number;
  oversellBandBps?: number;
}

export interface RecoveryPlan {
  sellUnits: bigint;
  preExposureBps: number;
  postExposureBps: number;
  postStableBps: number;
  preTotalCents: bigint;
  postTotalCents: bigint;
  postUsdcCents: bigint;
  postRemainingUnits: bigint;
  mode: 'simulated' | 'custody';
  venueFeeBps: number;
  proceedsCents: bigint;
  isViable: boolean;
  rejectionReason?: string;
}

export const DEFAULT_RECOVERY_VENUE_FEE_BPS = 30; // 0.30% venue execution fee (SIMULATED)
export const DEFAULT_OVERSELL_BAND_BPS = 500;      // 5.00% oversell lower boundary

const ZERO = BigInt(0);
const ONE = BigInt(1);
const BPS_BASE = BigInt(10000);

/**
 * Computes exact required recovery sell units for a quarantined vault.
 * Returns the minimal integer units needed to restore policy compliance.
 */
export function requiredRecoveryUnits(
  vault: VaultStateLike,
  policy: PolicyStateLike,
  pythPriceCents: number | bigint,
  options: RecoveryPlanOptions = {}
): RecoveryPlan {
  const mode = options.mode || 'custody';
  const venueFeeBps = options.venueFeeBps ?? DEFAULT_RECOVERY_VENUE_FEE_BPS;
  const oversellBandBps = options.oversellBandBps ?? DEFAULT_OVERSELL_BAND_BPS;
  const maxRecoveryCostBps = policy.maxRecoveryCostBps ?? 100;

  const priceCents = BigInt(pythPriceCents);
  if (priceCents <= ZERO) {
    throw new Error('Pyth price must be strictly positive for recovery calculation.');
  }

  // Find the single volatile position
  const nonIndexPositions = vault.positions.filter((p) => !p.isIndex);
  if (nonIndexPositions.length === 0) {
    throw new Error('No volatile asset position found in vault to recover.');
  }
  const volatilePos = nonIndexPositions[0];
  const currentUnits = BigInt(volatilePos.amountUnits);
  const usdcCents = BigInt(vault.usdcBalanceCents);

  if (currentUnits <= ZERO) {
    throw new Error('Volatile position holdings are zero. Nothing to recover.');
  }

  const preTargetCents = currentUnits * priceCents;
  const preTotalCents = usdcCents + preTargetCents;

  if (preTotalCents <= ZERO) {
    throw new Error('Pre-recovery total vault valuation must be strictly positive.');
  }

  const preExposureBps = Number((preTargetCents * BPS_BASE) / preTotalCents);

  // Search for the minimal sell_units s in 1..currentUnits that satisfies all constraints
  for (let s = ONE; s <= currentUnits; s = s + ONE) {
    const postUnits = currentUnits - s;
    const postTargetCents = postUnits * priceCents;

    let postUsdcCents: bigint;
    let proceedsCents: bigint;

    if (mode === 'custody') {
      // In real custody containment mode: units are transferred to policy.safe_destination
      postUsdcCents = usdcCents;
      proceedsCents = ZERO;
    } else {
      // In simulated mode: units are sold for simulated USDC proceeds minus venue fee
      const feeFactor = BPS_BASE - BigInt(venueFeeBps);
      proceedsCents = (s * priceCents * feeFactor) / BPS_BASE;
      postUsdcCents = usdcCents + proceedsCents;
    }

    const postTotalCents = postUsdcCents + postTargetCents;
    if (postTotalCents <= ZERO) continue;

    const postExposureBps = Number((postTargetCents * BPS_BASE) / postTotalCents);
    const postStableBps = Number((postUsdcCents * BPS_BASE) / postTotalCents);

    // Invariant 1: Exposure under cap
    if (postExposureBps > policy.maxSingleAssetBps) {
      continue;
    }

    // Invariant 2: Stablecoin above floor
    if (postStableBps < policy.minStablecoinBps) {
      continue;
    }

    // Invariant 3: Strict risk improvement
    if (postExposureBps >= preExposureBps) {
      continue;
    }

    // Invariant 4: Value conservation (only relevant in simulated trade mode)
    if (mode === 'simulated') {
      const minAllowedPostTotal = (preTotalCents * (BPS_BASE - BigInt(maxRecoveryCostBps))) / BPS_BASE;
      if (postTotalCents < minAllowedPostTotal) {
        continue;
      }
    }

    // Invariant 5: Oversell guard
    const lowerBoundBps = Math.max(0, policy.maxSingleAssetBps - oversellBandBps);
    if (postExposureBps < lowerBoundBps && postUnits > ZERO) {
      continue;
    }

    return {
      sellUnits: s,
      preExposureBps,
      postExposureBps,
      postStableBps,
      preTotalCents,
      postTotalCents,
      postUsdcCents,
      postRemainingUnits: postUnits,
      mode,
      venueFeeBps,
      proceedsCents,
      isViable: true,
    };
  }

  // If no exact match satisfies the oversell band, compute best effort without oversell guard
  for (let s = ONE; s <= currentUnits; s = s + ONE) {
    const postUnits = currentUnits - s;
    const postTargetCents = postUnits * priceCents;
    let postUsdcCents: bigint;
    let proceedsCents: bigint;

    if (mode === 'custody') {
      postUsdcCents = usdcCents;
      proceedsCents = ZERO;
    } else {
      const feeFactor = BPS_BASE - BigInt(venueFeeBps);
      proceedsCents = (s * priceCents * feeFactor) / BPS_BASE;
      postUsdcCents = usdcCents + proceedsCents;
    }

    const postTotalCents = postUsdcCents + postTargetCents;
    if (postTotalCents <= ZERO) continue;

    const postExposureBps = Number((postTargetCents * BPS_BASE) / postTotalCents);
    const postStableBps = Number((postUsdcCents * BPS_BASE) / postTotalCents);

    if (postExposureBps <= policy.maxSingleAssetBps && postStableBps >= policy.minStablecoinBps) {
      return {
        sellUnits: s,
        preExposureBps,
        postExposureBps,
        postStableBps,
        preTotalCents,
        postTotalCents,
        postUsdcCents,
        postRemainingUnits: postUnits,
        mode,
        venueFeeBps,
        proceedsCents,
        isViable: false,
        rejectionReason: `Recovery satisfies policy caps but triggers oversell guard (post exposure ${postExposureBps} bps < ${policy.maxSingleAssetBps - oversellBandBps} bps lower bound).`,
      };
    }
  }

  return {
    sellUnits: currentUnits,
    preExposureBps,
    postExposureBps: 0,
    postStableBps: 10000,
    preTotalCents,
    postTotalCents: usdcCents,
    postUsdcCents: usdcCents,
    postRemainingUnits: ZERO,
    mode,
    venueFeeBps,
    proceedsCents: ZERO,
    isViable: false,
    rejectionReason: 'Vault parameters cannot be restored to compliance within policy boundaries.',
  };
}
