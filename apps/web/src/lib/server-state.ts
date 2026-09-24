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
import { SentinelReadHistoryRepository } from './database';
import { APP_CONFIG } from './config';

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
  evidenceRecord?: EvidenceRecord;
}

export interface ServerStateStore {
  client: SentinelClient;
  db: SentinelReadHistoryRepository;
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
  const db = new SentinelReadHistoryRepository();
  const portfolio = client.createDefaultPortfolio();
  const policy = client.createDefaultPolicy();

  // Seed initial portfolio snapshot in read index
  db.recordPortfolioSnapshot(portfolio).catch(() => {});

  return {
    client,
    db,
    portfolio,
    policy,
    activityHistory: [],
    status: 'ACTIVE',
  };
})();

export function getServerStore(): ServerStateStore {
  return globalState;
}

/**
 * Runs an autonomous agent cycle via the server orchestrator and indexes
 * persistent read history into the 5 database tables:
 * agent_runs, decisions, executions, portfolio_snapshots, evidence_index.
 * Solana remains authoritative.
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
  const walletAddress =
    params.wallet && params.wallet !== 'default' ? params.wallet : store.portfolio.owner;

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

  // Persist into P13 read history repository (agent_runs, decisions, executions, portfolio_snapshots, evidence_index)
  const now = Date.now();
  const step1 = result.step1RejectedDecision;
  const step2 = result.step2SettledDecision;

  await store.db.recordAgentRun({
    run_id: result.cycleId,
    agent_id: result.agentId,
    wallet_address: walletAddress,
    scenario,
    llm_provider: provider.providerName,
    stage: result.loopState.stage,
    status: 'COMPLETED',
    summary: result.summary,
    created_at: now,
  });

  const dec1Id = `dec_${step1.cycleId}_step1`;
  const dec2Id = `dec_${step2.cycleId}_step2`;

  await store.db.recordDecision({
    decision_id: dec1Id,
    run_id: result.cycleId,
    wallet_address: walletAddress,
    asset_symbol: step1.intent.assetSymbol,
    direction: step1.intent.direction,
    amount_usd: step1.intent.tradeAmountUsd,
    status: 'REJECTED',
    failure_code: step1.evidenceRecord.failureCode,
    failure_reason: step1.evidenceRecord.failureReason,
    rationale: step1.intent.strategyRationale,
    evidence_id: step1.evidenceRecord.id,
    transaction_signature: step1.evidenceRecord.transactionSignature,
    created_at: now - 1000,
  });

  await store.db.recordDecision({
    decision_id: dec2Id,
    run_id: result.cycleId,
    wallet_address: walletAddress,
    asset_symbol: step2.intent.assetSymbol,
    direction: step2.intent.direction,
    amount_usd: step2.intent.tradeAmountUsd,
    status: 'ADAPTED',
    rationale: step2.intent.strategyRationale,
    evidence_id: step2.evidenceRecord.id,
    transaction_signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
    created_at: now,
  });

  await store.db.recordExecution({
    execution_id: `exec_${step1.cycleId}_revert`,
    decision_id: dec1Id,
    wallet_address: walletAddress,
    venue_type: step1.evidenceRecord.executionVenue?.venueType ?? 'SENTINEL_GUARD',
    venue_name: step1.evidenceRecord.executionVenue?.venueName ?? 'Sentinel Postcondition Guard',
    transaction_signature: step1.evidenceRecord.transactionSignature,
    executed_amount_usd: 0,
    executed_price_usd: step1.intent.referencePriceUsd,
    cluster: APP_CONFIG.clusterLabel,
    is_simulation: Boolean(step1.evidenceRecord.isSimulation),
    created_at: now - 1000,
  });

  await store.db.recordExecution({
    execution_id: `exec_${step2.cycleId}_settle`,
    decision_id: dec2Id,
    wallet_address: walletAddress,
    venue_type: step2.executionResult?.venueType ?? 'METEORA_DBC',
    venue_name: step2.executionResult?.venueName ?? 'Meteora Dynamic Bonding Curve',
    transaction_signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
    executed_amount_usd: step2.intent.tradeAmountUsd,
    executed_price_usd: step2.intent.referencePriceUsd,
    cluster: APP_CONFIG.clusterLabel,
    is_simulation: Boolean(step2.evidenceRecord.isSimulation),
    created_at: now,
  });

  await store.db.recordPortfolioSnapshot(store.portfolio);
  await store.db.recordEvidenceIndex(step1.evidenceRecord, dec1Id, walletAddress);
  await store.db.recordEvidenceIndex(step2.evidenceRecord, dec2Id, walletAddress);

  // Record activity history items for both the rejection and the adapted settlement
  store.activityHistory.unshift(
    {
      id: dec2Id,
      timestamp: now,
      type: 'ADAPTED',
      asset: step2.intent.assetSymbol,
      amountUsd: step2.intent.tradeAmountUsd,
      direction: step2.intent.direction,
      summary: `Auto-adapted trade approved: proposed $${result.adaptationDetails.adaptedAmountUsd.toLocaleString()} after $${result.adaptationDetails.initialAmountUsd.toLocaleString()} rejection.`,
      receiptNumber: step2.evidenceRecord.id,
      signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
      evidenceId: step2.evidenceRecord.id,
      evidenceRecord: step2.evidenceRecord,
    },
    {
      id: dec1Id,
      timestamp: now - 1000,
      type: 'REJECTED',
      asset: step1.intent.assetSymbol,
      amountUsd: step1.intent.tradeAmountUsd,
      direction: step1.intent.direction,
      summary: `Initial $${step1.intent.tradeAmountUsd.toLocaleString()} intent blocked by Sentinel postconditions.`,
      failureReason: step1.evidenceRecord.failureReason,
      signature: step1.evidenceRecord.transactionSignature,
      evidenceId: step1.evidenceRecord.id,
      evidenceRecord: step1.evidenceRecord,
    }
  );

  return result;
}
