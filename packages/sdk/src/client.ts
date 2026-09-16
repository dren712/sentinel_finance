import {
  FinancialPolicy,
  PortfolioSnapshot,
  TradeIntent,
  EvidenceRecord,
  PythPriceAdapter,
  SentinelValuationEngine,
  NormalizedMarketPrice,
  MarketIntegrityMetrics,
  PriceSource,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  DecisionCycleReport,
  DemoScenarioResult,
  MeteoraDBCMetrics,
  MeteoraVerificationResult,
} from './types';
import { SimulatedExecutionAdapter } from './adapters/execution-adapter';
import { AutonomousRoboAgent } from './agent-simulator';
import { MeteoraDBCMarketQualityVerifier } from './sponsors/meteora';

export interface SentinelClientConfig {
  adapter?: ExecutionAdapter;
  agent?: AutonomousRoboAgent;
  pythAdapter?: PythPriceAdapter;
  valuationEngine?: SentinelValuationEngine;
}

/**
 * SentinelClient:
 * Unified client facade for Sentinel Finance applications and agents.
 */
export class SentinelClient {
  private adapter: ExecutionAdapter;
  private agent: AutonomousRoboAgent;
  private pythAdapter: PythPriceAdapter;
  private valuationEngine: SentinelValuationEngine;
  private meteoraVerifier: MeteoraDBCMarketQualityVerifier;
  private evidenceHistory: EvidenceRecord[] = [];

  constructor(config: SentinelClientConfig = {}) {
    this.adapter = config.adapter ?? new SimulatedExecutionAdapter(200);
    this.agent = config.agent ?? new AutonomousRoboAgent();
    this.pythAdapter = config.pythAdapter ?? new PythPriceAdapter();
    this.valuationEngine = config.valuationEngine ?? new SentinelValuationEngine();
    this.meteoraVerifier = new MeteoraDBCMarketQualityVerifier();
  }

  getMode(): 'LIVE' | 'SIMULATION' {
    return this.adapter.getMode();
  }

  setAdapter(adapter: ExecutionAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): ExecutionAdapter {
    return this.adapter;
  }

  getAgent(): AutonomousRoboAgent {
    return this.agent;
  }

  getEvidenceHistory(): EvidenceRecord[] {
    return [...this.evidenceHistory];
  }

  /**
   * Generates the canonical hackathon starting portfolio ($100,000)
   */
  createDefaultPortfolio(owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'): PortfolioSnapshot {
    return {
      portfolioId: 'portfolio_main_sentinel',
      owner,
      totalValueUsd: 100_000,
      stablecoinValueUsd: 25_000,
      stablecoinExposureBps: 2500,
      timestamp: Date.now(),
      assets: [
        {
          symbol: 'AAPLx',
          name: 'Apple Tokenized Stock',
          mint: 'AAPL111111111111111111111111111111111111111',
          amount: 125,
          priceUsd: 200,
          valueUsd: 25_000,
          exposureBps: 2500,
          isStablecoin: false,
        },
        {
          symbol: 'NVDAx',
          name: 'Nvidia Tokenized Stock',
          mint: 'NVDA111111111111111111111111111111111111111',
          amount: 20000 / 120,
          priceUsd: 120,
          valueUsd: 20_000,
          exposureBps: 2000,
          isStablecoin: false,
        },
        {
          symbol: 'SPYx',
          name: 'S&P 500 Tokenized ETF',
          mint: 'SPY1111111111111111111111111111111111111111',
          amount: 60,
          priceUsd: 500,
          valueUsd: 30_000,
          exposureBps: 3000,
          isStablecoin: false,
          isIndex: true,
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: 25_000,
          priceUsd: 1,
          valueUsd: 25_000,
          exposureBps: 2500,
          isStablecoin: true,
        },
      ],
    };
  }

  /**
   * Generates the canonical hackathon financial policy
   */
  createDefaultPolicy(owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'): FinancialPolicy {
    return {
      policyId: 'policy_sentinel_default',
      owner,
      maxSingleAssetBps: 2500, // 25.00%
      minStablecoinBps: 2000,  // 20.00%
      maxTradeValueUsd: 10_000, // $10,000
      maxSlippageBps: 100,     // 1.00%
      policyVersion: 1,
      isActive: true,
      updatedAt: Date.now(),
    };
  }

  getPythAdapter(): PythPriceAdapter {
    return this.pythAdapter;
  }

  getValuationEngine(): SentinelValuationEngine {
    return this.valuationEngine;
  }

  async getMarketPrices(): Promise<Record<string, NormalizedMarketPrice>> {
    return this.pythAdapter.getAllNormalizedMarketPrices();
  }

  async getMarketPrice(symbol: string): Promise<NormalizedMarketPrice> {
    return this.pythAdapter.getNormalizedMarketPrice(symbol);
  }

  async valuePortfolio(portfolio: PortfolioSnapshot): Promise<PortfolioSnapshot> {
    const prices = await this.getMarketPrices();
    return this.valuationEngine.markPortfolioToMarket(portfolio, prices);
  }

  async getMarketIntegrityMetrics(
    portfolio: PortfolioSnapshot,
    policy?: FinancialPolicy
  ): Promise<MarketIntegrityMetrics> {
    const prices = await this.getMarketPrices();
    return this.valuationEngine.calculateMarketIntegrityMetrics(portfolio, prices, policy);
  }

  /**
   * Executes an autonomous decision cycle and stores the resulting PROVN evidence
   */
  async executeDecisionCycle(
    preState: PortfolioSnapshot,
    policy: FinancialPolicy,
    intent: TradeIntent,
    priceSource?: PriceSource | NormalizedMarketPrice
  ): Promise<DecisionCycleReport> {
    const activePrice = priceSource ?? (await this.getMarketPrice(intent.assetSymbol));
    const report = await this.agent.runDecisionCycle(preState, policy, intent, this.adapter, activePrice);
    this.evidenceHistory.unshift(report.evidenceRecord);
    return report;
  }

  /**
   * Runs the complete two-step hackathon demo scenario (Section 17)
   */
  async runDemoScenario(
    portfolio: PortfolioSnapshot,
    policy: FinancialPolicy
  ): Promise<DemoScenarioResult> {
    const result = await this.agent.runAutonomousDemoScenario(portfolio, policy, this.adapter);
    this.evidenceHistory.unshift(result.step1BadDecision.evidenceRecord);
    this.evidenceHistory.unshift(result.step2AdaptedDecision.evidenceRecord);
    return result;
  }

  /**
   * Verifies Meteora DBC market quality
   */
  verifyMeteoraDBC(metrics: MeteoraDBCMetrics): MeteoraVerificationResult {
    return this.meteoraVerifier.verifyMarketQuality(metrics);
  }
}
