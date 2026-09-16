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
} from './types';
import { getAssetMetadata } from './asset-registry';
import { hashPortfolioProjection } from './portfolio-reader';

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
      assetClass: meta?.assetClass,
    });
    targetAssetIndex = newAssets.length - 1;
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
 * Checks Pre-IPO aggregate exposure cap (if configured in policy)
 */
export function checkPreIpoExposure(
  postState: PortfolioSnapshot,
  maxPreIpoBps: number
): PostconditionCheckResult {
  const preIpoValue = postState.assets
    .filter(a => a.assetClass === 'PRE_IPO' || a.symbol.includes('SPACEX') || a.symbol.includes('OPENAI') || a.symbol.includes('STRIPE'))
    .reduce((sum, a) => sum + a.valueUsd, 0);
  const preIpoExposureBps = calculateAssetExposureBps(preIpoValue, postState.totalValueUsd);
  const passed = preIpoExposureBps <= maxPreIpoBps;

  return {
    checkName: 'MAX_SINGLE_ASSET',
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
 * Evaluates all financial postconditions for a proposed state transition
 */
export function evaluatePostconditions(
  preState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  actualExecutionPrice?: number,
  priceSource?: PriceSource | NormalizedMarketPrice
): EvaluationOutcome {
  if (!policy.isActive) {
    throw new Error('Cannot evaluate against an inactive policy');
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

  // 2. Evaluate all postconditions
  const checks: PostconditionCheckResult[] = [
    checkMaxSingleAsset(postState, policy.maxSingleAssetBps, intent.assetSymbol),
    checkMinStablecoin(postState, policy.minStablecoinBps),
    checkMaxTradeSize(intent, policy.maxTradeValueUsd),
  ];

  if (actualExecutionPrice !== undefined) {
    checks.push(checkSlippage(intent.referencePriceUsd, actualExecutionPrice, policy.maxSlippageBps));
  }

  if (policy.maxPreIpoExposureBps !== undefined) {
    checks.push(checkPreIpoExposure(postState, policy.maxPreIpoExposureBps));
  }

  // 3. Evaluate Pyth Market Truth & Integrity if oracle source is provided
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
