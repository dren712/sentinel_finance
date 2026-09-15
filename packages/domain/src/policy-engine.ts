import {
  FinancialPolicy,
  PortfolioAsset,
  PortfolioSnapshot,
  TradeIntent,
  PostconditionCheckResult,
  EvaluationOutcome,
  FailureCode,
} from './types';

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
    newAssets.push({
      symbol: intent.assetSymbol,
      name: `${intent.assetSymbol} Tokenized Stock`,
      mint: intent.assetMint,
      amount: 0,
      priceUsd: price,
      valueUsd: 0,
      exposureBps: 0,
      isStablecoin: false,
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

    targetAsset.amount += tokenQuantity;
    targetAsset.priceUsd = price;
    targetAsset.valueUsd = Math.round(targetAsset.amount * price * 100) / 100;
  } else {
    // SELL: liquidate target equity, receive USDC
    targetAsset.amount = Math.max(0, targetAsset.amount - tokenQuantity);
    targetAsset.priceUsd = price;
    targetAsset.valueUsd = Math.round(targetAsset.amount * price * 100) / 100;

    usdcAsset.amount += tradeValue;
    usdcAsset.valueUsd = Math.round(usdcAsset.amount * usdcAsset.priceUsd * 100) / 100;
  }

  const totalValueUsd = calculatePortfolioValue(newAssets);

  // Recalculate exposures
  for (const asset of newAssets) {
    asset.exposureBps = calculateAssetExposureBps(asset.valueUsd, totalValueUsd);
  }

  const stablecoinExposureBps = calculateAssetExposureBps(usdcAsset.valueUsd, totalValueUsd);

  return {
    portfolioId: preState.portfolioId,
    owner: preState.owner,
    totalValueUsd,
    stablecoinValueUsd: usdcAsset.valueUsd,
    stablecoinExposureBps,
    assets: newAssets,
    timestamp: Date.now(),
  };
}

/**
 * Checks Postcondition A: Maximum single-asset exposure
 * Per Section 10.1: post_trade_asset_value / post_trade_portfolio_value <= max_single_asset
 * Evaluates the traded asset's post-trade exposure and any other single equity positions.
 */
export function checkMaxSingleAsset(
  postState: PortfolioSnapshot,
  maxSingleAssetBps: number,
  targetAssetSymbol?: string
): PostconditionCheckResult {
  // If a target asset symbol is specified, focus evaluation on the target asset per Section 10.1
  if (targetAssetSymbol) {
    const targetAsset = postState.assets.find(a => a.symbol === targetAssetSymbol);
    if (targetAsset && !targetAsset.isStablecoin && !targetAsset.isIndex) {
      const passed = targetAsset.exposureBps <= maxSingleAssetBps;
      return {
        checkName: 'MAX_SINGLE_ASSET',
        passed,
        expectedBpsOrValue: maxSingleAssetBps,
        actualBpsOrValue: targetAsset.exposureBps,
        description: passed
          ? `Single-asset exposure for ${targetAssetSymbol} is within limit (${(targetAsset.exposureBps / 100).toFixed(2)}% <= ${(maxSingleAssetBps / 100).toFixed(2)}%)`
          : `Single-asset exposure exceeded: ${targetAssetSymbol} would reach ${(targetAsset.exposureBps / 100).toFixed(2)}%, exceeding ceiling of ${(maxSingleAssetBps / 100).toFixed(2)}%`,
        failureCode: passed ? undefined : 'ERR_EXPOSURE_EXCEEDED',
      };
    }
  }

  // Otherwise inspect all single non-index, non-stablecoin equities
  let highestExposureAsset: PortfolioAsset | null = null;
  let highestExposureBps = 0;

  for (const asset of postState.assets) {
    if (!asset.isStablecoin && !asset.isIndex) {
      if (asset.exposureBps > highestExposureBps) {
        highestExposureBps = asset.exposureBps;
        highestExposureAsset = asset;
      }
    }
  }

  const passed = highestExposureBps <= maxSingleAssetBps;
  const highestSymbol = highestExposureAsset ? highestExposureAsset.symbol : 'None';

  return {
    checkName: 'MAX_SINGLE_ASSET',
    passed,
    expectedBpsOrValue: maxSingleAssetBps,
    actualBpsOrValue: highestExposureBps,
    description: passed
      ? `All single equity exposures within policy limit (highest: ${highestSymbol} at ${(highestExposureBps / 100).toFixed(2)}% <= ${(maxSingleAssetBps / 100).toFixed(2)}%)`
      : `Single-asset exposure exceeded: ${highestSymbol} would reach ${(highestExposureBps / 100).toFixed(2)}%, exceeding ceiling of ${(maxSingleAssetBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_EXPOSURE_EXCEEDED',
  };
}

/**
 * Checks Postcondition B: Minimum stablecoin reserve
 * Per Section 10.1: post_trade_stablecoin_value / post_trade_portfolio_value >= min_stablecoin
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
      ? `Stablecoin reserve satisfies minimum threshold (${(postState.stablecoinExposureBps / 100).toFixed(2)}% >= ${(minStablecoinBps / 100).toFixed(2)}%)`
      : `Stablecoin reserve breached: reserve would fall to ${(postState.stablecoinExposureBps / 100).toFixed(2)}%, below required floor of ${(minStablecoinBps / 100).toFixed(2)}%`,
    failureCode: passed ? undefined : 'ERR_STABLECOIN_RESERVE_BREACHED',
  };
}

/**
 * Checks Postcondition C: Maximum trade value
 * Per Section 10.1: trade_value <= max_trade_value
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
 * Evaluates all financial postconditions for a proposed state transition
 */
export function evaluatePostconditions(
  preState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  actualExecutionPrice?: number
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
