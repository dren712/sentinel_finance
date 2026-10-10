/**
 * Containment Solver Engine for Sentinel Finance
 *
 * Calculates optimal token containment parameters to transition
 * a quarantined vault back to Active while strictly satisfying on-chain postconditions:
 * 1. Post single-asset exposure <= policy.max_single_asset_bps
 * 2. Post stablecoin reserve >= policy.min_stablecoin_bps
 * 3. Strict risk improvement: post_exposure_bps < pre_exposure_bps
 * 4. Oversell guard: post_exposure_bps >= max_single_asset_bps - oversell_band_bps
 *
 * Note: In 'custody' mode (on-chain Devnet), tokens are transferred to policy.safe_destination
 * rather than sold on a DEX; proceedsCents is 0.
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

  function evaluateCandidate(s: bigint) {
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
    const postExposureBps = postTotalCents > ZERO
      ? Number((postTargetCents * BPS_BASE) / postTotalCents)
      : 10000;
    const postStableBps = postTotalCents > ZERO
      ? Number((postUsdcCents * BPS_BASE) / postTotalCents)
      : 0;

    let valueConserved = true;
    if (mode === 'simulated') {
      const minAllowedPostTotal = (preTotalCents * (BPS_BASE - BigInt(maxRecoveryCostBps))) / BPS_BASE;
      valueConserved = postTotalCents >= minAllowedPostTotal;
    }

    const satisfiesCore =
      postTotalCents > ZERO &&
      postExposureBps <= policy.maxSingleAssetBps &&
      postStableBps >= policy.minStablecoinBps &&
      postExposureBps < preExposureBps &&
      valueConserved;

    return {
      s,
      postUnits,
      postTargetCents,
      postUsdcCents,
      proceedsCents,
      postTotalCents,
      postExposureBps,
      postStableBps,
      satisfiesCore,
    };
  }

  // Binary search for minimal s in 1..currentUnits that satisfies core policy constraints
  let low = ONE;
  let high = currentUnits;
  let bestCandidate: ReturnType<typeof evaluateCandidate> | null = null;

  while (low <= high) {
    const mid = low + (high - low) / BigInt(2);
    const candidate = evaluateCandidate(mid);

    if (candidate.satisfiesCore) {
      bestCandidate = candidate;
      high = mid - ONE; // Look for a smaller sell amount that still satisfies
    } else {
      low = mid + ONE;
    }
  }

  if (bestCandidate) {
    const lowerBoundBps = Math.max(0, policy.maxSingleAssetBps - oversellBandBps);
    const triggersOversell = bestCandidate.postExposureBps < lowerBoundBps && bestCandidate.postUnits > ZERO;

    if (triggersOversell) {
      return {
        sellUnits: bestCandidate.s,
        preExposureBps,
        postExposureBps: bestCandidate.postExposureBps,
        postStableBps: bestCandidate.postStableBps,
        preTotalCents,
        postTotalCents: bestCandidate.postTotalCents,
        postUsdcCents: bestCandidate.postUsdcCents,
        postRemainingUnits: bestCandidate.postUnits,
        mode,
        venueFeeBps,
        proceedsCents: bestCandidate.proceedsCents,
        isViable: false,
        rejectionReason: `Recovery satisfies policy caps but triggers oversell guard (post exposure ${bestCandidate.postExposureBps} bps < ${lowerBoundBps} bps lower bound).`,
      };
    }

    return {
      sellUnits: bestCandidate.s,
      preExposureBps,
      postExposureBps: bestCandidate.postExposureBps,
      postStableBps: bestCandidate.postStableBps,
      preTotalCents,
      postTotalCents: bestCandidate.postTotalCents,
      postUsdcCents: bestCandidate.postUsdcCents,
      postRemainingUnits: bestCandidate.postUnits,
      mode,
      venueFeeBps,
      proceedsCents: bestCandidate.proceedsCents,
      isViable: true,
    };
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
