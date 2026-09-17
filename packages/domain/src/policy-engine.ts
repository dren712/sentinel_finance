import {
  FinancialPolicy,
  PortfolioAsset,
  PortfolioSnapshot,
  TradeIntent,
  PostconditionCheckResult,
  EvaluationOutcome,
  FailureCode,
  PriceSource,
  NormalizedMarketPrice,
  AgentRiskState,
} from './types';
import { getAssetMetadata, getAssetCategory } from './asset-registry';
import { hashPortfolioProjection } from './portfolio-reader';
import { getTesseraTranche, evaluateTesseraEligibility } from './tessera-vault';

/**
 * Calculates total portfolio value in USD, rounded to 2 decimal places
 */
export function calculatePortfolioValue(assets: PortfolioAsset[]): number {
  const sum = assets.reduce((total, asset) => total + asset.valueUsd, 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Calculates asset exposure in basis points (1 bp = 0.01%, 10000 bps = 100%)
 * Uses exact rounding to nearest basis point.
 */
export function calculateAssetExposureBps(assetValueUsd: number, totalValueUsd: number): number {
  if (totalValueUsd <= 0) return 0;
  return Math.round((assetValueUsd * 10_000) / totalValueUsd);
}

/**
 * Simulates a hypothetical state transition without altering external state.
 * Returns the expected post-state portfolio snapshot.
 */
export function simulateStateTransition(
  preState: PortfolioSnapshot,
  intent: TradeIntent,
  executionPriceUsd?: number
): PortfolioSnapshot {
  const price = executionPriceUsd ?? intent.referencePriceUsd;
  const isBuy = intent.direction === 'BUY';
  const tradeValue = intent.tradeAmountUsd;
  const tokenQuantity = price > 0 ? tradeValue / price : 0;

  // Deep clone assets to avoid mutating preState
  const newAssets: PortfolioAsset[] = preState.assets.map(asset => ({ ...asset }));

  // Find or initialize target asset
  let targetAssetIndex = newAssets.findIndex(a => a.symbol === intent.assetSymbol || a.mint === intent.assetMint);
  if (targetAssetIndex === -1 && isBuy) {
    const meta = getAssetMetadata(intent.assetSymbol);
    newAssets.push({
      symbol: intent.assetSymbol,
      name: meta?.name ?? `${intent.assetSymbol} Tokenized Stock`,
      mint: meta?.mint ?? intent.assetMint,
      amount: 0,
      priceUsd: price,
      valueUsd: 0,
      exposureBps: 0,
      isStablecoin: meta?.isStablecoin ?? false,
      isIndex: meta?.isIndex ?? false,
      sector: meta?.sector,
      issuer: meta?.issuer,
      assetClass: meta?.assetClass,
    });
    targetAssetIndex = newAssets.length - 1;
  }

  // Ensure all existing assets have sector and issuer metadata populated
  for (const asset of newAssets) {
    if (!asset.sector || !asset.issuer) {
      const m = getAssetMetadata(asset.symbol);
      if (!asset.sector && m?.sector) asset.sector = m.sector;
      if (!asset.issuer && m?.issuer) asset.issuer = m.issuer;
    }
  }

  // Find stablecoin asset (USDC)
  const usdcIndex = newAssets.findIndex(a => a.isStablecoin || a.symbol === 'USDC');
  if (usdcIndex === -1) {
    throw new Error('Portfolio must contain a designated stablecoin reserve asset');
  }

  const usdcAsset = newAssets[usdcIndex];
  const targetAsset = newAssets[targetAssetIndex];

  if (isBuy) {
    // BUY: spend USDC, acquire target equity
    usdcAsset.amount = Math.max(0, usdcAsset.amount - tradeValue);
    usdcAsset.valueUsd = Math.round(usdcAsset.amount * usdcAsset.priceUsd * 100) / 100;
    usdcAsset.rawAmount = BigInt(Math.round(usdcAsset.amount * Math.pow(10, usdcAsset.decimals ?? 6))).toString();

    targetAsset.amount += tokenQuantity;
    targetAsset.priceUsd = price;
    targetAsset.valueUsd = Math.round(targetAsset.amount * price * 100) / 100;
    targetAsset.rawAmount = BigInt(Math.round(targetAsset.amount * Math.pow(10, targetAsset.decimals ?? 6))).toString();
  } else {
    // SELL: liquidate target equity, receive USDC
    targetAsset.amount = Math.max(0, targetAsset.amount - tokenQuantity);
    targetAsset.priceUsd = price;
    targetAsset.valueUsd = Math.round(targetAsset.amount * price * 100) / 100;
    targetAsset.rawAmount = BigInt(Math.round(targetAsset.amount * Math.pow(10, targetAsset.decimals ?? 6))).toString();

    usdcAsset.amount += tradeValue;
    usdcAsset.valueUsd = Math.round(usdcAsset.amount * usdcAsset.priceUsd * 100) / 100;
    usdcAsset.rawAmount = BigInt(Math.round(usdcAsset.amount * Math.pow(10, usdcAsset.decimals ?? 6))).toString();
  }

  const totalValueUsd = calculatePortfolioValue(newAssets);

  // Recalculate exposures
  for (const asset of newAssets) {
    asset.exposureBps = calculateAssetExposureBps(asset.valueUsd, totalValueUsd);
  }

  const stablecoinExposureBps = calculateAssetExposureBps(usdcAsset.valueUsd, totalValueUsd);

  const postPortfolio: PortfolioSnapshot = {
    portfolioId: preState.portfolioId,
    owner: preState.owner,
    totalValueUsd,
    stablecoinValueUsd: usdcAsset.valueUsd,
    stablecoinExposureBps,
    assets: newAssets,
    timestamp: Date.now(),
    walletAddress: preState.walletAddress,
    sentinelPda: preState.sentinelPda,
    source: preState.source,
    projectionTimestamp: Date.now(),
  };

  if (postPortfolio.walletAddress || postPortfolio.sentinelPda) {
    postPortfolio.projectionHash = hashPortfolioProjection(postPortfolio);
  }

  return postPortfolio;
}

/**
 * Checks Postcondition A: Maximum single-asset exposure
 * Per Section 10.1: single equity exposure <= max_single_asset_bps
 * Index ETFs (e.g. SPYx) and stablecoins are exempt from individual equity ceiling.
 */
export function checkMaxSingleAsset(
  postState: PortfolioSnapshot,
  maxSingleAssetBps: number,
  targetAssetSymbol?: string
): PostconditionCheckResult {
  const assetsToCheck = targetAssetSymbol
    ? postState.assets.filter(a => a.symbol === targetAssetSymbol)
    : postState.assets.filter(a => !a.isStablecoin && !a.isIndex);

  let maxObservedBps = 0;
  let offendingAsset: PortfolioAsset | undefined;

  for (const asset of assetsToCheck) {
    if (asset.isStablecoin || asset.isIndex) continue;
    if (asset.exposureBps > maxObservedBps) {
      maxObservedBps = asset.exposureBps;
      offendingAsset = asset;
    }
  }

  const passed = maxObservedBps <= maxSingleAssetBps;

  return {
    checkName: 'MAX_SINGLE_ASSET',
    passed,
    expectedBpsOrValue: maxSingleAssetBps,
    actualBpsOrValue: maxObservedBps,
    description: passed
      ? `Single-asset exposure is within authorized limit (${(maxObservedBps / 100).toFixed(2)}% <= ${(maxSingleAssetBps / 100).toFixed(2)}%)`
      : `Single-asset exposure exceeded: ${offendingAsset?.symbol ?? 'Asset'} would reach ${(maxObservedBps / 100).toFixed(2)}%, exceeding ceiling of ${(maxSingleAssetBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_EXPOSURE_EXCEEDED',
  };
}

/**
 * Checks Postcondition B: Minimum stablecoin reserve floor
 * Per Section 10.1: stablecoin_reserve / total_portfolio >= min_stablecoin_bps
 */
export function checkMinStablecoin(
  postState: PortfolioSnapshot,
  minStablecoinBps: number
): PostconditionCheckResult {
  const passed = postState.stablecoinExposureBps >= minStablecoinBps;

  return {
    checkName: 'MIN_STABLECOIN',
    passed,
    expectedBpsOrValue: minStablecoinBps,
    actualBpsOrValue: postState.stablecoinExposureBps,
    description: passed
      ? `Stablecoin reserve floor satisfied (${(postState.stablecoinExposureBps / 100).toFixed(2)}% >= ${(minStablecoinBps / 100).toFixed(2)}%)`
      : `Stablecoin reserve floor breached: reserve would drop to ${(postState.stablecoinExposureBps / 100).toFixed(2)}%, breaching required floor of ${(minStablecoinBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_STABLECOIN_RESERVE_BREACHED',
  };
}

/**
 * Checks Postcondition C: Maximum trade size
 * Per Section 10.1: trade_amount_usd <= max_trade_value_usd
 */
export function checkMaxTradeSize(
  intent: TradeIntent,
  maxTradeValueUsd: number
): PostconditionCheckResult {
  const passed = intent.tradeAmountUsd <= maxTradeValueUsd;

  return {
    checkName: 'MAX_TRADE_SIZE',
    passed,
    expectedBpsOrValue: maxTradeValueUsd,
    actualBpsOrValue: intent.tradeAmountUsd,
    description: passed
      ? `Trade size is within authorized limit ($${intent.tradeAmountUsd.toLocaleString()} <= $${maxTradeValueUsd.toLocaleString()})`
      : `Trade size exceeded: proposed $${intent.tradeAmountUsd.toLocaleString()} exceeds maximum allowed of $${maxTradeValueUsd.toLocaleString()}`,
    failureCode: passed ? undefined : 'ERR_TRADE_SIZE_EXCEEDED',
  };
}

/**
 * Checks Postcondition D: Maximum slippage
 * Per Section 10.1: actual_execution_price vs quoted/reference price <= max_slippage
 */
export function checkSlippage(
  quotedPrice: number,
  actualPrice: number,
  maxSlippageBps: number
): PostconditionCheckResult {
  if (quotedPrice <= 0 || actualPrice <= 0) {
    return {
      checkName: 'SLIPPAGE',
      passed: true,
      expectedBpsOrValue: maxSlippageBps,
      actualBpsOrValue: 0,
      description: 'Slippage check passed (zero price reference)',
    };
  }

  const deviationBps = Math.round((Math.abs(actualPrice - quotedPrice) / quotedPrice) * 10_000);
  const passed = deviationBps <= maxSlippageBps;

  return {
    checkName: 'SLIPPAGE',
    passed,
    expectedBpsOrValue: maxSlippageBps,
    actualBpsOrValue: deviationBps,
    description: passed
      ? `Execution slippage acceptable (${(deviationBps / 100).toFixed(2)}% <= ${(maxSlippageBps / 100).toFixed(2)}%)`
      : `Slippage tolerance exceeded: actual slippage ${(deviationBps / 100).toFixed(2)}% exceeds max ${(maxSlippageBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_SLIPPAGE_EXCEEDED',
  };
}

/**
 * Checks Pre-IPO aggregate exposure cap (Phase 11: PreStocks Asset Universe)
 * Enforces Pre-IPO private equity allocation <= maxPreIpoExposureBps (e.g. 2000 for 20.00%)
 */
export function checkPreIpoExposure(
  postState: PortfolioSnapshot,
  maxPreIpoBps: number
): PostconditionCheckResult {
  const preIpoValue = postState.assets
    .filter(a => getAssetCategory(a.symbol) === 'PRE_IPO' || a.assetClass === 'PRE_IPO')
    .reduce((sum, a) => sum + a.valueUsd, 0);
  const preIpoExposureBps = calculateAssetExposureBps(preIpoValue, postState.totalValueUsd);
  const passed = preIpoExposureBps <= maxPreIpoBps;

  return {
    checkName: 'MAX_PRE_IPO_EXPOSURE',
    passed,
    expectedBpsOrValue: maxPreIpoBps,
    actualBpsOrValue: preIpoExposureBps,
    description: passed
      ? `Pre-IPO aggregate exposure is within authorized limit (${(preIpoExposureBps / 100).toFixed(2)}% <= ${(maxPreIpoBps / 100).toFixed(2)}%)`
      : `Pre-IPO exposure ceiling exceeded: ${(preIpoExposureBps / 100).toFixed(2)}% exceeds max ${(maxPreIpoBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_EXPOSURE_EXCEEDED',
  };
}

/**
 * Checks Public Equities aggregate exposure cap (Phase 11: Public Equities Asset Universe)
 * Enforces Public equities allocation <= maxPublicEquitiesBps (e.g. 7000 for 70.00%)
 */
export function checkPublicEquitiesExposure(
  postState: PortfolioSnapshot,
  maxPublicEquitiesBps: number
): PostconditionCheckResult {
  const publicValue = postState.assets
    .filter(a => getAssetCategory(a.symbol) === 'PUBLIC_EQUITIES')
    .reduce((sum, a) => sum + a.valueUsd, 0);
  const publicExposureBps = calculateAssetExposureBps(publicValue, postState.totalValueUsd);
  const passed = publicExposureBps <= maxPublicEquitiesBps;

  return {
    checkName: 'MAX_PUBLIC_EQUITIES_EXPOSURE',
    passed,
    expectedBpsOrValue: maxPublicEquitiesBps,
    actualBpsOrValue: publicExposureBps,
    description: passed
      ? `Public equities aggregate exposure is within authorized limit (${(publicExposureBps / 100).toFixed(2)}% <= ${(maxPublicEquitiesBps / 100).toFixed(2)}%)`
      : `Public equities exposure ceiling exceeded: ${(publicExposureBps / 100).toFixed(2)}% exceeds max ${(maxPublicEquitiesBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_PUBLIC_EQUITIES_EXCEEDED',
  };
}

/**
 * Checks Anti-Self-Dealing Guard (Phase 12: ClawPump Agent Token)
 * Prevents autonomous agents from allocating excessive portfolio capital into their own agent token.
 */
export function checkAgentSelfDealing(
  postState: PortfolioSnapshot,
  maxAgentTokenBps: number = 500,
  targetAssetSymbol?: string
): PostconditionCheckResult {
  const isAgentToken = targetAssetSymbol === 'ROBOx' || targetAssetSymbol?.includes('ROBO');
  if (!isAgentToken) {
    return {
      checkName: 'AGENT_SELF_DEALING_CAP',
      passed: true,
      expectedBpsOrValue: maxAgentTokenBps,
      actualBpsOrValue: 0,
      description: 'Asset is not an autonomous agent token; anti-self-dealing check satisfied',
    };
  }

  const asset = postState.assets.find(a => a.symbol === targetAssetSymbol);
  const exposureBps = asset ? asset.exposureBps : 0;
  const passed = exposureBps <= maxAgentTokenBps;

  return {
    checkName: 'AGENT_SELF_DEALING_CAP',
    passed,
    expectedBpsOrValue: maxAgentTokenBps,
    actualBpsOrValue: exposureBps,
    description: passed
      ? `Agent self-allocation ${(exposureBps / 100).toFixed(2)}% is within authorized limit (≤ ${(maxAgentTokenBps / 100).toFixed(2)}%)`
      : `Agent self-allocation ${(exposureBps / 100).toFixed(2)}% breaches anti-self-dealing cap of ${(maxAgentTokenBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_AGENT_SELF_DEALING_EXCEEDED',
  };
}

/**
 * Checks Tessera Fractional SPV Tranche Eligibility (Phase 12: Tessera Private Equity)
 * Verifies that secondary transfer lockups have expired and trade price is within NAV premium limits.
 */
export function checkTesseraTrancheEligibility(
  intent: TradeIntent,
  maxNavPremiumBps: number = 1500,
  currentTimeMs: number = Date.now()
): PostconditionCheckResult {
  const tranche = getTesseraTranche(intent.assetSymbol);
  if (!tranche) {
    return {
      checkName: 'TESSERA_TRANCHE_ELIGIBILITY',
      passed: true,
      expectedBpsOrValue: maxNavPremiumBps,
      actualBpsOrValue: 0,
      description: 'Asset is not a Tessera fractional SPV tranche; check satisfied',
    };
  }

  const result = evaluateTesseraEligibility(tranche, intent.referencePriceUsd, maxNavPremiumBps, currentTimeMs);
  return {
    checkName: 'TESSERA_TRANCHE_ELIGIBILITY',
    passed: result.passed,
    expectedBpsOrValue: maxNavPremiumBps,
    actualBpsOrValue: result.premiumBps,
    description: result.reason,
    failureCode: result.failureCode,
  };
}

/**
 * Comprehensive tripartite Asset Class Allocation Report
 * Evaluates Public Equities (<= 70%), Pre-IPO (<= 20%), Stablecoin (>= 10%)
 */
export interface AssetClassAllocationReport {
  publicEquities: {
    valueUsd: number;
    exposureBps: number;
    maxBps: number;
    passed: boolean;
  };
  preIpo: {
    valueUsd: number;
    exposureBps: number;
    maxBps: number;
    passed: boolean;
  };
  stable: {
    valueUsd: number;
    exposureBps: number;
    minBps: number;
    passed: boolean;
  };
  allPassed: boolean;
}

export function evaluateAssetClassAllocations(
  portfolio: PortfolioSnapshot,
  policy: FinancialPolicy
): AssetClassAllocationReport {
  const totalValue = portfolio.totalValueUsd;

  let publicValue = 0;
  let preIpoValue = 0;
  let stableValue = 0;

  for (const asset of portfolio.assets) {
    const cat = getAssetCategory(asset.symbol);
    if (cat === 'PRE_IPO') {
      preIpoValue += asset.valueUsd;
    } else if (cat === 'STABLE') {
      stableValue += asset.valueUsd;
    } else {
      publicValue += asset.valueUsd;
    }
  }

  const publicExposureBps = calculateAssetExposureBps(publicValue, totalValue);
  const preIpoExposureBps = calculateAssetExposureBps(preIpoValue, totalValue);
  const stableExposureBps = calculateAssetExposureBps(stableValue, totalValue);

  const maxPublicBps = policy.maxPublicEquitiesExposureBps ?? 7000;
  const maxPreIpoBps = policy.maxPreIpoExposureBps ?? 2000;
  const minStableBps = policy.minStablecoinBps;

  const publicPassed = publicExposureBps <= maxPublicBps;
  const preIpoPassed = preIpoExposureBps <= maxPreIpoBps;
  const stablePassed = stableExposureBps >= minStableBps;

  return {
    publicEquities: {
      valueUsd: Math.round(publicValue * 100) / 100,
      exposureBps: publicExposureBps,
      maxBps: maxPublicBps,
      passed: publicPassed,
    },
    preIpo: {
      valueUsd: Math.round(preIpoValue * 100) / 100,
      exposureBps: preIpoExposureBps,
      maxBps: maxPreIpoBps,
      passed: preIpoPassed,
    },
    stable: {
      valueUsd: Math.round(stableValue * 100) / 100,
      exposureBps: stableExposureBps,
      minBps: minStableBps,
      passed: stablePassed,
    },
    allPassed: publicPassed && preIpoPassed && stablePassed,
  };
}

// -----------------------------------------------------------------------------
// Phase 6: Financial Risk Engine DSL Checks
// -----------------------------------------------------------------------------

/**
 * Checks emergency pause state (Kill Switch)
 */
export function checkEmergencyPause(policy: FinancialPolicy): PostconditionCheckResult {
  const isPaused = policy.isEmergencyPaused === true;
  return {
    checkName: 'EMERGENCY_PAUSE',
    passed: !isPaused,
    expectedBpsOrValue: 'OPERATIONAL',
    actualBpsOrValue: isPaused ? 'EMERGENCY_PAUSED' : 'OPERATIONAL',
    description: isPaused
      ? 'Emergency kill switch is ACTIVE: all state transitions are immediately blocked'
      : 'Emergency kill switch clear (system operational)',
    failureCode: isPaused ? 'ERR_EMERGENCY_PAUSE' : undefined,
  };
}

/**
 * Checks policy expiration
 */
export function checkPolicyExpiry(policy: FinancialPolicy, now: number = Date.now()): PostconditionCheckResult {
  const isExpired = policy.policyExpiresAt !== undefined && now > policy.policyExpiresAt;
  return {
    checkName: 'POLICY_EXPIRY',
    passed: !isExpired,
    expectedBpsOrValue: policy.policyExpiresAt ? new Date(policy.policyExpiresAt).toISOString() : 'PERPETUAL',
    actualBpsOrValue: new Date(now).toISOString(),
    description: isExpired
      ? `Policy expired at ${new Date(policy.policyExpiresAt!).toISOString()} (current: ${new Date(now).toISOString()})`
      : 'Policy validity window active',
    failureCode: isExpired ? 'ERR_POLICY_EXPIRED' : undefined,
  };
}

/**
 * Checks permitted asset symbols or mint addresses
 */
export function checkAssetAllowlist(intent: TradeIntent, allowlist?: string[]): PostconditionCheckResult {
  if (!allowlist || allowlist.length === 0) {
    return {
      checkName: 'ASSET_ALLOWLIST',
      passed: true,
      expectedBpsOrValue: 'UNRESTRICTED',
      actualBpsOrValue: intent.assetSymbol,
      description: 'Asset allowlist check passed (unrestricted)',
    };
  }
  const passed = allowlist.includes(intent.assetSymbol) || allowlist.includes(intent.assetMint);
  return {
    checkName: 'ASSET_ALLOWLIST',
    passed,
    expectedBpsOrValue: allowlist.join(', '),
    actualBpsOrValue: intent.assetSymbol,
    description: passed
      ? `Asset ${intent.assetSymbol} is permitted by policy allowlist`
      : `Asset ${intent.assetSymbol} is NOT authorized by policy allowlist [${allowlist.join(', ')}]`,
    failureCode: passed ? undefined : 'ERR_ASSET_NOT_ALLOWED',
  };
}

/**
 * Checks permitted execution venues
 */
export function checkVenueAllowlist(venueType?: string, allowlist?: string[]): PostconditionCheckResult {
  if (!allowlist || allowlist.length === 0 || !venueType) {
    return {
      checkName: 'VENUE_ALLOWLIST',
      passed: true,
      expectedBpsOrValue: 'UNRESTRICTED',
      actualBpsOrValue: venueType ?? 'DEFAULT',
      description: 'Venue allowlist check passed',
    };
  }
  const passed = allowlist.includes(venueType);
  return {
    checkName: 'VENUE_ALLOWLIST',
    passed,
    expectedBpsOrValue: allowlist.join(', '),
    actualBpsOrValue: venueType,
    description: passed
      ? `Execution venue ${venueType} is permitted by policy allowlist`
      : `Execution venue ${venueType} is NOT authorized by policy allowlist [${allowlist.join(', ')}]`,
    failureCode: passed ? undefined : 'ERR_VENUE_NOT_ALLOWED',
  };
}

/**
 * Checks maximum sector exposure in basis points
 */
export function checkMaxSectorExposure(
  postState: PortfolioSnapshot,
  maxSectorBps?: number
): PostconditionCheckResult {
  if (maxSectorBps === undefined || maxSectorBps <= 0) {
    return {
      checkName: 'SECTOR_EXPOSURE',
      passed: true,
      expectedBpsOrValue: 10_000,
      actualBpsOrValue: 0,
      description: 'Sector exposure check passed (no ceiling configured)',
    };
  }

  const sectorValues: Record<string, number> = {};
  for (const asset of postState.assets) {
    if (asset.isStablecoin || asset.symbol === 'USDC') continue;
    const sector = asset.sector ?? getAssetMetadata(asset.symbol)?.sector ?? 'OTHER';
    sectorValues[sector] = (sectorValues[sector] ?? 0) + asset.valueUsd;
  }

  let maxObservedBps = 0;
  let offendingSector = 'NONE';
  for (const [sector, val] of Object.entries(sectorValues)) {
    const bps = calculateAssetExposureBps(val, postState.totalValueUsd);
    if (bps > maxObservedBps) {
      maxObservedBps = bps;
      offendingSector = sector;
    }
  }

  const passed = maxObservedBps <= maxSectorBps;
  return {
    checkName: 'SECTOR_EXPOSURE',
    passed,
    expectedBpsOrValue: maxSectorBps,
    actualBpsOrValue: maxObservedBps,
    description: passed
      ? `Sector exposure within limit (${offendingSector}: ${(maxObservedBps / 100).toFixed(2)}% <= ${(maxSectorBps / 100).toFixed(2)}%)`
      : `Sector exposure ceiling exceeded: ${offendingSector} reached ${(maxObservedBps / 100).toFixed(2)}%, exceeding ceiling of ${(maxSectorBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_SECTOR_EXPOSURE_EXCEEDED',
  };
}

/**
 * Checks maximum issuer exposure in basis points
 */
export function checkMaxIssuerExposure(
  postState: PortfolioSnapshot,
  maxIssuerBps?: number
): PostconditionCheckResult {
  if (maxIssuerBps === undefined || maxIssuerBps <= 0) {
    return {
      checkName: 'ISSUER_EXPOSURE',
      passed: true,
      expectedBpsOrValue: 10_000,
      actualBpsOrValue: 0,
      description: 'Issuer exposure check passed (no ceiling configured)',
    };
  }

  const issuerValues: Record<string, number> = {};
  for (const asset of postState.assets) {
    if (asset.isStablecoin || asset.symbol === 'USDC') continue;
    const issuer = asset.issuer ?? getAssetMetadata(asset.symbol)?.issuer ?? 'UNKNOWN';
    issuerValues[issuer] = (issuerValues[issuer] ?? 0) + asset.valueUsd;
  }

  let maxObservedBps = 0;
  let offendingIssuer = 'NONE';
  for (const [issuer, val] of Object.entries(issuerValues)) {
    const bps = calculateAssetExposureBps(val, postState.totalValueUsd);
    if (bps > maxObservedBps) {
      maxObservedBps = bps;
      offendingIssuer = issuer;
    }
  }

  const passed = maxObservedBps <= maxIssuerBps;
  return {
    checkName: 'ISSUER_EXPOSURE',
    passed,
    expectedBpsOrValue: maxIssuerBps,
    actualBpsOrValue: maxObservedBps,
    description: passed
      ? `Issuer exposure within limit (${offendingIssuer}: ${(maxObservedBps / 100).toFixed(2)}% <= ${(maxIssuerBps / 100).toFixed(2)}%)`
      : `Issuer exposure ceiling exceeded: ${offendingIssuer} reached ${(maxObservedBps / 100).toFixed(2)}%, exceeding ceiling of ${(maxIssuerBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_ISSUER_EXPOSURE_EXCEEDED',
  };
}

/**
 * Checks maximum concurrent non-stablecoin positions
 */
export function checkMaxPositions(
  postState: PortfolioSnapshot,
  maxPositions?: number
): PostconditionCheckResult {
  if (maxPositions === undefined || maxPositions <= 0) {
    return {
      checkName: 'MAX_POSITIONS',
      passed: true,
      expectedBpsOrValue: 100,
      actualBpsOrValue: 0,
      description: 'Max positions check passed (unrestricted)',
    };
  }

  const activePositions = postState.assets.filter(a => !a.isStablecoin && a.symbol !== 'USDC' && a.amount > 0 && a.valueUsd > 0);
  const passed = activePositions.length <= maxPositions;
  return {
    checkName: 'MAX_POSITIONS',
    passed,
    expectedBpsOrValue: maxPositions,
    actualBpsOrValue: activePositions.length,
    description: passed
      ? `Active positions count (${activePositions.length} <= ${maxPositions}) is compliant`
      : `Max positions exceeded: holding ${activePositions.length} active positions, exceeding ceiling of ${maxPositions}`,
    failureCode: passed ? undefined : 'ERR_MAX_POSITIONS_EXCEEDED',
  };
}

/**
 * Checks minimum asset diversification count
 */
export function checkDiversification(
  postState: PortfolioSnapshot,
  minAssets?: number
): PostconditionCheckResult {
  if (minAssets === undefined || minAssets <= 1) {
    return {
      checkName: 'DIVERSIFICATION',
      passed: true,
      expectedBpsOrValue: 1,
      actualBpsOrValue: 1,
      description: 'Diversification check passed',
    };
  }

  const activeAssets = postState.assets.filter(a => a.valueUsd > 0 && !a.isStablecoin && a.symbol !== 'USDC');
  const passed = activeAssets.length >= minAssets;
  return {
    checkName: 'DIVERSIFICATION',
    passed,
    expectedBpsOrValue: minAssets,
    actualBpsOrValue: activeAssets.length,
    description: passed
      ? `Minimum diversification requirement satisfied (${activeAssets.length} >= ${minAssets} assets)`
      : `Diversification breached: portfolio holds ${activeAssets.length} active risk assets, below requirement of ${minAssets}`,
    failureCode: passed ? undefined : 'ERR_DIVERSIFICATION_BREACHED',
  };
}

/**
 * Checks agent daily trade budget and consecutive failure circuit breaker
 */
export function checkDailyBudgetAndCircuitBreaker(
  intent: TradeIntent,
  policy: FinancialPolicy,
  agentRiskState?: AgentRiskState
): PostconditionCheckResult[] {
  const results: PostconditionCheckResult[] = [];

  // Circuit breaker check
  if (agentRiskState?.isCircuitBreakerTriggered) {
    results.push({
      checkName: 'CIRCUIT_BREAKER',
      passed: false,
      expectedBpsOrValue: policy.maxConsecutiveFailures ?? 3,
      actualBpsOrValue: agentRiskState.consecutiveFailures,
      description: `Autonomous agent circuit breaker is TRIGGERED after ${agentRiskState.consecutiveFailures} consecutive rejections. Manual intervention required.`,
      failureCode: 'ERR_CIRCUIT_BREAKER_TRIGGERED',
    });
  } else if (policy.maxConsecutiveFailures !== undefined && agentRiskState) {
    const isTriggered = agentRiskState.consecutiveFailures >= policy.maxConsecutiveFailures;
    results.push({
      checkName: 'CIRCUIT_BREAKER',
      passed: !isTriggered,
      expectedBpsOrValue: policy.maxConsecutiveFailures,
      actualBpsOrValue: agentRiskState.consecutiveFailures,
      description: isTriggered
        ? `Circuit breaker tripped: ${agentRiskState.consecutiveFailures} consecutive failures reached threshold of ${policy.maxConsecutiveFailures}`
        : `Circuit breaker healthy (${agentRiskState.consecutiveFailures} / ${policy.maxConsecutiveFailures} failures)`,
      failureCode: isTriggered ? 'ERR_CIRCUIT_BREAKER_TRIGGERED' : undefined,
    });
  }

  // Daily budget check
  if (policy.dailyTradeBudgetUsd !== undefined && policy.dailyTradeBudgetUsd > 0) {
    const current24h = agentRiskState?.tradesExecuted24hUsd ?? 0;
    const prospectiveTotal = current24h + intent.tradeAmountUsd;
    const passed = prospectiveTotal <= policy.dailyTradeBudgetUsd;
    results.push({
      checkName: 'DAILY_TRADE_BUDGET',
      passed,
      expectedBpsOrValue: policy.dailyTradeBudgetUsd,
      actualBpsOrValue: prospectiveTotal,
      description: passed
        ? `Daily trade volume within 24h budget ($${prospectiveTotal.toLocaleString()} <= $${policy.dailyTradeBudgetUsd.toLocaleString()})`
        : `Daily trade budget exceeded: prospective 24h volume of $${prospectiveTotal.toLocaleString()} exceeds cap of $${policy.dailyTradeBudgetUsd.toLocaleString()}`,
      failureCode: passed ? undefined : 'ERR_DAILY_BUDGET_EXCEEDED',
    });
  }

  return results;
}

/**
 * Checks oracle quote freshness age in seconds
 */
export function checkQuoteFreshness(
  priceSource?: PriceSource | NormalizedMarketPrice,
  maxQuoteAgeSeconds?: number,
  now: number = Date.now()
): PostconditionCheckResult {
  if (!maxQuoteAgeSeconds || !priceSource || !priceSource.publishTime) {
    return {
      checkName: 'QUOTE_FRESHNESS',
      passed: true,
      expectedBpsOrValue: maxQuoteAgeSeconds ?? 60,
      actualBpsOrValue: 0,
      description: 'Quote freshness check passed',
    };
  }

  const pubMs = priceSource.publishTime > 1e11 ? priceSource.publishTime : priceSource.publishTime * 1000;
  const ageSec = Math.max(0, Math.round((now - pubMs) / 1000));
  const passed = ageSec <= maxQuoteAgeSeconds;
  return {
    checkName: 'QUOTE_FRESHNESS',
    passed,
    expectedBpsOrValue: maxQuoteAgeSeconds,
    actualBpsOrValue: ageSec,
    description: passed
      ? `Pyth oracle quote age (${ageSec}s <= ${maxQuoteAgeSeconds}s) is fresh`
      : `Oracle quote is stale: age of ${ageSec}s exceeds freshness ceiling of ${maxQuoteAgeSeconds}s`,
    failureCode: passed ? undefined : 'ERR_QUOTE_STALE',
  };
}

/**
 * Checks estimated price impact in basis points
 */
export function checkPriceImpact(
  intent: TradeIntent,
  maxPriceImpactBps?: number,
  liquidityDepthUsd?: number
): PostconditionCheckResult {
  if (!maxPriceImpactBps || !liquidityDepthUsd || liquidityDepthUsd <= 0) {
    return {
      checkName: 'PRICE_IMPACT',
      passed: true,
      expectedBpsOrValue: maxPriceImpactBps ?? 100,
      actualBpsOrValue: 0,
      description: 'Price impact check passed',
    };
  }

  const impactBps = Math.round((intent.tradeAmountUsd / liquidityDepthUsd) * 10_000);
  const passed = impactBps <= maxPriceImpactBps;
  return {
    checkName: 'PRICE_IMPACT',
    passed,
    expectedBpsOrValue: maxPriceImpactBps,
    actualBpsOrValue: impactBps,
    description: passed
      ? `Estimated price impact (${(impactBps / 100).toFixed(2)}% <= ${(maxPriceImpactBps / 100).toFixed(2)}%) is acceptable`
      : `Price impact exceeded: trade would cause estimated ${(impactBps / 100).toFixed(2)}% impact, exceeding limit of ${(maxPriceImpactBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_PRICE_IMPACT_EXCEEDED',
  };
}

/**
 * Checks market hours and venue health
 */
export function checkMarketStatusAndVenueHealth(
  priceSource?: PriceSource | NormalizedMarketPrice,
  venueDetails?: { venueType?: string; isHealthy?: boolean; liquidityDepthUsd?: number },
  policy?: FinancialPolicy
): PostconditionCheckResult[] {
  const checks: PostconditionCheckResult[] = [];

  if (policy?.marketHoursOnly && priceSource?.marketStatus === 'MARKET_CLOSED') {
    checks.push({
      checkName: 'MARKET_STATUS',
      passed: false,
      expectedBpsOrValue: 'MARKET_OPEN',
      actualBpsOrValue: 'MARKET_CLOSED',
      description: 'Underlying equity market is currently closed. Policy restricts trading to active market hours.',
      failureCode: 'ERR_MARKET_UNAVAILABLE',
    });
  }

  if (policy?.requireHealthyVenue && venueDetails?.isHealthy === false) {
    checks.push({
      checkName: 'VENUE_HEALTH',
      passed: false,
      expectedBpsOrValue: 'HEALTHY',
      actualBpsOrValue: 'UNHEALTHY',
      description: `Target venue ${venueDetails.venueType ?? 'Venue'} is reporting degraded health or paused trading.`,
      failureCode: 'ERR_VENUE_UNHEALTHY',
    });
  }

  return checks;
}

/**
 * Evaluates all financial postconditions for a proposed state transition
 * Comprehensive Phase 6 Risk Engine DSL
 */
export function evaluatePostconditions(
  preState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  actualExecutionPrice?: number,
  priceSource?: PriceSource | NormalizedMarketPrice,
  agentRiskState?: AgentRiskState,
  venueDetails?: { venueType?: string; isHealthy?: boolean; liquidityDepthUsd?: number },
  currentTime: number = Date.now()
): EvaluationOutcome {
  if (!policy.isActive) {
    throw new Error('Cannot evaluate against an inactive policy');
  }

  // Pre-check Emergency Pause (Kill switch)
  if (policy.isEmergencyPaused) {
    const postState = simulateStateTransition(preState, intent, actualExecutionPrice);
    return {
      allPassed: false,
      checks: [{
        checkName: 'EMERGENCY_PAUSE',
        passed: false,
        expectedBpsOrValue: 'OPERATIONAL',
        actualBpsOrValue: 'EMERGENCY_PAUSED',
        description: 'Emergency kill switch is ACTIVE: all state transitions are blocked',
        failureCode: 'ERR_EMERGENCY_PAUSE',
      }],
      failureCode: 'ERR_EMERGENCY_PAUSE',
      failureReason: 'Emergency kill switch is ACTIVE: all state transitions are blocked',
      postState,
    };
  }

  // Pre-check Policy Expiry
  if (policy.policyExpiresAt && currentTime > policy.policyExpiresAt) {
    const postState = simulateStateTransition(preState, intent, actualExecutionPrice);
    return {
      allPassed: false,
      checks: [{
        checkName: 'POLICY_EXPIRY',
        passed: false,
        expectedBpsOrValue: policy.policyExpiresAt,
        actualBpsOrValue: currentTime,
        description: `Policy expired at ${new Date(policy.policyExpiresAt).toISOString()}`,
        failureCode: 'ERR_POLICY_EXPIRED',
      }],
      failureCode: 'ERR_POLICY_EXPIRED',
      failureReason: 'Policy validity window has expired',
      postState,
    };
  }

  // Pre-check Asset Allowlist
  if (policy.assetAllowlist && policy.assetAllowlist.length > 0) {
    const isAllowed = policy.assetAllowlist.includes(intent.assetSymbol) || policy.assetAllowlist.includes(intent.assetMint);
    if (!isAllowed) {
      const postState = simulateStateTransition(preState, intent, actualExecutionPrice);
      return {
        allPassed: false,
        checks: [{
          checkName: 'ASSET_ALLOWLIST',
          passed: false,
          expectedBpsOrValue: policy.assetAllowlist.join(', '),
          actualBpsOrValue: intent.assetSymbol,
          description: `Asset ${intent.assetSymbol} is NOT permitted by policy asset allowlist`,
          failureCode: 'ERR_ASSET_NOT_ALLOWED',
        }],
        failureCode: 'ERR_ASSET_NOT_ALLOWED',
        failureReason: `Asset ${intent.assetSymbol} is not on the authorized asset allowlist`,
        postState,
      };
    }
  }

  // Pre-check Venue Allowlist
  if (policy.venueAllowlist && policy.venueAllowlist.length > 0 && venueDetails?.venueType) {
    const isAllowed = policy.venueAllowlist.includes(venueDetails.venueType);
    if (!isAllowed) {
      const postState = simulateStateTransition(preState, intent, actualExecutionPrice);
      return {
        allPassed: false,
        checks: [{
          checkName: 'VENUE_ALLOWLIST',
          passed: false,
          expectedBpsOrValue: policy.venueAllowlist.join(', '),
          actualBpsOrValue: venueDetails.venueType,
          description: `Execution venue ${venueDetails.venueType} is NOT authorized by policy venue allowlist`,
          failureCode: 'ERR_VENUE_NOT_ALLOWED',
        }],
        failureCode: 'ERR_VENUE_NOT_ALLOWED',
        failureReason: `Execution venue ${venueDetails.venueType} is not on the authorized venue allowlist`,
        postState,
      };
    }
  }

  // Pre-check solvency
  const usdcAsset = preState.assets.find(a => a.isStablecoin || a.symbol === 'USDC');
  if (intent.direction === 'BUY' && usdcAsset && usdcAsset.valueUsd < intent.tradeAmountUsd) {
    const postState = simulateStateTransition(preState, intent, actualExecutionPrice);
    return {
      allPassed: false,
      checks: [{
        checkName: 'MIN_STABLECOIN',
        passed: false,
        expectedBpsOrValue: intent.tradeAmountUsd,
        actualBpsOrValue: usdcAsset.valueUsd,
        description: `Insufficient stablecoin balance ($${usdcAsset.valueUsd.toLocaleString()} < trade $${intent.tradeAmountUsd.toLocaleString()})`,
        failureCode: 'ERR_INSUFFICIENT_FUNDS',
      }],
      failureCode: 'ERR_INSUFFICIENT_FUNDS',
      failureReason: 'Insufficient stablecoin reserve to fund the proposed trade',
      postState,
    };
  }

  // 1. Simulate hypothetical state transition
  const postState = simulateStateTransition(preState, intent, actualExecutionPrice);

  // 2. Evaluate all postconditions across 5 risk tiers
  const checks: PostconditionCheckResult[] = [
    // Tier 1: Hard Invariants
    checkMaxSingleAsset(postState, policy.maxSingleAssetBps, intent.assetSymbol),
    checkMinStablecoin(postState, policy.minStablecoinBps),
    checkMaxTradeSize(intent, policy.maxTradeValueUsd),
  ];

  if (actualExecutionPrice !== undefined) {
    checks.push(checkSlippage(intent.referencePriceUsd, actualExecutionPrice, policy.maxSlippageBps));
  }

  // Tier 2: Portfolio Constraints
  if (policy.maxSectorExposureBps !== undefined) {
    checks.push(checkMaxSectorExposure(postState, policy.maxSectorExposureBps));
  }

  if (policy.maxIssuerExposureBps !== undefined) {
    checks.push(checkMaxIssuerExposure(postState, policy.maxIssuerExposureBps));
  }

  if (policy.maxPositions !== undefined) {
    checks.push(checkMaxPositions(postState, policy.maxPositions));
  }

  if (policy.minDiversificationAssets !== undefined) {
    checks.push(checkDiversification(postState, policy.minDiversificationAssets));
  }

  if (policy.maxPreIpoExposureBps !== undefined) {
    checks.push(checkPreIpoExposure(postState, policy.maxPreIpoExposureBps));
  }

  if (policy.maxPublicEquitiesExposureBps !== undefined) {
    checks.push(checkPublicEquitiesExposure(postState, policy.maxPublicEquitiesExposureBps));
  }

  // Phase 12: ClawPump Anti-Self-Dealing Guard (Evaluated when trading agent token)
  if (intent.assetSymbol === 'ROBOx' || intent.assetSymbol.includes('ROBO')) {
    checks.push(checkAgentSelfDealing(postState, policy.maxAgentTokenExposureBps ?? 500, intent.assetSymbol));
  }

  // Phase 12: Tessera Fractional SPV Tranche Safeguards (Evaluated when trading Tessera private assets)
  if (getTesseraTranche(intent.assetSymbol) && (policy.maxTesseraNavPremiumBps !== undefined || venueDetails?.venueType === 'TESSERA_VAULT')) {
    checks.push(checkTesseraTrancheEligibility(intent, policy.maxTesseraNavPremiumBps ?? 1500, currentTime));
  }

  // Tier 3: Trading Constraints
  if (policy.maxQuoteAgeSeconds !== undefined && priceSource) {
    checks.push(checkQuoteFreshness(priceSource, policy.maxQuoteAgeSeconds, currentTime));
  }

  if (policy.maxPriceImpactBps !== undefined && venueDetails?.liquidityDepthUsd) {
    checks.push(checkPriceImpact(intent, policy.maxPriceImpactBps, venueDetails.liquidityDepthUsd));
  }

  // Tier 4: Agent Constraints
  if (agentRiskState || policy.dailyTradeBudgetUsd !== undefined || policy.maxConsecutiveFailures !== undefined) {
    checks.push(...checkDailyBudgetAndCircuitBreaker(intent, policy, agentRiskState));
  }

  // Tier 5: Market & Venue Constraints
  if (priceSource) {
    const price = 'priceUsd' in priceSource ? priceSource.priceUsd : priceSource.price;
    const confidence = 'confidenceUsd' in priceSource ? priceSource.confidenceUsd : priceSource.confidence;
    const confidenceRatioBps = price > 0 ? Math.round((confidence * 10_000) / price) : 0;
    const maxConfidenceBps = policy.maxOracleConfidenceBps ?? 150; // 1.50%

    const confPassed = confidenceRatioBps <= maxConfidenceBps;
    checks.push({
      checkName: 'ORACLE_CONFIDENCE',
      passed: confPassed,
      expectedBpsOrValue: maxConfidenceBps,
      actualBpsOrValue: confidenceRatioBps,
      description: confPassed
        ? `Oracle confidence interval ±$${confidence} (${(confidenceRatioBps / 100).toFixed(2)}%) is within tolerance`
        : `Oracle confidence interval ±$${confidence} (${(confidenceRatioBps / 100).toFixed(2)}%) exceeds limit of ${(maxConfidenceBps / 100).toFixed(2)}%`,
      failureCode: confPassed ? undefined : 'ERR_ORACLE_CONFIDENCE_TOO_WIDE',
    });

    if (priceSource.trackingErrorBps !== undefined) {
      const maxTrackingBps = policy.maxTrackingErrorBps ?? 250; // 2.50%
      const trackingPassed = priceSource.trackingErrorBps <= maxTrackingBps;
      checks.push({
        checkName: 'TRACKING_ERROR',
        passed: trackingPassed,
        expectedBpsOrValue: maxTrackingBps,
        actualBpsOrValue: priceSource.trackingErrorBps,
        description: trackingPassed
          ? `Peg tracking error ${(priceSource.trackingErrorBps / 100).toFixed(2)}% is within authorization`
          : `Peg tracking error ${(priceSource.trackingErrorBps / 100).toFixed(2)}% exceeds ceiling of ${(maxTrackingBps / 100).toFixed(2)}%`,
        failureCode: trackingPassed ? undefined : 'ERR_TRACKING_ERROR_EXCEEDED',
      });
    }
  }

  // Market status and venue health
  checks.push(...checkMarketStatusAndVenueHealth(priceSource, venueDetails, policy));

  const failedChecks = checks.filter(c => !c.passed);
  const allPassed = failedChecks.length === 0;

  const firstFailure = failedChecks[0];
  const failureCode: FailureCode | undefined = firstFailure ? firstFailure.failureCode : undefined;
  const failureReason: string | undefined = firstFailure ? firstFailure.description : undefined;

  return {
    allPassed,
    checks,
    failureCode,
    failureReason,
    postState,
  };
}

// -----------------------------------------------------------------------------
// Canonical Risk-Policy DSL Profiles (with Phase 11 PreStocks Asset Classes)
// -----------------------------------------------------------------------------

export const CONSERVATIVE_INSTITUTIONAL_POLICY: FinancialPolicy = {
  policyId: 'policy_conservative_institutional',
  owner: 'SentinelRiskCommittee111111111111111111111',
  maxSingleAssetBps: 1500, // 15.00%
  minStablecoinBps: 3000,  // 30.00%
  maxPublicEquitiesExposureBps: 6000, // 60.00%
  maxPreIpoExposureBps: 1000,         // 10.00%
  maxAgentTokenExposureBps: 0,        // 0.00% (No agent self-dealing permitted)
  maxTesseraNavPremiumBps: 1000,      // 10.00% max secondary premium over NAV
  maxTradeValueUsd: 5000,  // $5,000
  maxSlippageBps: 50,      // 0.50%
  maxSectorExposureBps: 3000, // 30.00%
  maxIssuerExposureBps: 4000, // 40.00%
  maxPositions: 6,
  minDiversificationAssets: 3,
  maxTurnoverBps: 1500,    // 15.00%
  maxPriceDeviationBps: 100, // 1.00%
  maxQuoteAgeSeconds: 45,
  minLiquidityUsd: 50_000,
  maxPriceImpactBps: 50,   // 0.50%
  dailyTradeBudgetUsd: 25_000,
  maxConsecutiveFailures: 2,
  policyVersion: 1,
  isActive: true,
  updatedAt: Date.now(),
};

export const BALANCED_MULTI_ASSET_POLICY: FinancialPolicy = {
  policyId: 'policy_balanced_multi_asset',
  owner: 'SentinelRiskCommittee111111111111111111111',
  maxSingleAssetBps: 2500, // 25.00%
  minStablecoinBps: 2000,  // 20.00%
  maxPublicEquitiesExposureBps: 8000, // 80.00%
  maxPreIpoExposureBps: 2000,         // 20.00%
  maxAgentTokenExposureBps: 500,      // 5.00% cap on agent's own token
  maxTesseraNavPremiumBps: 1500,      // 15.00% max secondary premium over NAV
  maxTradeValueUsd: 10000, // $10,000
  maxSlippageBps: 100,     // 1.00%
  maxSectorExposureBps: 4500, // 45.00%
  maxIssuerExposureBps: 5000, // 50.00%
  maxPositions: 8,
  minDiversificationAssets: 2,
  maxTurnoverBps: 2500,    // 25.00%
  maxPriceDeviationBps: 200, // 2.00%
  maxQuoteAgeSeconds: 60,
  minLiquidityUsd: 25_000,
  maxPriceImpactBps: 75,   // 0.75%
  dailyTradeBudgetUsd: 50_000,
  maxConsecutiveFailures: 3,
  policyVersion: 1,
  isActive: true,
  updatedAt: Date.now(),
};

export const HIGH_ALPHA_GROWTH_POLICY: FinancialPolicy = {
  policyId: 'policy_high_alpha_growth',
  owner: 'SentinelRiskCommittee111111111111111111111',
  maxSingleAssetBps: 3500, // 35.00%
  minStablecoinBps: 1500,  // 15.00%
  maxPublicEquitiesExposureBps: 7500, // 75.00%
  maxPreIpoExposureBps: 2500,         // 25.00%
  maxAgentTokenExposureBps: 1000,     // 10.00% cap on agent's own token
  maxTesseraNavPremiumBps: 2000,      // 20.00% max secondary premium over NAV
  maxTradeValueUsd: 25000, // $25,000
  maxSlippageBps: 150,     // 1.50%
  maxSectorExposureBps: 6000, // 60.00%
  maxIssuerExposureBps: 7000, // 70.00%
  maxPositions: 12,
  minDiversificationAssets: 1,
  maxTurnoverBps: 5000,    // 50.00%
  maxPriceDeviationBps: 300, // 3.00%
  maxQuoteAgeSeconds: 90,
  minLiquidityUsd: 15_000,
  maxPriceImpactBps: 150,  // 1.50%
  dailyTradeBudgetUsd: 100_000,
  maxConsecutiveFailures: 5,
  policyVersion: 1,
  isActive: true,
  updatedAt: Date.now(),
};
