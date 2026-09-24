/**
 * Sentinel Finance — Server Orchestration State
 *
 * P12 Requirement: Next.js Server Routes (Backend Orchestrator)
 * "The backend is: orchestrator, not: authority."
 *
 * Provides shared in-memory orchestration state for the Next.js API route handlers.
 * Real financial invariants and state roots remain authoritatively verified by Sentinel.
 */

import {
  SentinelClient,
  AutonomousRoboAgent,
  DemoProvider,
  OpenAIProvider,
  LLMProvider,
  AutonomousAdaptationResult,
  DecisionCycleReport,
  AgentLoopState,
} from '@sentinel/sdk';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  SentinelReceipt,
  NormalizedMarketPrice,
  ASSET_REGISTRY,
} from '@sentinel/domain';

export interface DecisionActivityItem {
  id: string;
  timestamp: number;
  type: 'APPROVED' | 'REJECTED' | 'ADAPTED';
  asset: string;
  amountUsd: number;
  direction: 'BUY' | 'SELL';
  summary: string;
  receiptNumber?: string;
  failureReason?: string;
  signature?: string;
  evidenceId: string;
}

export interface ServerStateStore {
  client: SentinelClient;
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  activityHistory: DecisionActivityItem[];
  lastLoopResult?: AutonomousAdaptationResult;
  lastLoopState?: AgentLoopState;
  status: 'ACTIVE' | 'PAUSED' | 'RUNNING';
}

// Global server singleton across Next.js API invocations
const globalState: ServerStateStore = (() => {
  const client = new SentinelClient();
  const portfolio = client.createDefaultPortfolio();
  const policy = client.createDefaultPolicy();

  return {
    client,
    portfolio,
    policy,
    activityHistory: [
      {
        id: 'act_init_1',
        timestamp: Date.now() - 3600_000,
        type: 'APPROVED',
        asset: 'NVDAx',
        amountUsd: 5000,
        direction: 'BUY',
        summary: 'Robo-01 automated rebalance into NVDAx tokenized equity.',
        receiptNumber: 'Decision #1',
        signature: 'sim_met_dbc_init_rebalance_01',
        evidenceId: 'ev_init_1',
      },
    ],
    status: 'ACTIVE',
  };
})();

export function getServerStore(): ServerStateStore {
  return globalState;
}

/**
 * Runs an autonomous agent cycle via the server orchestrator.
 */
export async function runServerAgentCycle(params: {
  wallet?: string;
  scenario?: 'flagship' | 'prestocks' | 'meteora' | 'pyth';
  llmProvider?: 'openai' | 'demo';
  targetAsset?: string;
  proposedAmountUsd?: number;
}): Promise<AutonomousAdaptationResult> {
  const store = getServerStore();
  store.status = 'RUNNING';

  const scenario = params.scenario ?? 'flagship';
  const targetAsset = params.targetAsset ?? (scenario === 'prestocks' ? 'OPENAIx' : 'NVDAx');
  const proposedAmount = params.proposedAmountUsd ?? (scenario === 'prestocks' ? 5000 : 15000);

  // Initialize selected LLM provider
  let provider: LLMProvider;
  if (params.llmProvider === 'openai' && process.env.OPENAI_API_KEY) {
    provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, fallbackToDemo: true });
  } else {
    provider = new DemoProvider(scenario);
  }

  store.client.setLLMProvider(provider);

  // Execute 10-stage autonomous loop
  const result = await store.client.getAgent().executeAutonomousAdaptationLoop(
    store.portfolio,
    store.policy,
    targetAsset,
    proposedAmount,
    store.client.getDemoAdapter(),
    undefined,
    (loopState) => {
      store.lastLoopState = loopState;
    },
    {
      llmProvider: provider,
      userGoal: `Autonomous portfolio management with focus on ${targetAsset}`,
    }
  );

  store.lastLoopResult = result;
  store.status = 'ACTIVE';

  // Apply settled outcome to server portfolio
  if (result.step2SettledDecision.status === 'SETTLED' && result.step2SettledDecision.resultingPortfolio) {
    store.portfolio = result.step2SettledDecision.resultingPortfolio;
  }

  // Record activity history items for both the rejection and the adapted settlement
  store.activityHistory.unshift(
    {
      id: `act_${Date.now()}_step2`,
      timestamp: Date.now(),
      type: 'ADAPTED',
      asset: result.step2SettledDecision.intent.assetSymbol,
      amountUsd: result.step2SettledDecision.intent.tradeAmountUsd,
      direction: result.step2SettledDecision.intent.direction,
      summary: `Auto-adapted trade approved: proposed $${result.adaptationDetails.adaptedAmountUsd.toLocaleString()} after $${result.adaptationDetails.initialAmountUsd.toLocaleString()} rejection.`,
      receiptNumber: result.step2SettledDecision.evidenceRecord.id,
      signature: result.step2SettledDecision.executionResult?.transactionSignature,
      evidenceId: result.step2SettledDecision.evidenceRecord.id,
    },
    {
      id: `act_${Date.now()}_step1`,
      timestamp: Date.now() - 1000,
      type: 'REJECTED',
      asset: result.step1RejectedDecision.intent.assetSymbol,
      amountUsd: result.step1RejectedDecision.intent.tradeAmountUsd,
      direction: result.step1RejectedDecision.intent.direction,
      summary: `Initial $${result.step1RejectedDecision.intent.tradeAmountUsd.toLocaleString()} intent blocked by Sentinel postconditions.`,
      failureReason: result.step1RejectedDecision.evidenceRecord.failureReason,
      evidenceId: result.step1RejectedDecision.evidenceRecord.id,
    }
  );

  return result;
}
