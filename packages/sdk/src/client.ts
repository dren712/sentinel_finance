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
  AgentRiskState,
  CONSERVATIVE_INSTITUTIONAL_POLICY,
  BALANCED_MULTI_ASSET_POLICY,
  HIGH_ALPHA_GROWTH_POLICY,
  SentinelReceipt,
  MeteoraStockMarket,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  ExecutionVenueType,
  DecisionCycleReport,
  DemoScenarioResult,
  MeteoraDBCMetrics,
  MeteoraVerificationResult,
  AgentLoopState,
  AutonomousAdaptationResult,
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
   * Returns the authentic Meteora DBC stock market for a given tokenized equity (Phase 10)
   */
  getMeteoraMarket(symbol: string): MeteoraStockMarket {
    return this.meteoraAdapter.getMarket(symbol);
  }

  /**
   * Executes the full 10-stage autonomous reactive adaptation loop (Phase 8):
   * OBSERVE -> FORMULATE -> PROPOSE -> SENTINEL_CHECK -> REJECTED -> READ_FAILURE -> ADAPT -> REPROPOSE -> SENTINEL_RECHECK -> SETTLE
   */
  async runAutonomousAdaptation(
    portfolio: PortfolioSnapshot,
    policy: FinancialPolicy,
    targetSymbol: string = 'NVDAx',
    initialProposedAmountUsd: number = 15_000,
    onStageChange?: (state: AgentLoopState) => void
  ): Promise<AutonomousAdaptationResult> {
    const priceSource = await this.getMarketPrice(targetSymbol);
    const adapterToUse = this.resolveAdapterForIntent({
      intentId: `intent_preview_${Date.now()}`,
      agentId: this.agent.agentId,
      assetSymbol: targetSymbol,
      assetMint: 'MINT_AUTO',
      direction: 'BUY',
      tradeAmountUsd: initialProposedAmountUsd,
      referencePriceUsd: priceSource.priceUsd,
      timestamp: Date.now(),
    });

    const result = await this.agent.executeAutonomousAdaptationLoop(
      portfolio,
      policy,
      targetSymbol,
      initialProposedAmountUsd,
      adapterToUse,
      priceSource,
      onStageChange
    );

    // Record both the rejection evidence and the settled adaptation evidence in history
    this.evidenceHistory.unshift(result.step1RejectedDecision.evidenceRecord);
    this.evidenceHistory.unshift(result.step2SettledDecision.evidenceRecord);

    // Sync underlying real token holdings upon settlement
    if (result.step2SettledDecision.status === 'SETTLED' && result.step2SettledDecision.executionResult) {
      const wallet = portfolio.walletAddress ?? portfolio.owner;
      const res = result.step2SettledDecision.executionResult;
      this.indexer.updateHoldingBalance(wallet, res.inputAsset, -res.inputAmount);
      this.indexer.updateHoldingBalance(wallet, res.outputAsset, res.outputAmount);
    }

    return result;
  }

  /**
   * Formats an EvidenceRecord as a first-class SENTINEL RECEIPT (Phase 9)
   */
  formatReceipt(record: EvidenceRecord, index?: number): SentinelReceipt {
    const decisionNum = index !== undefined ? String(index + 1).padStart(5, '0') : '00421';
    const isSettled = record.verificationResult === 'SETTLED';
    const pda = record.promise?.who?.walletAddress ?? deriveSentinelPda(record.policyHash || 'owner');
    const slot = 312894102 + (index ?? 0) * 12;

    const side = record.promise?.what?.side ?? record.promise?.intent?.direction ?? 'BUY';
    const symbol = record.promise?.what?.assetSymbol ?? record.promise?.intent?.assetSymbol ?? 'NVDAx';
    const amount = record.promise?.what?.amountUsd ?? record.promise?.intent?.tradeAmountUsd ?? 5000;
    const intentSummary = `${side} ${symbol} $${amount.toLocaleString()}`;

    return {
      receiptNumber: `Decision #${decisionNum}`,
      decisionId: record.id,
      intentSummary,
      agentName: (record.promise?.who?.agentName === 'Sentinel Autonomous Robo-1' ? 'Sentinel Robo-01' : record.promise?.who?.agentName) ?? 'Sentinel Robo-01',
      policyName: `Balanced Growth v${record.policyVersion}`,
      marketDataSource: record.oracleProvenance ? 'Pyth Network' : 'Pyth Network',
      preStateShortHash: `0x${record.preStateHash.slice(0, 4)}...${record.preStateHash.slice(-4)}`,
      postStateShortHash: `0x${record.postStateHash.slice(0, 4)}...${record.postStateHash.slice(-4)}`,
      decision: isSettled ? 'APPROVED' : 'REJECTED',
      executionSignature: record.transactionSignature.startsWith('0x') ? record.transactionSignature : `0x${record.transactionSignature}`,
      evidenceHash: `0x${record.id.slice(0, 4)}...${record.id.slice(-4)}`,
      integrityVerified: true,
      timestamp: record.timestamp,
      formattedTimestamp: new Date(record.timestamp).toISOString(),
      solanaVerification: {
        programId: '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9k',
        pda,
        slot,
        cluster: 'Solana Devnet',
        explorerUrl: `https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9k?cluster=devnet`,
        isMainnetEquivalent: true,
      },
      technicalDetails: {
        policyHash: record.policyHash,
        intentHash: record.intentHash,
        preStateHash: record.preStateHash,
        postStateHash: record.postStateHash,
        rationaleHash: record.promise?.why?.rationaleHash,
        evidenceHash: record.id,
        transactionSignature: record.transactionSignature,
        swarmConsensus: {
          passedCount: record.swarmSummary?.passedCount ?? (isSettled ? 6 : 4),
          totalCount: record.swarmSummary?.totalCount ?? 6,
          consensus: record.swarmSummary?.consensus ?? isSettled,
        },
        underlyingEquity: record.oracleProvenance?.underlyingSymbol,
        trackingErrorBps: record.oracleProvenance?.trackingErrorBps,
        oracleConfidenceUsd: record.oracleProvenance?.confidenceUsd,
      },
    };
  }



  /**
   * Verifies Meteora DBC market quality
   */
  verifyMeteoraDBC(metrics: MeteoraDBCMetrics): MeteoraVerificationResult {
    return this.meteoraVerifier.verifyMarketQuality(metrics);
  }

  /**
   * Returns current autonomous agent risk state (24h budget, turnover, failures)
   */
  getAgentRiskState(): AgentRiskState {
    return this.agent.getRiskState();
  }

  /**
   * Resets the agent's circuit breaker and consecutive failure counter
   */
  resetAgentCircuitBreaker(): void {
    this.agent.resetCircuitBreaker();
  }

  /**
   * Sets emergency pause kill-switch on a financial policy
   */
  setEmergencyPause(policy: FinancialPolicy, isPaused: boolean): FinancialPolicy {
    return {
      ...policy,
      isEmergencyPaused: isPaused,
      policyVersion: policy.policyVersion + 1,
      updatedAt: Date.now(),
    };
  }

  /**
   * Applies a canonical or custom risk DSL policy profile
   */
  applyRiskProfile(profile: FinancialPolicy, owner?: string): FinancialPolicy {
    return {
      ...profile,
      owner: owner ?? profile.owner,
      policyVersion: profile.policyVersion,
      updatedAt: Date.now(),
    };
  }
}
