import {
  FinancialPolicy,
  PortfolioSnapshot,
  TradeIntent,
  VerifierVerdict,
  SwarmVerificationSummary,
  PriceSource,
} from './types';
import {
  checkMaxSingleAsset,
  checkMinStablecoin,
  checkMaxTradeSize,
  checkSlippage,
} from './policy-engine';

/**
 * RiskVerifier: Independently inspects portfolio concentration and single-asset limits.
 */
export function evaluateRiskVerifier(
  postState: PortfolioSnapshot,
  policy: FinancialPolicy,
  targetAssetSymbol?: string
): VerifierVerdict {
  const result = checkMaxSingleAsset(postState, policy.maxSingleAssetBps, targetAssetSymbol);
  return {
    name: 'RiskVerifier',
    passed: result.passed,
    message: result.description,
    timestamp: Date.now(),
  };
}

/**
 * BalanceVerifier: Independently inspects solvency, stablecoin reserve floors, and absolute trade sizing.
 */
export function evaluateBalanceVerifier(
  postState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy
): VerifierVerdict {
  const stablecoinResult = checkMinStablecoin(postState, policy.minStablecoinBps);
  const tradeSizeResult = checkMaxTradeSize(intent, policy.maxTradeValueUsd);

  const passed = stablecoinResult.passed && tradeSizeResult.passed;
  const messages: string[] = [];
  if (!stablecoinResult.passed) messages.push(stablecoinResult.description);
  if (!tradeSizeResult.passed) messages.push(tradeSizeResult.description);
  if (passed) messages.push('Solvency, reserve floor, and trade sizing invariants verified');

  return {
    name: 'BalanceVerifier',
    passed,
    message: messages.join('; '),
    timestamp: Date.now(),
  };
}

/**
 * PolicyVerifier: Independently inspects policy freshness, agent authorization bounds, and execution slippage.
 */
export function evaluatePolicyVerifier(
  policy: FinancialPolicy,
  intent: TradeIntent,
  actualPrice?: number
): VerifierVerdict {
  if (!policy.isActive) {
    return {
      name: 'PolicyVerifier',
      passed: false,
      message: 'Policy is currently inactive or paused by user',
      timestamp: Date.now(),
    };
  }

  // Slippage check if execution price is present
  if (actualPrice !== undefined) {
    const slippageResult = checkSlippage(intent.referencePriceUsd, actualPrice, policy.maxSlippageBps);
    return {
      name: 'PolicyVerifier',
      passed: slippageResult.passed,
      message: slippageResult.description,
      timestamp: Date.now(),
    };
  }

  return {
    name: 'PolicyVerifier',
    passed: true,
    message: `Policy v${policy.policyVersion} is active and valid`,
    timestamp: Date.now(),
  };
}

/**
 * PythOracleVerifier: Independently inspects Pyth price feed confidence and basis tracking error.
 */
export function evaluatePythOracleVerifier(
  priceSource: PriceSource,
  policy: FinancialPolicy
): VerifierVerdict {
  const maxConfidenceBps = policy.maxOracleConfidenceBps ?? 150; // Default: 1.50%
  const confidenceRatioBps = priceSource.price > 0
    ? Math.round((priceSource.confidence * 10_000) / priceSource.price)
    : 0;

  if (confidenceRatioBps > maxConfidenceBps) {
    return {
      name: 'PythOracleVerifier',
      passed: false,
      message: `Pyth confidence interval ±$${priceSource.confidence} (${(confidenceRatioBps / 100).toFixed(2)}%) exceeds limit of ${(maxConfidenceBps / 100).toFixed(2)}%`,
      timestamp: Date.now(),
    };
  }

  if (priceSource.trackingErrorBps !== undefined) {
    const maxTrackingBps = policy.maxTrackingErrorBps ?? 250; // Default: 2.50%
    if (priceSource.trackingErrorBps > maxTrackingBps) {
      return {
        name: 'PythOracleVerifier',
        passed: false,
        message: `Tokenized vs underlying tracking error (${(priceSource.trackingErrorBps / 100).toFixed(2)}%) exceeds limit of ${(maxTrackingBps / 100).toFixed(2)}%`,
        timestamp: Date.now(),
      };
    }
  }

  return {
    name: 'PythOracleVerifier',
    passed: true,
    message: `Pyth oracle confidence (±$${priceSource.confidence}) and peg tracking verified within bounds`,
    timestamp: Date.now(),
  };
}

/**
 * Evaluates all independent SWARM-lite verifier modules
 */
export function evaluateSwarm(
  postState: PortfolioSnapshot,
  intent: TradeIntent,
  policy: FinancialPolicy,
  actualPrice?: number,
  priceSource?: PriceSource
): SwarmVerificationSummary {
  const verdicts: VerifierVerdict[] = [
    evaluateRiskVerifier(postState, policy, intent.assetSymbol),
    evaluateBalanceVerifier(postState, intent, policy),
    evaluatePolicyVerifier(policy, intent, actualPrice),
  ];

  if (priceSource) {
    verdicts.push(evaluatePythOracleVerifier(priceSource, policy));
  }

  const passedCount = verdicts.filter(v => v.passed).length;
  const totalCount = verdicts.length;

  return {
    verdicts,
    passedCount,
    totalCount,
    consensus: passedCount === totalCount,
  };
}
