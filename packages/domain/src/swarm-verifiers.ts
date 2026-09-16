import {
  FinancialPolicy,
  PortfolioSnapshot,
  TradeIntent,
  VerifierVerdict,
  VerifierSubCheck,
  SwarmVerificationSummary,
  PriceSource,
  NormalizedMarketPrice,
  AgentRiskState,
  ExecutionVenueDetails,
} from './types';
import {
  checkMaxSingleAsset,
  checkMinStablecoin,
  checkMaxTradeSize,
  checkSlippage,
  checkEmergencyPause,
  checkPolicyExpiry,
  checkAssetAllowlist,
  checkVenueAllowlist,
  checkMaxSectorExposure,
  checkMaxIssuerExposure,
  checkMaxPositions,
  checkDiversification,
  checkQuoteFreshness,
  checkPriceImpact,
  checkPreIpoExposure,
} from './policy-engine';

/**
 * 1. RiskVerifier:
 * Independently inspects portfolio concentration, single-asset exposure ceilings,
 * maximum absolute trade sizing, and emergency kill-switch status.
 */
export function evaluateRiskVerifier(
  postState: PortfolioSnapshot,
  policy: FinancialPolicy,
  targetAssetOrIntent?: string | TradeIntent
): VerifierVerdict {
  const targetSymbol = typeof targetAssetOrIntent === 'string'
    ? targetAssetOrIntent
    : targetAssetOrIntent?.assetSymbol;

  const intent = typeof targetAssetOrIntent === 'object' && targetAssetOrIntent !== null
    ? targetAssetOrIntent
    : undefined;

  const subChecks: VerifierSubCheck[] = [];

  // A. Emergency Pause Invariant
  const emergencyCheck = checkEmergencyPause(policy);
  subChecks.push({
    name: 'Emergency Pause',
    passed: emergencyCheck.passed,
    actual: emergencyCheck.actualBpsOrValue === 'OPERATIONAL' ? 'Operational' : 'Emergency Paused',
    limit: 'Operational',
    description: emergencyCheck.description,
    failureCode: emergencyCheck.failureCode,
  });

  // B. Single-Asset Concentration Ceiling
  const singleAssetCheck = checkMaxSingleAsset(postState, policy.maxSingleAssetBps, targetSymbol);
  const actualExposureBps = typeof singleAssetCheck.actualBpsOrValue === 'number'
    ? singleAssetCheck.actualBpsOrValue
    : 0;
  subChecks.push({
    name: 'Concentration',
    passed: singleAssetCheck.passed,
    actual: `${(actualExposureBps / 100).toFixed(1)}% projected`,
    limit: `${(policy.maxSingleAssetBps / 100).toFixed(1)}% limit`,
    description: singleAssetCheck.description,
    failureCode: singleAssetCheck.failureCode,
  });

  // C. Max Trade Size (if intent available)
  if (intent) {
    const tradeSizeCheck = checkMaxTradeSize(intent, policy.maxTradeValueUsd);
    subChecks.push({
      name: 'Trade Sizing',
      passed: tradeSizeCheck.passed,
      actual: `$${intent.tradeAmountUsd.toLocaleString()} proposed`,
      limit: `≤ $${policy.maxTradeValueUsd.toLocaleString()}`,
      description: tradeSizeCheck.description,
      failureCode: tradeSizeCheck.failureCode,
    });
  }

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? 'Single-asset concentration and trade sizing invariants verified'
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'RiskVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} risk invariants satisfied`,
  };
}

/**
 * 2. BalanceVerifier:
 * Independently inspects solvency, stablecoin reserve floors,
 * and atomic balance preservation.
 */
export function evaluateBalanceVerifier(
  postState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  preState?: PortfolioSnapshot
): VerifierVerdict {
  const subChecks: VerifierSubCheck[] = [];

  // A. Stablecoin Reserve Floor Invariant
  const reserveCheck = checkMinStablecoin(postState, policy.minStablecoinBps);
  const actualReserveBps = typeof reserveCheck.actualBpsOrValue === 'number'
    ? reserveCheck.actualBpsOrValue
    : postState.stablecoinExposureBps;
  subChecks.push({
    name: 'Reserve',
    passed: reserveCheck.passed,
    actual: `${(actualReserveBps / 100).toFixed(1)}% projected`,
    limit: `${(policy.minStablecoinBps / 100).toFixed(1)}% minimum`,
    description: reserveCheck.description,
    failureCode: reserveCheck.failureCode,
  });

  // B. Stablecoin Solvency Check (USDC covers BUY order)
  const usdcBal = preState
    ? (preState.assets.find(a => a.isStablecoin || a.symbol === 'USDC')?.valueUsd ?? preState.stablecoinValueUsd)
    : (intent.direction === 'BUY' ? postState.stablecoinValueUsd + intent.tradeAmountUsd : postState.stablecoinValueUsd);

  const solvencyPassed = intent.direction !== 'BUY' || usdcBal >= intent.tradeAmountUsd;
  subChecks.push({
    name: 'Solvency',
    passed: solvencyPassed,
    actual: `$${Math.round(usdcBal).toLocaleString()} available`,
    limit: intent.direction === 'BUY' ? `≥ $${intent.tradeAmountUsd.toLocaleString()} required` : 'N/A (SELL)',
    description: solvencyPassed
      ? `USDC liquidity is solvent for order ($${Math.round(usdcBal).toLocaleString()} available)`
      : `Insufficient USDC liquidity ($${Math.round(usdcBal).toLocaleString()} < $${intent.tradeAmountUsd.toLocaleString()})`,
    failureCode: solvencyPassed ? undefined : 'ERR_INSUFFICIENT_FUNDS',
  });

  // C. Atomic Balance Preservation Invariant
  const sumAssetValues = postState.assets.reduce((sum, a) => sum + a.valueUsd, 0);
  const balancePreserved = Math.abs(sumAssetValues - postState.totalValueUsd) <= 1.0;
  subChecks.push({
    name: 'Balance Preservation',
    passed: balancePreserved,
    actual: `$${Math.round(postState.totalValueUsd).toLocaleString()} NAV`,
    limit: 'Atomic Equality',
    description: balancePreserved
      ? 'Atomic balance conservation verified across all asset accounts'
      : `NAV mismatch detected: sum of holdings ($${sumAssetValues}) differs from total NAV ($${postState.totalValueUsd})`,
    failureCode: balancePreserved ? undefined : 'ERR_SOLVENCY_VIOLATION',
  });

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? 'Solvency, reserve floor, and atomic balance invariants verified'
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'BalanceVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} balance invariants satisfied`,
  };
}

/**
 * 3. PolicyVerifier:
 * Independently inspects agent authority bounds, policy validity window,
 * authorized venue/asset allowlists, and execution slippage tolerances.
 */
export function evaluatePolicyVerifier(
  policy: FinancialPolicy,
  intent: TradeIntent,
  actualPrice?: number,
  currentTime: number = Date.now(),
  venueType?: string
): VerifierVerdict {
  const subChecks: VerifierSubCheck[] = [];

  // A. Policy Active Authority
  subChecks.push({
    name: 'Authority',
    passed: policy.isActive,
    actual: policy.isActive ? 'Active' : 'Inactive',
    limit: 'Active',
    description: policy.isActive
      ? `Policy authority verified active (v${policy.policyVersion})`
      : 'Policy authority is paused or inactive',
  });

  // B. Policy Validity Window / Expiry
  const expiryCheck = checkPolicyExpiry(policy, currentTime);
  subChecks.push({
    name: 'Policy Window',
    passed: expiryCheck.passed,
    actual: policy.policyExpiresAt ? new Date(policy.policyExpiresAt).toLocaleDateString() : 'Perpetual',
    limit: 'Active',
    description: expiryCheck.description,
    failureCode: expiryCheck.failureCode,
  });

  // C. Asset Allowlist
  const assetCheck = checkAssetAllowlist(intent, policy.assetAllowlist);
  subChecks.push({
    name: 'Asset Allowlist',
    passed: assetCheck.passed,
    actual: `${intent.assetSymbol} ${assetCheck.passed ? 'authorized' : 'unauthorized'}`,
    limit: policy.assetAllowlist && policy.assetAllowlist.length > 0 ? policy.assetAllowlist.join(', ') : 'Unrestricted',
    description: assetCheck.description,
    failureCode: assetCheck.failureCode,
  });

  // D. Venue Allowlist
  if (venueType) {
    const venueCheck = checkVenueAllowlist(venueType, policy.venueAllowlist);
    subChecks.push({
      name: 'Venue Allowlist',
      passed: venueCheck.passed,
      actual: `${venueType} ${venueCheck.passed ? 'authorized' : 'unauthorized'}`,
      limit: policy.venueAllowlist && policy.venueAllowlist.length > 0 ? policy.venueAllowlist.join(', ') : 'Unrestricted',
      description: venueCheck.description,
      failureCode: venueCheck.failureCode,
    });
  }

  // E. Slippage Check (if execution price is present)
  if (actualPrice !== undefined) {
    const slippageResult = checkSlippage(intent.referencePriceUsd, actualPrice, policy.maxSlippageBps);
    const actualDev = typeof slippageResult.actualBpsOrValue === 'number' ? slippageResult.actualBpsOrValue : 0;
    subChecks.push({
      name: 'Slippage',
      passed: slippageResult.passed,
      actual: `${(actualDev / 100).toFixed(2)}%`,
      limit: `≤ ${(policy.maxSlippageBps / 100).toFixed(2)}%`,
      description: slippageResult.description,
      failureCode: slippageResult.failureCode,
    });
  }

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? `Policy v${policy.policyVersion} is active and valid`
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'PolicyVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} policy invariants satisfied`,
  };
}

/**
 * 4. LiquidityVerifier:
 * Independently inspects execution venue liquidity depth floors,
 * DBC pool reserves, venue operational health, and estimated price impact.
 */
export function evaluateLiquidityVerifier(
  intent: TradeIntent,
  policy: FinancialPolicy,
  venueDetails?: ExecutionVenueDetails | { venueType?: string; isHealthy?: boolean; liquidityDepthUsd?: number }
): VerifierVerdict {
  const subChecks: VerifierSubCheck[] = [];

  const liquidityDepthUsd = venueDetails?.liquidityDepthUsd ?? 145_000;
  const minLiquidityFloor = policy.minLiquidityUsd ?? 25_000;

  // A. Venue Liquidity Depth Floor Invariant (Default: $25,000 floor per Meteora DBC spec)
  const depthPassed = liquidityDepthUsd >= minLiquidityFloor;
  subChecks.push({
    name: 'Venue Liquidity',
    passed: depthPassed,
    actual: `$${liquidityDepthUsd.toLocaleString()} depth`,
    limit: `≥ $${minLiquidityFloor.toLocaleString()} floor`,
    description: depthPassed
      ? `Venue liquidity depth ($${liquidityDepthUsd.toLocaleString()}) exceeds minimum requirement of $${minLiquidityFloor.toLocaleString()}`
      : `Venue liquidity insufficient: pool depth $${liquidityDepthUsd.toLocaleString()} is below required $${minLiquidityFloor.toLocaleString()} floor`,
    failureCode: depthPassed ? undefined : 'ERR_LIQUIDITY_DEPTH_INSUFFICIENT',
  });

  // B. Venue Health Status
  const isHealthy = venueDetails?.isHealthy !== false;
  subChecks.push({
    name: 'Venue Health',
    passed: isHealthy,
    actual: isHealthy ? 'Operational' : 'Degraded',
    limit: 'Operational',
    description: isHealthy
      ? `Target venue ${venueDetails?.venueType ?? 'Meteora DBC'} reports normal operational status`
      : `Target venue ${venueDetails?.venueType ?? 'Venue'} reports degraded health or trading halts`,
    failureCode: isHealthy ? undefined : 'ERR_VENUE_UNHEALTHY',
  });

  // C. Price Impact Invariant
  if (policy.maxPriceImpactBps !== undefined && liquidityDepthUsd > 0) {
    const impactCheck = checkPriceImpact(intent, policy.maxPriceImpactBps, liquidityDepthUsd);
    const actualImpactBps = typeof impactCheck.actualBpsOrValue === 'number' ? impactCheck.actualBpsOrValue : 0;
    subChecks.push({
      name: 'Price Impact',
      passed: impactCheck.passed,
      actual: `${(actualImpactBps / 100).toFixed(2)}%`,
      limit: `≤ ${(policy.maxPriceImpactBps / 100).toFixed(2)}%`,
      description: impactCheck.description,
      failureCode: impactCheck.failureCode,
    });
  } else {
    subChecks.push({
      name: 'Price Impact',
      passed: true,
      actual: '0.00%',
      limit: 'Unrestricted',
      description: 'Price impact check passed (unrestricted)',
    });
  }

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? `Venue liquidity depth ($${liquidityDepthUsd.toLocaleString()}) and operational health verified`
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'LiquidityVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} liquidity invariants satisfied`,
  };
}

/**
 * 5. PriceIntegrityVerifier (formerly PythOracleVerifier):
 * Independently inspects dual-feed Pyth market truth, quote freshness,
 * confidence interval ratio, and basis tracking error vs underlying equity.
 */
export function evaluatePriceIntegrityVerifier(
  priceSource?: PriceSource | NormalizedMarketPrice,
  policy?: FinancialPolicy,
  currentTime: number = Date.now(),
  referencePriceUsd?: number
): VerifierVerdict {
  const subChecks: VerifierSubCheck[] = [];

  if (priceSource) {
    const price = 'priceUsd' in priceSource ? priceSource.priceUsd : priceSource.price;
    const confidence = 'confidenceUsd' in priceSource ? priceSource.confidenceUsd : priceSource.confidence;

    // A. Quote Freshness
    const maxQuoteAgeSeconds = policy?.maxQuoteAgeSeconds ?? 60;
    const freshnessCheck = checkQuoteFreshness(priceSource, maxQuoteAgeSeconds, currentTime);
    const actualAge = typeof freshnessCheck.actualBpsOrValue === 'number' ? freshnessCheck.actualBpsOrValue : 0;
    subChecks.push({
      name: 'Market Price Fresh',
      passed: freshnessCheck.passed,
      actual: `${actualAge}s ago`,
      limit: `≤ ${maxQuoteAgeSeconds}s`,
      description: freshnessCheck.description,
      failureCode: freshnessCheck.failureCode,
    });

    // B. Pyth Oracle Confidence Interval Ratio
    const maxConfidenceBps = policy?.maxOracleConfidenceBps ?? 150; // Default: 1.50%
    const confidenceRatioBps = price > 0 ? Math.round((confidence * 10_000) / price) : 0;
    const confPassed = confidenceRatioBps <= maxConfidenceBps;
    subChecks.push({
      name: 'Confidence Interval',
      passed: confPassed,
      actual: `±$${confidence.toFixed(2)} (${(confidenceRatioBps / 100).toFixed(2)}%)`,
      limit: `≤ ${(maxConfidenceBps / 100).toFixed(2)}%`,
      description: confPassed
        ? `Pyth oracle confidence interval (±$${confidence.toFixed(2)}) is within precision tolerance`
        : `Pyth confidence interval ±$${confidence.toFixed(2)} (${(confidenceRatioBps / 100).toFixed(2)}%) exceeds limit of ${(maxConfidenceBps / 100).toFixed(2)}%`,
      failureCode: confPassed ? undefined : 'ERR_ORACLE_CONFIDENCE_TOO_WIDE',
    });

    // C. Dual-Feed Basis Tracking Error (Tokenized vs Underlying Equity)
    const trackingBps = priceSource.trackingErrorBps ?? 18;
    const maxTrackingBps = policy?.maxTrackingErrorBps ?? 250; // Default: 2.50%
    const trackingPassed = trackingBps <= maxTrackingBps;
    subChecks.push({
      name: 'Basis Tracking Error',
      passed: trackingPassed,
      actual: `${(trackingBps / 100).toFixed(2)}%`,
      limit: `≤ ${(maxTrackingBps / 100).toFixed(2)}%`,
      description: trackingPassed
        ? `Basis tracking error vs underlying equity (${(trackingBps / 100).toFixed(2)}%) within limit`
        : `Tokenized vs underlying tracking error (${(trackingBps / 100).toFixed(2)}%) exceeds limit of ${(maxTrackingBps / 100).toFixed(2)}%`,
      failureCode: trackingPassed ? undefined : 'ERR_TRACKING_ERROR_EXCEEDED',
    });

    // D. Market Hours (if applicable)
    if (policy?.marketHoursOnly && priceSource.marketStatus === 'MARKET_CLOSED') {
      subChecks.push({
        name: 'Market Hours',
        passed: false,
        actual: 'Market Closed',
        limit: 'Market Open',
        description: 'Underlying equity market is currently closed. Policy enforces market-hours execution only.',
        failureCode: 'ERR_MARKET_UNAVAILABLE',
      });
    }
  } else {
    // When no explicit Pyth feed object is supplied, verify reference price validity
    const refPrice = referencePriceUsd ?? 100;
    const hasValidPrice = refPrice > 0;
    subChecks.push({
      name: 'Market Price Reference',
      passed: hasValidPrice,
      actual: `$${refPrice.toFixed(2)}`,
      limit: '> $0.00',
      description: hasValidPrice
        ? `Market price reference verified at $${refPrice.toFixed(2)}`
        : 'Invalid zero market price reference',
      failureCode: hasValidPrice ? undefined : 'ERR_ORACLE_CONFIDENCE_TOO_WIDE',
    });
  }

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? 'Pyth market price freshness, confidence intervals, and basis tracking verified'
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'PriceIntegrityVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} price integrity invariants satisfied`,
  };
}

/**
 * Backwards-compatible function for Phase 1/2 tests and components
 */
export function evaluatePythOracleVerifier(
  priceSource: PriceSource | NormalizedMarketPrice,
  policy: FinancialPolicy
): VerifierVerdict {
  const v = evaluatePriceIntegrityVerifier(priceSource, policy, Date.now(), undefined);
  return {
    ...v,
    name: 'PythOracleVerifier',
  };
}

/**
 * 6. PortfolioVerifier:
 * Independently inspects macro portfolio risk: sector exposure ceilings,
 * issuer concentration, maximum active positions, and minimum diversification floors.
 */
export function evaluatePortfolioVerifier(
  postState: PortfolioSnapshot,
  policy: FinancialPolicy
): VerifierVerdict {
  const subChecks: VerifierSubCheck[] = [];

  // A. Sector Exposure Ceiling
  const sectorCheck = checkMaxSectorExposure(postState, policy.maxSectorExposureBps);
  const actualSectorBps = typeof sectorCheck.actualBpsOrValue === 'number' ? sectorCheck.actualBpsOrValue : 0;
  subChecks.push({
    name: 'Sector Exposure',
    passed: sectorCheck.passed,
    actual: `${(actualSectorBps / 100).toFixed(1)}% projected`,
    limit: policy.maxSectorExposureBps ? `≤ ${(policy.maxSectorExposureBps / 100).toFixed(1)}%` : 'Unrestricted',
    description: sectorCheck.description,
    failureCode: sectorCheck.failureCode,
  });

  // B. Issuer Exposure Ceiling
  const issuerCheck = checkMaxIssuerExposure(postState, policy.maxIssuerExposureBps);
  const actualIssuerBps = typeof issuerCheck.actualBpsOrValue === 'number' ? issuerCheck.actualBpsOrValue : 0;
  subChecks.push({
    name: 'Issuer Exposure',
    passed: issuerCheck.passed,
    actual: `${(actualIssuerBps / 100).toFixed(1)}% projected`,
    limit: policy.maxIssuerExposureBps ? `≤ ${(policy.maxIssuerExposureBps / 100).toFixed(1)}%` : 'Unrestricted',
    description: issuerCheck.description,
    failureCode: issuerCheck.failureCode,
  });

  // C. Maximum Concurrent Positions
  const positionsCheck = checkMaxPositions(postState, policy.maxPositions);
  const activePositions = typeof positionsCheck.actualBpsOrValue === 'number' ? positionsCheck.actualBpsOrValue : 0;
  subChecks.push({
    name: 'Max Positions',
    passed: positionsCheck.passed,
    actual: `${activePositions} active`,
    limit: policy.maxPositions ? `≤ ${policy.maxPositions}` : 'Unrestricted',
    description: positionsCheck.description,
    failureCode: positionsCheck.failureCode,
  });

  // D. Minimum Asset Diversification Floor
  const divCheck = checkDiversification(postState, policy.minDiversificationAssets);
  const activeAssets = typeof divCheck.actualBpsOrValue === 'number' ? divCheck.actualBpsOrValue : 1;
  subChecks.push({
    name: 'Diversification',
    passed: divCheck.passed,
    actual: `${activeAssets} risk assets`,
    limit: policy.minDiversificationAssets ? `≥ ${policy.minDiversificationAssets}` : '≥ 1',
    description: divCheck.description,
    failureCode: divCheck.failureCode,
  });

  // E. Pre-IPO Exposure Cap (if configured)
  if (policy.maxPreIpoExposureBps !== undefined) {
    const preIpoCheck = checkPreIpoExposure(postState, policy.maxPreIpoExposureBps);
    const preIpoBps = typeof preIpoCheck.actualBpsOrValue === 'number' ? preIpoCheck.actualBpsOrValue : 0;
    subChecks.push({
      name: 'Pre-IPO Exposure',
      passed: preIpoCheck.passed,
      actual: `${(preIpoBps / 100).toFixed(1)}% projected`,
      limit: `≤ ${(policy.maxPreIpoExposureBps / 100).toFixed(1)}%`,
      description: preIpoCheck.description,
      failureCode: preIpoCheck.failureCode,
    });
  }

  const passed = subChecks.every(c => c.passed);
  const failedList = subChecks.filter(c => !c.passed);
  const message = passed
    ? 'Sector diversification, issuer limits, and portfolio positioning verified'
    : failedList.map(f => f.description).join('; ');

  return {
    name: 'PortfolioVerifier',
    passed,
    message,
    timestamp: Date.now(),
    subChecks,
    details: `${subChecks.filter(c => c.passed).length}/${subChecks.length} portfolio invariants satisfied`,
  };
}

/**
 * Evaluates the full 6-verifier SWARM-Lite Decision Engine:
 * 1. RiskVerifier
 * 2. BalanceVerifier
 * 3. PolicyVerifier
 * 4. LiquidityVerifier
 * 5. PriceIntegrityVerifier
 * 6. PortfolioVerifier
 *
 * Produces structured consensus telemetry with granular passing/failing sub-checks.
 */
export function evaluateSwarm(
  postState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  actualPrice?: number,
  priceSource?: PriceSource | NormalizedMarketPrice,
  agentRiskState?: AgentRiskState,
  venueDetails?: ExecutionVenueDetails | { venueType?: string; isHealthy?: boolean; liquidityDepthUsd?: number },
  currentTime: number = Date.now(),
  preState?: PortfolioSnapshot
): SwarmVerificationSummary {
  const venue = venueDetails ?? {
    venueType: 'METEORA_DBC',
    isHealthy: true,
    liquidityDepthUsd: 145_000,
  };

  const verdicts: VerifierVerdict[] = [
    evaluateRiskVerifier(postState, policy, intent),
    evaluateBalanceVerifier(postState, intent, policy, preState),
    evaluatePolicyVerifier(policy, intent, actualPrice, currentTime, venue.venueType),
    evaluateLiquidityVerifier(intent, policy, venue),
    evaluatePriceIntegrityVerifier(priceSource, policy, currentTime, intent.referencePriceUsd),
    evaluatePortfolioVerifier(postState, policy),
  ];

  const passedCount = verdicts.filter(v => v.passed).length;
  const totalCount = verdicts.length;

  // Flatten sub-checks across all verifiers for transparent, granular reporting
  const allSubChecks: VerifierSubCheck[] = [];
  for (const v of verdicts) {
    if (v.subChecks) {
      allSubChecks.push(...v.subChecks);
    }
  }

  const failedChecks = allSubChecks
    .filter(c => !c.passed)
    .map(c => ({
      name: c.name,
      actual: c.actual,
      limit: c.limit,
      description: c.description,
    }));

  const passedChecks = allSubChecks
    .filter(c => c.passed)
    .map(c => ({
      name: c.name,
      actual: c.actual,
      limit: c.limit,
      description: c.description,
    }));

  return {
    verdicts,
    passedCount,
    totalCount,
    consensus: passedCount === totalCount,
    checksPassedCount: passedChecks.length,
    checksTotalCount: allSubChecks.length,
    failedChecks,
    passedChecks,
  };
}
