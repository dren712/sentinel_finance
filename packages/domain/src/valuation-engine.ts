/**
 * Sentinel Finance — Valuation Engine
 * Marks portfolios to market using authoritative Pyth Network prices,
 * re-evaluates asset exposures, and computes market integrity metrics.
 */

import {
  PortfolioSnapshot,
  PortfolioAsset,
  NormalizedMarketPrice,
  FinancialPolicy,
  PostconditionCheckResult,
} from './types';
import { calculatePortfolioValue, calculateAssetExposureBps } from './policy-engine';

export interface MarketIntegrityMetrics {
  activeFeedsCount: number;
  portfolioTrackingErrorBps: number;
  portfolioConfidenceBps: number;
  maxObservedTrackingErrorBps: number;
  maxObservedConfidenceBps: number;
  allOraclesHealthy: boolean;
  timestamp: number;
}

export class SentinelValuationEngine {
  /**
   * Marks a portfolio to market using real-time Pyth NormalizedMarketPrice feeds.
   * Recalculates all asset values, exposures, stablecoin reserve ratio, and NAV.
   */
  markPortfolioToMarket(
    portfolio: PortfolioSnapshot,
    marketPrices: Record<string, NormalizedMarketPrice>
  ): PortfolioSnapshot {
    const updatedAssets: PortfolioAsset[] = portfolio.assets.map(asset => {
      const marketPrice = marketPrices[asset.symbol];
      if (!marketPrice) {
        return { ...asset };
      }

      const priceUsd = marketPrice.priceUsd;
      const valueUsd = Math.round(asset.amount * priceUsd * 100) / 100;

      return {
        ...asset,
        priceUsd,
        valueUsd,
      };
    });

    const totalValueUsd = calculatePortfolioValue(updatedAssets);

    // Recalculate exposures
    let stablecoinValueUsd = 0;
    for (const asset of updatedAssets) {
      asset.exposureBps = calculateAssetExposureBps(asset.valueUsd, totalValueUsd);
      if (asset.isStablecoin || asset.symbol === 'USDC') {
        stablecoinValueUsd += asset.valueUsd;
      }
    }

    stablecoinValueUsd = Math.round(stablecoinValueUsd * 100) / 100;
    const stablecoinExposureBps = calculateAssetExposureBps(stablecoinValueUsd, totalValueUsd);

    return {
      portfolioId: portfolio.portfolioId,
      owner: portfolio.owner,
      totalValueUsd,
      stablecoinValueUsd,
      stablecoinExposureBps,
      assets: updatedAssets,
      timestamp: Date.now(),
    };
  }

  /**
   * Evaluates aggregate market integrity metrics across a portfolio:
   * weighted tracking error, weighted oracle confidence interval, and health status.
   */
  calculateMarketIntegrityMetrics(
    portfolio: PortfolioSnapshot,
    marketPrices: Record<string, NormalizedMarketPrice>,
    policy?: FinancialPolicy
  ): MarketIntegrityMetrics {
    const maxAllowedTrackingErrorBps = policy?.maxTrackingErrorBps ?? 250; // 2.50%
    const maxAllowedConfidenceBps = 150; // 1.50%

    let weightedTrackingErrorNumerator = 0;
    let weightedConfidenceNumerator = 0;
    let totalEvaluatedValueUsd = 0;
    let maxObservedTrackingErrorBps = 0;
    let maxObservedConfidenceBps = 0;
    let activeFeedsCount = 0;
    let allOraclesHealthy = true;

    for (const asset of portfolio.assets) {
      const marketPrice = marketPrices[asset.symbol];
      if (!marketPrice) continue;

      activeFeedsCount++;
      const val = asset.valueUsd;
      totalEvaluatedValueUsd += val;

      weightedTrackingErrorNumerator += marketPrice.trackingErrorBps * val;
      weightedConfidenceNumerator += marketPrice.confidenceRatioBps * val;

      if (marketPrice.trackingErrorBps > maxObservedTrackingErrorBps) {
        maxObservedTrackingErrorBps = marketPrice.trackingErrorBps;
      }
      if (marketPrice.confidenceRatioBps > maxObservedConfidenceBps) {
        maxObservedConfidenceBps = marketPrice.confidenceRatioBps;
      }

      if (
        marketPrice.trackingErrorBps > maxAllowedTrackingErrorBps ||
        marketPrice.confidenceRatioBps > maxAllowedConfidenceBps
      ) {
        allOraclesHealthy = false;
      }
    }

    const portfolioTrackingErrorBps =
      totalEvaluatedValueUsd > 0
        ? Math.round(weightedTrackingErrorNumerator / totalEvaluatedValueUsd)
        : 0;

    const portfolioConfidenceBps =
      totalEvaluatedValueUsd > 0
        ? Math.round(weightedConfidenceNumerator / totalEvaluatedValueUsd)
        : 0;

    return {
      activeFeedsCount,
      portfolioTrackingErrorBps,
      portfolioConfidenceBps,
      maxObservedTrackingErrorBps,
      maxObservedConfidenceBps,
      allOraclesHealthy,
      timestamp: Date.now(),
    };
  }

  /**
   * Validates a single NormalizedMarketPrice against user financial policy
   */
  validateMarketIntegrity(
    marketPrice: NormalizedMarketPrice,
    policy?: FinancialPolicy
  ): PostconditionCheckResult[] {
    const maxTrackingErrorBps = policy?.maxTrackingErrorBps ?? 250; // 2.50%
    const maxConfidenceBps = 150; // 1.50%

    const trackingPassed = marketPrice.trackingErrorBps <= maxTrackingErrorBps;
    const confidencePassed = marketPrice.confidenceRatioBps <= maxConfidenceBps;

    const trackingCheck: PostconditionCheckResult = {
      checkName: 'TRACKING_ERROR',
      passed: trackingPassed,
      expectedBpsOrValue: maxTrackingErrorBps,
      actualBpsOrValue: marketPrice.trackingErrorBps,
      description: trackingPassed
        ? `Tracking error ${(marketPrice.trackingErrorBps / 100).toFixed(2)}% is within authorization (${(maxTrackingErrorBps / 100).toFixed(2)}%)`
        : `Tracking error exceeded: ${(marketPrice.trackingErrorBps / 100).toFixed(2)}% exceeds ceiling of ${(maxTrackingErrorBps / 100).toFixed(2)}%`,
      failureCode: trackingPassed ? undefined : 'ERR_TRACKING_ERROR_EXCEEDED',
    };

    const confidenceCheck: PostconditionCheckResult = {
      checkName: 'ORACLE_CONFIDENCE',
      passed: confidencePassed,
      expectedBpsOrValue: maxConfidenceBps,
      actualBpsOrValue: marketPrice.confidenceRatioBps,
      description: confidencePassed
        ? `Oracle confidence interval ±$${marketPrice.confidenceUsd.toFixed(2)} (${(marketPrice.confidenceRatioBps / 100).toFixed(2)}%) is within tolerance`
        : `Oracle confidence interval ±$${marketPrice.confidenceUsd.toFixed(2)} (${(marketPrice.confidenceRatioBps / 100).toFixed(2)}%) exceeds limit of ${(maxConfidenceBps / 100).toFixed(2)}%`,
      failureCode: confidencePassed ? undefined : 'ERR_ORACLE_CONFIDENCE_TOO_WIDE',
    };

    return [trackingCheck, confidenceCheck];
  }
}
