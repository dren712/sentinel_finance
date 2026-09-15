import { MeteoraDBCMetrics, MeteoraVerificationResult } from '../types';

/**
 * MeteoraDBCMarketQualityVerifier:
 * Implements the Sentinel market-quality promise verifier for Meteora Dynamic Bonding Curves (DBC).
 * Prevents autonomous agents from settling stock trades on illiquid or manipulated bonding curves.
 */
export class MeteoraDBCMarketQualityVerifier {
  private minLiquidityDepthUsd: number;
  private maxPriceDeviationBps: number;

  constructor(
    minLiquidityDepthUsd: number = 25_000, // $25,000 minimum reserve depth
    maxPriceDeviationBps: number = 200     // 2.00% maximum deviation from index/reference price
  ) {
    this.minLiquidityDepthUsd = minLiquidityDepthUsd;
    this.maxPriceDeviationBps = maxPriceDeviationBps;
  }

  /**
   * Verifies whether a Meteora DBC pool satisfies institutional market-quality postconditions
   */
  verifyMarketQuality(metrics: MeteoraDBCMetrics): MeteoraVerificationResult {
    const liquidityPassed = metrics.liquidityDepthUsd >= this.minLiquidityDepthUsd;

    let actualDeviationBps = 0;
    if (metrics.referencePriceUsd > 0) {
      actualDeviationBps = Math.round(
        (Math.abs(metrics.currentPriceUsd - metrics.referencePriceUsd) / metrics.referencePriceUsd) * 10_000
      );
    }

    const priceDeviationPassed = actualDeviationBps <= this.maxPriceDeviationBps;
    const passed = liquidityPassed && priceDeviationPassed;

    const details = passed
      ? `Meteora DBC market quality verified (Depth: $${metrics.liquidityDepthUsd.toLocaleString()} >= $${this.minLiquidityDepthUsd.toLocaleString()}, Price deviation: ${(actualDeviationBps / 100).toFixed(2)}% <= ${(this.maxPriceDeviationBps / 100).toFixed(2)}%)`
      : !liquidityPassed
      ? `Meteora DBC insufficient liquidity depth: $${metrics.liquidityDepthUsd.toLocaleString()} < minimum $${this.minLiquidityDepthUsd.toLocaleString()}`
      : `Meteora DBC excessive price deviation: ${(actualDeviationBps / 100).toFixed(2)}% exceeds max allowed ${(this.maxPriceDeviationBps / 100).toFixed(2)}%`;

    return {
      passed,
      liquidityPassed,
      priceDeviationPassed,
      actualDeviationBps,
      details,
    };
  }
}
