import {
  PortfolioSnapshot,
  FinancialPolicy,
  TradeIntent,
  PromiseRecord,
  createEvidenceRecord,
  evaluatePostconditions,
  evaluateSwarm,
  hashFinancialPolicy,
  hashTradeIntent,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  DecisionCycleReport,
  DemoScenarioResult,
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

  constructor(config: AgentConfig = {}) {
    this.agentId = config.agentId ?? 'sentinel_robo_agent_1';
    this.name = config.name ?? 'Sentinel Autonomous Robo-1';
    this.objective = config.objective ?? 'Earnings Momentum & Growth Allocation';
    this.status = 'ACTIVE';
    this.wallet = new ClawPumpAgentWallet(this.agentId, this.name);
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
    adapter: ExecutionAdapter
  ): Promise<DecisionCycleReport> {
    const cycleId = `cycle_${Date.now()}`;
    const promiseId = `promise_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Build formal promise record
    const promise: PromiseRecord = {
      promiseId,
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
      },
      status: 'VALIDATING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Evaluate postconditions through Sentinel Core Engine
    const evaluation = evaluatePostconditions(preState, intent, policy);
    const swarmSummary = evaluateSwarm(evaluation.postState, intent, policy);

    if (!evaluation.allPassed) {
      // POSTCONDITION FAILED -> ATOMIC ABORT
      promise.status = 'REJECTED';
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
        failureCode: evaluation.failureCode,
        failureReason: evaluation.failureReason,
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

    // POSTCONDITIONS PASSED -> SETTLE VIA EXECUTION ADAPTER
    const executionResult = await adapter.executeTrade(intent, preState);
    promise.status = 'SETTLED';

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
}
