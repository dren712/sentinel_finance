import { PortfolioSnapshot, FinancialPolicy } from './types';
import { calculateAssetExposureBps } from './policy-engine';

export interface ClawPumpAgentTokenConfig {
  symbol: string;
  name: string;
  mint: string;
  creatorAgentId: string;
  creatorAgentName: string;
  underlyingBenchmark: string;
  launchpadProgramId: string;
  pairedVenueType: 'METEORA_DBC';
  pairedPoolAddress: string;
  totalSupply: number;
  initialSpotPriceUsd: number;
  initialLiquidityUsd: number;
  decimals: number;
}

export const CANONICAL_CLAWPUMP_AGENT_TOKEN: ClawPumpAgentTokenConfig = {
  symbol: 'ROBOx',
  name: 'Sentinel Robo Strategy Token',
  mint: 'ROBOx11111111111111111111111111111111111111',
  creatorAgentId: 'claw_sentinel_robo_1',
  creatorAgentName: 'Sentinel Autonomous Robo-01',
  underlyingBenchmark: 'Tokenized US Equities Benchmark (NVDAx, AAPLx, SPYx)',
  launchpadProgramId: 'ClawPump11111111111111111111111111111111111',
  pairedVenueType: 'METEORA_DBC',
  pairedPoolAddress: 'MeteoraRoboDbcPool111111111111111111111111111',
  totalSupply: 1_000_000_000,
  initialSpotPriceUsd: 1.0,
  initialLiquidityUsd: 50_000,
  decimals: 6,
};

export interface SelfDealingEvaluationResult {
  passed: boolean;
  projectedExposureBps: number;
  maxAllowedBps: number;
  reason?: string;
}

/**
 * ClawPumpAgentLaunch:
 * Encapsulates the authentic 4-stage pipeline:
 * Agent Identity ➔ Stock-Linked Agent Token ➔ Meteora DBC Liquidity ➔ Sentinel Policy Guard
 */
export class ClawPumpAgentLaunch {
  public readonly config: ClawPumpAgentTokenConfig;
  public currentSpotPriceUsd: number;
  public currentLiquidityUsd: number;
  public isGraduated: boolean;
  public performanceFeeAccumulatedUsd: number;

  constructor(config: ClawPumpAgentTokenConfig = CANONICAL_CLAWPUMP_AGENT_TOKEN) {
    this.config = config;
    this.currentSpotPriceUsd = config.initialSpotPriceUsd;
    this.currentLiquidityUsd = config.initialLiquidityUsd;
    this.isGraduated = false;
    this.performanceFeeAccumulatedUsd = 0;
  }

  /**
   * Evaluates Anti-Self-Dealing Invariant:
   * Protects investors from autonomous agents allocating excessive portfolio capital
   * into their own native agent token.
   */
  evaluateSelfDealing(
    portfolio: PortfolioSnapshot,
    policy: FinancialPolicy,
    tradeAmountUsd: number,
    direction: 'BUY' | 'SELL'
  ): SelfDealingEvaluationResult {
    const maxAllowedBps = policy.maxAgentTokenExposureBps ?? 500; // Default 5.00% cap

    // Current holdings in ROBOx
    const existingAsset = portfolio.assets.find(a => a.symbol === this.config.symbol);
    const existingValue = existingAsset ? existingAsset.valueUsd : 0;

    const projectedValue = direction === 'BUY'
      ? existingValue + tradeAmountUsd
      : Math.max(0, existingValue - tradeAmountUsd);

    const projectedExposureBps = calculateAssetExposureBps(projectedValue, portfolio.totalValueUsd);
    const passed = projectedExposureBps <= maxAllowedBps;

    return {
      passed,
      projectedExposureBps,
      maxAllowedBps,
      reason: passed
        ? `Agent self-allocation ${(projectedExposureBps / 100).toFixed(2)}% is within authorized limit (≤ ${(maxAllowedBps / 100).toFixed(2)}%)`
        : `Agent self-allocation ${(projectedExposureBps / 100).toFixed(2)}% breaches anti-self-dealing cap of ${(maxAllowedBps / 100).toFixed(2)}%`,
    };
  }

  /**
   * Simulates accumulating performance fees from tokenized stock strategy into the ClawPump agent pool
   */
  accrueStrategyPerformanceFee(feeUsd: number): void {
    this.performanceFeeAccumulatedUsd += feeUsd;
    this.currentLiquidityUsd += feeUsd;
  }
}
