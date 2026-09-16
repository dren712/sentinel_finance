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
  TokenHolding,
  PortfolioProjectionResult,
  SentinelPdaConfig,
  deriveSentinelPda,
  getSentinelPdaConfig,
  hashPortfolioProjection,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  ExecutionVenueType,
  DecisionCycleReport,
  DemoScenarioResult,
  MeteoraDBCMetrics,
  MeteoraVerificationResult,
} from './types';
import {
  DemoExecutionAdapter,
  MeteoraExecutionAdapter,
  PreStocksExecutionAdapter,
  SimulatedExecutionAdapter,
} from './adapters/execution-adapter';
import { AutonomousRoboAgent } from './agent-simulator';
import { MeteoraDBCMarketQualityVerifier } from './sponsors/meteora';
import { PortfolioIndexer, deriveSplAta } from './portfolio-indexer';

export interface SentinelClientConfig {
  adapter?: ExecutionAdapter;
  agent?: AutonomousRoboAgent;
  pythAdapter?: PythPriceAdapter;
  valuationEngine?: SentinelValuationEngine;
  indexer?: PortfolioIndexer;
  defaultVenue?: ExecutionVenueType;
}

/**
 * SentinelClient:
 * Unified client facade for Sentinel Finance applications and agents.
 * Connects AutonomousRoboAgent, Pyth Market Truth, SPL Portfolio Indexing,
 * and polymorphic Execution Adapters (Meteora DBC, PreStocks Secondary, Demo Simulator).
 */
export class SentinelClient {
  private adapter: ExecutionAdapter;
  private selectedVenue: ExecutionVenueType;
  private meteoraAdapter: MeteoraExecutionAdapter;
  private preStocksAdapter: PreStocksExecutionAdapter;
  private demoAdapter: DemoExecutionAdapter;
  private agent: AutonomousRoboAgent;
  private pythAdapter: PythPriceAdapter;
  private valuationEngine: SentinelValuationEngine;
  private indexer: PortfolioIndexer;
  private meteoraVerifier: MeteoraDBCMarketQualityVerifier;
  private evidenceHistory: EvidenceRecord[] = [];

  constructor(config: SentinelClientConfig = {}) {
    this.demoAdapter = new DemoExecutionAdapter(200);
    this.meteoraAdapter = new MeteoraExecutionAdapter();
    this.preStocksAdapter = new PreStocksExecutionAdapter();

    this.selectedVenue = config.defaultVenue ?? (config.adapter?.venueType ?? 'METEORA_DBC');
    this.adapter = config.adapter ?? (this.selectedVenue === 'PRESTOCKS_SECONDARY'
      ? this.preStocksAdapter
      : this.selectedVenue === 'DEMO_SIMULATION'
      ? this.demoAdapter
      : this.meteoraAdapter);

    this.agent = config.agent ?? new AutonomousRoboAgent();
    this.pythAdapter = config.pythAdapter ?? new PythPriceAdapter();
    this.valuationEngine = config.valuationEngine ?? new SentinelValuationEngine();
    this.indexer = config.indexer ?? new PortfolioIndexer();
    this.meteoraVerifier = new MeteoraDBCMarketQualityVerifier();
  }

  getMode(): 'LIVE' | 'SIMULATION' {
    return this.adapter.getMode();
  }

  setAdapter(adapter: ExecutionAdapter): void {
    this.adapter = adapter;
    this.selectedVenue = adapter.venueType;
  }

  getAdapter(): ExecutionAdapter {
    return this.adapter;
  }

  setExecutionVenue(venueType: ExecutionVenueType): void {
    this.selectedVenue = venueType;
    if (venueType === 'METEORA_DBC') {
      this.adapter = this.meteoraAdapter;
    } else if (venueType === 'PRESTOCKS_SECONDARY') {
      this.adapter = this.preStocksAdapter;
    } else if (venueType === 'DEMO_SIMULATION') {
      this.adapter = this.demoAdapter;
    }
  }

  getExecutionVenue(): ExecutionVenueType {
    return this.selectedVenue;
  }

  getMeteoraAdapter(): MeteoraExecutionAdapter {
    return this.meteoraAdapter;
  }

  getPreStocksAdapter(): PreStocksExecutionAdapter {
    return this.preStocksAdapter;
  }

  getDemoAdapter(): DemoExecutionAdapter {
    return this.demoAdapter;
  }

  resolveAdapterForIntent(intent: TradeIntent): ExecutionAdapter {
    if (this.selectedVenue === 'DEMO_SIMULATION') {
      return this.demoAdapter;
    }
    const preIpoSymbols = ['SPACEXx', 'OPENAIx', 'STRIPEx'];
    if (preIpoSymbols.includes(intent.assetSymbol)) {
      return this.preStocksAdapter;
    }
    if (this.selectedVenue === 'PRESTOCKS_SECONDARY') {
      return this.preStocksAdapter;
    }
    return this.meteoraAdapter;
  }

  getAgent(): AutonomousRoboAgent {
    return this.agent;
  }

  getEvidenceHistory(): EvidenceRecord[] {
    return [...this.evidenceHistory];
  }

  /**
   * Generates the canonical hackathon starting portfolio ($100,000)
   * Projected from real Solana SPL Associated Token Accounts (ATAs) and Pyth market truth.
   */
  createDefaultPortfolio(owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'): PortfolioSnapshot {
    const sentinelPda = deriveSentinelPda(owner);
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const aaplMint = 'AAPL111111111111111111111111111111111111111';
    const nvdaMint = 'NVDA111111111111111111111111111111111111111';
    const spyMint = 'SPY1111111111111111111111111111111111111111';

    const portfolio: PortfolioSnapshot = {
      portfolioId: 'portfolio_main_sentinel',
      owner,
      walletAddress: owner,
      sentinelPda,
      totalValueUsd: 100_000,
      stablecoinValueUsd: 25_000,
      stablecoinExposureBps: 2500,
      timestamp: Date.now(),
      projectionTimestamp: Date.now(),
      source: 'ON_CHAIN_PROJECTION',
      assets: [
        {
          symbol: 'AAPLx',
          name: 'Apple Tokenized Stock',
          mint: aaplMint,
          amount: 125,
          priceUsd: 200,
          valueUsd: 25_000,
          exposureBps: 2500,
          isStablecoin: false,
          ata: deriveSplAta(owner, aaplMint),
          rawAmount: '125000000',
          decimals: 6,
          verifiedPriceSource: 'Pyth Network (Crypto.AAPLX/USD)',
        },
        {
          symbol: 'NVDAx',
          name: 'Nvidia Tokenized Stock',
          mint: nvdaMint,
          amount: 20000 / 120,
          priceUsd: 120,
          valueUsd: 20_000,
          exposureBps: 2000,
          isStablecoin: false,
          ata: deriveSplAta(owner, nvdaMint),
          rawAmount: '166666667',
          decimals: 6,
          verifiedPriceSource: 'Pyth Network (Crypto.NVDAX/USD)',
        },
        {
          symbol: 'SPYx',
          name: 'S&P 500 Tokenized ETF',
          mint: spyMint,
          amount: 60,
          priceUsd: 500,
          valueUsd: 30_000,
          exposureBps: 3000,
          isStablecoin: false,
          isIndex: true,
          ata: deriveSplAta(owner, spyMint),
          rawAmount: '60000000',
          decimals: 6,
          verifiedPriceSource: 'Pyth Network (Index.US.SPYX/USD)',
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          mint: usdcMint,
          amount: 25_000,
          priceUsd: 1,
          valueUsd: 25_000,
          exposureBps: 2500,
          isStablecoin: true,
          ata: deriveSplAta(owner, usdcMint),
          rawAmount: '25000000000',
          decimals: 6,
          verifiedPriceSource: 'Pyth Network (Crypto.USDC/USD)',
        },
      ],
    };

    portfolio.projectionHash = hashPortfolioProjection(portfolio);
    return portfolio;
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

  getPortfolioIndexer(): PortfolioIndexer {
    return this.indexer;
  }

  async indexWalletPortfolio(
    walletAddress: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'
  ): Promise<PortfolioProjectionResult> {
    const prices = await this.getMarketPrices();
    return this.indexer.indexPortfolio(walletAddress, prices);
  }

  getSentinelPdaConfig(
    owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'
  ): SentinelPdaConfig {
    return getSentinelPdaConfig(owner);
  }

  async getWalletHoldings(
    walletAddress: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'
  ): Promise<TokenHolding[]> {
    return this.indexer.fetchWalletTokenHoldings(walletAddress);
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
    const adapterToUse = this.resolveAdapterForIntent(intent);
    const report = await this.agent.runDecisionCycle(preState, policy, intent, adapterToUse, activePrice);
    this.evidenceHistory.unshift(report.evidenceRecord);

    // Sync underlying real token holdings if trade was settled
    if (report.status === 'SETTLED' && report.executionResult) {
      const wallet = preState.walletAddress ?? preState.owner;
      const isBuy = intent.direction === 'BUY';
      const inputDelta = isBuy ? -report.executionResult.inputAmount : -report.executionResult.inputAmount;
      const outputDelta = isBuy ? report.executionResult.outputAmount : report.executionResult.outputAmount;

      this.indexer.updateHoldingBalance(wallet, report.executionResult.inputAsset, inputDelta);
      this.indexer.updateHoldingBalance(wallet, report.executionResult.outputAsset, outputDelta);
    }

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
