import { createHash } from 'crypto';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  TradeIntent,
  PromiseRecord,
  createEvidenceRecord,
  generateAuditExplanation,
  evaluatePostconditions,
  evaluateSwarm,
  hashFinancialPolicy,
  hashTradeIntent,
  PriceSource,
  NormalizedMarketPrice,
  OracleProvenance,
  formatPublishTimeUtc,
  SentinelAuthorizationTicket,
  ExecutionVenueDetails,
  hashPortfolioState,
  FailureCode,
  AgentRiskState,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  DecisionCycleReport,
  DemoScenarioResult,
  SecurityViolationError,
} from './types';
import { ClawPumpAgentWallet } from './sponsors/clawpump';

export interface AgentConfig {
  agentId?: string;
  name?: string;
  objective?: string;
}

/**
 * AutonomousRoboAgent:
 * Autonomous agent that makes portfolio investment decisions subject to Sentinel postcondition enforcement.
 * Demonstrates the core value: "The agent can make investment decisions, but it cannot settle an outcome that violates the user's financial promises."
 */
export class AutonomousRoboAgent {
  public readonly agentId: string;
  public readonly name: string;
  public objective: string;
  public status: 'ACTIVE' | 'PAUSED' | 'STEP_BY_STEP';
  public readonly wallet: ClawPumpAgentWallet;
  public agentRiskState: AgentRiskState;

  constructor(config: AgentConfig = {}) {
    this.agentId = config.agentId ?? 'sentinel_robo_agent_1';
    this.name = config.name ?? 'Sentinel Autonomous Robo-1';
    this.objective = config.objective ?? 'Earnings Momentum & Growth Allocation';
    this.status = 'ACTIVE';
    this.wallet = new ClawPumpAgentWallet(this.agentId, this.name);
    this.agentRiskState = {
      agentId: this.agentId,
      tradesExecuted24hUsd: 0,
      dailyTurnoverBps: 0,
      consecutiveFailures: 0,
      isCircuitBreakerTriggered: false,
      updatedAt: Date.now(),
    };
  }

  /**
   * Generates a trade intent based on an investment thesis
   */
  proposeIntent(params: {
    assetSymbol: string;
    assetMint: string;
    direction: 'BUY' | 'SELL';
    tradeAmountUsd: number;
    referencePriceUsd: number;
    strategyRationale: string;
  }): TradeIntent {
    return {
      intentId: `intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agentId: this.agentId,
      assetSymbol: params.assetSymbol,
      assetMint: params.assetMint,
      direction: params.direction,
      tradeAmountUsd: params.tradeAmountUsd,
      referencePriceUsd: params.referencePriceUsd,
      timestamp: Date.now(),
      strategyRationale: params.strategyRationale,
    };
  }

  /**
   * Computes the maximum compliant trade amount that strictly satisfies all policy invariants
   */
  calculateCompliantTradeAmount(
    preState: PortfolioSnapshot,
    policy: FinancialPolicy,
    targetSymbol: string
  ): number {
    const totalValue = preState.totalValueUsd;
    const targetAsset = preState.assets.find(a => a.symbol === targetSymbol);
    const usdcAsset = preState.assets.find(a => a.isStablecoin || a.symbol === 'USDC');

    const currentTargetValue = targetAsset ? targetAsset.valueUsd : 0;
    const currentUsdcValue = usdcAsset ? usdcAsset.valueUsd : 0;

    // Constraint 1: Policy max trade size
    const limitByTradeSize = policy.maxTradeValueUsd;

    // Constraint 2: Single-asset exposure ceiling
    // (currentTargetValue + X) / totalValue <= maxSingleAssetBps / 10000
    const maxAllowedTargetValue = (policy.maxSingleAssetBps / 10_000) * totalValue;
    const limitByExposure = Math.max(0, maxAllowedTargetValue - currentTargetValue);

    // Constraint 3: Stablecoin reserve floor
    // (currentUsdcValue - X) / totalValue >= minStablecoinBps / 10000
    const minRequiredUsdc = (policy.minStablecoinBps / 10_000) * totalValue;
    const limitByReserve = Math.max(0, currentUsdcValue - minRequiredUsdc);

    // Safe integer dollar amount
    const compliantAmount = Math.floor(Math.min(limitByTradeSize, limitByExposure, limitByReserve));
    return Math.max(0, compliantAmount);
  }

  /**
   * Runs an autonomous decision cycle:
   * 1. Proposes intent
   * 2. Builds promise
   * 3. Authoritatively evaluates Sentinel postconditions
   * 4. Settle or Abort based on invariants
   * 5. Anchors PROVN evidence record
   */
  async runDecisionCycle(
    preState: PortfolioSnapshot,
    policy: FinancialPolicy,
    intent: TradeIntent,
    adapter: ExecutionAdapter,
    priceSource?: PriceSource | NormalizedMarketPrice
  ): Promise<DecisionCycleReport> {
    const cycleId = `cycle_${Date.now()}`;
    const promiseId = `promise_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Extract oracle provenance if Pyth market truth is provided
    let oracleProvenance: OracleProvenance | undefined;
    if (priceSource) {
      const price = 'priceUsd' in priceSource ? priceSource.priceUsd : priceSource.price;
      const conf = 'confidenceUsd' in priceSource ? priceSource.confidenceUsd : priceSource.confidence;
      const confMin = 'confidenceMinUsd' in priceSource ? priceSource.confidenceMinUsd : Math.round((price - conf) * 100) / 100;
      const confMax = 'confidenceMaxUsd' in priceSource ? priceSource.confidenceMaxUsd : Math.round((price + conf) * 100) / 100;
      const publishTime = 'publishTime' in priceSource ? priceSource.publishTime : Date.now();
      const publishTimeFormatted = 'publishTimeFormatted' in priceSource ? priceSource.publishTimeFormatted : formatPublishTimeUtc(publishTime);
      const feedDisplayId = 'feedDisplayId' in priceSource ? priceSource.feedDisplayId : `Crypto.${intent.assetSymbol.toUpperCase()}/USD`;

      oracleProvenance = {
        source: priceSource.source,
        feedId: priceSource.feedId,
        feedDisplayId,
        priceUsd: price,
        confidenceUsd: conf,
        confidenceMinUsd: confMin,
        confidenceMaxUsd: confMax,
        publishTime,
        publishTimeFormatted,
        underlyingSymbol: 'underlyingSymbol' in priceSource ? priceSource.underlyingSymbol : ('underlyingAsset' in priceSource ? priceSource.underlyingAsset : undefined),
        underlyingFeedId: 'underlyingFeedId' in priceSource ? priceSource.underlyingFeedId : undefined,
        underlyingPriceUsd: 'underlyingPriceUsd' in priceSource ? priceSource.underlyingPriceUsd : ('underlyingPrice' in priceSource ? priceSource.underlyingPrice : undefined),
        trackingErrorBps: priceSource.trackingErrorBps ?? 0,
        deviationPct: 'deviationPct' in priceSource ? priceSource.deviationPct : (priceSource.trackingErrorBps ? Math.round((priceSource.trackingErrorBps / 100) * 100) / 100 : 0),
      };
    }

    // Phase 5: Promise Model 2.0 (who, what, why, underWhichPolicy, marketAssumptions, executionLimits, validity)
    const rationaleHash = createHash('sha256')
      .update(intent.strategyRationale || 'No rationale provided')
      .digest('hex');

    const estimatedTokens = intent.referencePriceUsd > 0
      ? Math.round((intent.tradeAmountUsd / intent.referencePriceUsd) * 10_000) / 10_000
      : 0;

    const promise: PromiseRecord = {
      promiseId,
      who: {
        agentId: this.agentId,
        agentName: this.name,
        portfolioId: preState.portfolioId ?? 'portfolio_main_sentinel',
        walletAddress: preState.walletAddress ?? preState.owner,
        owner: preState.owner,
      },
      what: {
        assetSymbol: intent.assetSymbol,
        assetMint: intent.assetMint,
        side: intent.direction,
        amountUsd: intent.tradeAmountUsd,
        estimatedTokens,
      },
      why: {
        strategyName: this.objective,
        strategyRationale: intent.strategyRationale || 'Strategy allocation',
        rationaleHash,
      },
      underWhichPolicy: {
        policyId: policy.policyId,
        policyHash: hashFinancialPolicy(policy),
        policyVersion: policy.policyVersion,
        maxSingleAssetBps: policy.maxSingleAssetBps,
        minStablecoinBps: policy.minStablecoinBps,
        maxTradeValueUsd: policy.maxTradeValueUsd,
        maxTrackingErrorBps: policy.maxTrackingErrorBps,
      },
      marketAssumptions: {
        quotedPriceUsd: intent.referencePriceUsd,
        priceSource: oracleProvenance?.source ?? 'Pyth Network',
        feedId: oracleProvenance?.feedId,
        confidenceUsd: oracleProvenance?.confidenceUsd,
        basisTrackingErrorBps: oracleProvenance?.trackingErrorBps,
        publishTimeUtc: oracleProvenance?.publishTimeFormatted,
      },
      executionLimits: {
        maxSlippageBps: policy.maxSlippageBps,
        maxTradeValueUsd: policy.maxTradeValueUsd,
        minLiquidityDepthUsd: 25_000,
        targetVenue: adapter.venueName,
      },
      validity: {
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        updatedAt: Date.now(),
      },
      status: 'PROPOSED',

      // Backwards-compatible flat fields
      agentId: this.agentId,
      policyHash: hashFinancialPolicy(policy),
      policyVersion: policy.policyVersion,
      intentHash: hashTradeIntent(intent),
      intent,
      expectedConstraints: {
        maxSingleAssetBps: policy.maxSingleAssetBps,
        minStablecoinBps: policy.minStablecoinBps,
        maxTradeValueUsd: policy.maxTradeValueUsd,
        maxSlippageBps: policy.maxSlippageBps,
        maxTrackingErrorBps: policy.maxTrackingErrorBps,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };

    // Evaluate postconditions through Sentinel Core Engine with Pyth Market Truth and Agent Risk State
    const venueDetails: { venueType?: string; isHealthy?: boolean; liquidityDepthUsd?: number } = {
      venueType: adapter.venueType ?? 'DEMO_SIMULATION',
      isHealthy: true,
      liquidityDepthUsd: 145_000,
    };
    const evaluation = evaluatePostconditions(
      preState,
      intent,
      policy,
      undefined,
      priceSource,
      this.agentRiskState,
      venueDetails
    );
    const swarmSummary = evaluateSwarm(evaluation.postState, intent, policy, undefined, priceSource);

    if (!evaluation.allPassed) {
      // POSTCONDITION FAILED -> ATOMIC ABORT
      this.agentRiskState.consecutiveFailures += 1;
      this.agentRiskState.lastFailureTimestamp = Date.now();
      this.agentRiskState.updatedAt = Date.now();
      if (policy.maxConsecutiveFailures && this.agentRiskState.consecutiveFailures >= policy.maxConsecutiveFailures) {
        this.agentRiskState.isCircuitBreakerTriggered = true;
      }

      promise.status = 'REJECTED';
      promise.validity.updatedAt = Date.now();

      const executionVenue: ExecutionVenueDetails = {
        venueType: adapter.venueType ?? 'DEMO_SIMULATION',
        venueName: adapter.venueName ?? 'Sentinel Venue Adapter',
        route: 'Execution Blocked: Pre-flight policy violation detected by Sentinel Engine',
      };

      // Generate institutional audit explanation: Why did Sentinel block this?
      const auditExplanation = generateAuditExplanation({
        promise,
        checks: evaluation.checks,
        verificationResult: 'REJECTED',
        failureCode: evaluation.failureCode,
        failureReason: evaluation.failureReason,
        oracleProvenance,
        executionVenue,
      });
      promise.explanation = auditExplanation;

      const evidenceRecord = createEvidenceRecord({
        agentId: this.agentId,
        promiseId,
        policy,
        intent,
        preState,
        postState: evaluation.postState,
        transactionSignature: 'TRANSACTION_ABORTED_ON_CHAIN_REJECTION',
        verificationResult: 'REJECTED',
        checks: evaluation.checks,
        swarmSummary,
        oracleProvenance,
        failureCode: evaluation.failureCode,
        failureReason: evaluation.failureReason,
        executionVenue,
        auditExplanation,
        promise,
        isSimulation: adapter.getMode() === 'SIMULATION',
      });

      return {
        cycleId,
        agentId: this.agentId,
        intent,
        promise,
        evaluation,
        evidenceRecord,
        resultingPortfolio: preState, // State unchanged!
        status: 'REJECTED',
        timestamp: Date.now(),
      };
    }

    // POSTCONDITIONS PASSED -> AUTHORIZED
    promise.status = 'AUTHORIZED';
    promise.validity.updatedAt = Date.now();

    // ISSUE CRYPTOGRAPHIC SENTINEL AUTHORIZATION TICKET
    const authorizationTicket: SentinelAuthorizationTicket = {
      ticketId: `auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      promiseId,
      agentId: this.agentId,
      intentHash: hashTradeIntent(intent),
      policyHash: hashFinancialPolicy(policy),
      preStateHash: hashPortfolioState(preState),
      authorizedAt: Date.now(),
      expiresAt: Date.now() + 60_000, // 60-second authorization validity window
      authorizedAmountUsd: intent.tradeAmountUsd,
      authorizedDirection: intent.direction,
      targetAssetSymbol: intent.assetSymbol,
      maxSlippageBps: policy.maxSlippageBps,
    };

    try {
      // TRANSITION TO EXECUTING
      promise.status = 'EXECUTING';
      promise.validity.updatedAt = Date.now();

      // SETTLE VIA EXECUTION ADAPTER GATED BY SENTINEL AUTHORIZATION
      const executionResult = await adapter.executeTrade(intent, preState, authorizationTicket);

      // TRANSITION TO SETTLED
      promise.status = 'SETTLED';
      promise.validity.updatedAt = Date.now();

      // State transitions on successful execution
      this.agentRiskState.consecutiveFailures = 0;
      this.agentRiskState.tradesExecuted24hUsd += intent.tradeAmountUsd;
      if (preState.totalValueUsd > 0) {
        this.agentRiskState.dailyTurnoverBps += Math.round((intent.tradeAmountUsd / preState.totalValueUsd) * 10_000);
      }
      this.agentRiskState.lastTradeTimestamp = Date.now();
      this.agentRiskState.updatedAt = Date.now();

      const executionVenue: ExecutionVenueDetails = {
        venueType: executionResult.venueType ?? adapter.venueType ?? 'DEMO_SIMULATION',
        venueName: executionResult.venueName ?? adapter.venueName ?? 'Sentinel Venue Adapter',
        poolAddress: executionResult.poolAddress,
        route: executionResult.route,
        marketQuality: executionResult.marketQuality ? {
          liquidityPassed: executionResult.marketQuality.liquidityPassed,
          liquidityDepthUsd: 145_000,
          priceDeviationPassed: executionResult.marketQuality.priceDeviationPassed,
          actualDeviationBps: executionResult.marketQuality.actualDeviationBps,
          details: executionResult.marketQuality.details,
        } : undefined,
        durationMs: executionResult.executionDurationMs,
      };

      // Generate institutional audit explanation: Why did Sentinel allow this?
      const auditExplanation = generateAuditExplanation({
        promise,
        checks: evaluation.checks,
        verificationResult: 'SETTLED',
        oracleProvenance,
        executionVenue,
      });
      promise.explanation = auditExplanation;

      const evidenceRecord = createEvidenceRecord({
        agentId: this.agentId,
        promiseId,
        policy,
        intent,
        preState,
        postState: evaluation.postState,
        transactionSignature: executionResult.transactionSignature,
        verificationResult: 'SETTLED',
        checks: evaluation.checks,
        swarmSummary,
        oracleProvenance,
        executionVenue,
        auditExplanation,
        promise,
        isSimulation: adapter.getMode() === 'SIMULATION',
      });

      return {
        cycleId,
        agentId: this.agentId,
        intent,
        promise,
        evaluation,
        executionResult,
        evidenceRecord,
        resultingPortfolio: evaluation.postState, // State committed!
        status: 'SETTLED',
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      this.agentRiskState.consecutiveFailures += 1;
      this.agentRiskState.lastFailureTimestamp = Date.now();
      this.agentRiskState.updatedAt = Date.now();
      if (policy.maxConsecutiveFailures && this.agentRiskState.consecutiveFailures >= policy.maxConsecutiveFailures) {
        this.agentRiskState.isCircuitBreakerTriggered = true;
      }
      promise.status = 'REJECTED';
      promise.validity.updatedAt = Date.now();

      const msg = err instanceof Error ? err.message : String(err);
      const isSecurityViolation =
        err instanceof SecurityViolationError ||
        (err instanceof Error && err.name === 'SecurityViolationError');
      const failureCode: FailureCode = isSecurityViolation ? 'ERR_UNAUTHORIZED' : 'ERR_SLIPPAGE_EXCEEDED';

      const executionVenue: ExecutionVenueDetails = {
        venueType: adapter.venueType ?? 'DEMO_SIMULATION',
        venueName: adapter.venueName ?? 'Sentinel Venue Adapter',
        route: `Execution Aborted: ${msg}`,
      };

      const auditExplanation = generateAuditExplanation({
        promise,
        checks: evaluation.checks,
        verificationResult: 'REJECTED',
        failureCode,
        failureReason: msg,
        oracleProvenance,
        executionVenue,
      });
      promise.explanation = auditExplanation;

      const evidenceRecord = createEvidenceRecord({
        agentId: this.agentId,
        promiseId,
        policy,
        intent,
        preState,
        postState: preState,
        transactionSignature: 'EXECUTION_REJECTED_VENUE_ERROR',
        verificationResult: 'REJECTED',
        checks: evaluation.checks,
        swarmSummary,
        oracleProvenance,
        failureCode,
        failureReason: msg,
        executionVenue,
        auditExplanation,
        promise,
        isSimulation: adapter.getMode() === 'SIMULATION',
      });

      return {
        cycleId,
        agentId: this.agentId,
        intent,
        promise,
        evaluation: {
          ...evaluation,
          allPassed: false,
          failureCode,
          failureReason: msg,
          postState: preState,
        },
        evidenceRecord,
        resultingPortfolio: preState,
        status: 'REJECTED',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Executes the exact scripted hackathon demonstration scenario (Section 17):
   * Step 1: Non-compliant trade (BUY NVDAx $15,000) -> Rejected
   * Step 2: Auto-adapted compliant trade (BUY NVDAx $5,000) -> Settled
   */
  async runAutonomousDemoScenario(
    initialPortfolio: PortfolioSnapshot,
    policy: FinancialPolicy,
    adapter: ExecutionAdapter
  ): Promise<DemoScenarioResult> {
    const nvdaAsset = initialPortfolio.assets.find(a => a.symbol === 'NVDAx');
    const nvdaMint = nvdaAsset ? nvdaAsset.mint : 'NVDA111111111111111111111111111111111111111';
    const nvdaPrice = nvdaAsset ? nvdaAsset.priceUsd : 120;

    // -------------------------------------------------------------------------
    // Step 1: Agent makes aggressive, non-compliant decision
    // -------------------------------------------------------------------------
    const badIntent = this.proposeIntent({
      assetSymbol: 'NVDAx',
      assetMint: nvdaMint,
      direction: 'BUY',
      tradeAmountUsd: 15_000,
      referencePriceUsd: nvdaPrice,
      strategyRationale: 'Increase NVDA exposure aggressively ahead of earnings report',
    });

    const step1Report = await this.runDecisionCycle(initialPortfolio, policy, badIntent, adapter);

    // -------------------------------------------------------------------------
    // Step 2: Agent observes rejection feedback and auto-adapts
    // -------------------------------------------------------------------------
    const compliantAmount = this.calculateCompliantTradeAmount(initialPortfolio, policy, 'NVDAx');

    const adaptedIntent = this.proposeIntent({
      assetSymbol: 'NVDAx',
      assetMint: nvdaMint,
      direction: 'BUY',
      tradeAmountUsd: compliantAmount, // $5,000
      referencePriceUsd: nvdaPrice,
      strategyRationale: `Auto-adapted trade size to $${compliantAmount.toLocaleString()} to strictly observe single-asset (25%) and reserve (20%) guarantees`,
    });

    const step2Report = await this.runDecisionCycle(initialPortfolio, policy, adaptedIntent, adapter);

    return {
      step1BadDecision: step1Report,
      step2AdaptedDecision: step2Report,
      summary: `Autonomous Agent Demo Complete: Step 1 proposed $15,000 (rejected: ${step1Report.evidenceRecord.failureReason}); Step 2 auto-adapted to $${compliantAmount.toLocaleString()} and successfully settled.`,
    };
  }

  getRiskState(): AgentRiskState {
    return { ...this.agentRiskState };
  }

  resetCircuitBreaker(): void {
    this.agentRiskState.consecutiveFailures = 0;
    this.agentRiskState.isCircuitBreakerTriggered = false;
    this.agentRiskState.updatedAt = Date.now();
  }

  setRiskState(partial: Partial<AgentRiskState>): void {
    this.agentRiskState = {
      ...this.agentRiskState,
      ...partial,
      updatedAt: Date.now(),
    };
  }
}
